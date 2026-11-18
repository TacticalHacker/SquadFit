# Research: Squad Leaderboard

All Technical Context unknowns are resolved below. Each item: **Decision / Rationale / Alternatives considered**.

## R1. Compute on write vs. on read

**Decision**: A per-member cached stats item (`USER#<sub>` / `SQUADSTATS`) holds the *inputs* the boards need, rebuilt in full by `refreshSquadStats(userId, deps)` (`services/api/src/lib/squad-stats.ts`) after every change to that member's workout entries or squad settings. The rebuild reads all of the member's `ENTRY#` items (one paginated Query), calls the pure `buildMemberStats` (`packages/shared/src/domain/squad.ts`) and writes the item plus the feed diff (R6). Read-time figures that depend on *today* (current streak, in-progress week, consistency, period filters) are computed on read from the stored per-week and per-day data by pure functions, so a week ending without a new write is still correct.

**Rationale**: Spec FR-030. A full rebuild (not an incremental update) is the only way edits and deletes inside the 3-day window (spec Story 2 #5, FR-028) stay correct without special cases. At ~3 members and a few hundred entries each, one Query per save costs milliseconds. The board then needs one `BatchGet` for all members instead of scanning everyone's history.

**Alternatives considered**: Pure derive-on-read (one history Query per member per page view: grows with members × history, and feed events still need a write-time trigger); incremental counters (wrong after edits/deletes); DynamoDB Streams + a recompute Lambda (eventual, a new stateful trigger and extra infra for no gain at this scale, constitution VII).

## R2. Where the rebuild is triggered

**Decision**: `refreshSquadStats` is called after the write succeeds in exactly these places:

| Path | File |
|---|---|
| Gym save, HTTP and MCP `upsert_workout_log` | `lib/gym-save.ts` (`saveGymEntry`) |
| Gym delete | `handlers/gym-entry-delete.ts` |
| Activity add/change (HTTP) | `handlers/entry-put.ts` |
| Activity delete | `handlers/entry-delete.ts` |
| Jump confirm | `handlers/gym-entry-confirm-put.ts` (new) |
| Squad settings change | `handlers/me-squad-put.ts` (new) |

MCP `update_workout_calories` only changes minutes/calories of an existing entry, which affects no squad figure, so it does not trigger a rebuild.

If the rebuild throws, the entry write is already committed: the handler still returns success and logs only `squad-stats refresh failed` with the error name (no ids, no data). The next write or a backfill run repairs it.

**Rationale**: One service function shared by HTTP and MCP is the pattern from feature 007 R1, so the AI agent triggers the same updates (spec edge case).

**Alternatives considered**: Calling it in every handler that touches entries generically via a repo decorator (hides an expensive side effect inside a repo method).

## R3. Weeks and timezones

**Decision**: Entry `date`s are already the member's local calendar date (the server computes them from the profile timezone, constitution V), so weeks are derived from dates with no clock math: `weekStart(date)` = the Monday on or before it (`packages/shared/src/domain/week.ts`, pure, UTC-free string math using the existing `addDays`). Only "today" depends on the timezone: `today = localDate(now, profile.timezone)`, `currentWeek = weekStart(today)`.

The timezone-boundary test checks that an instant of Sunday 23:30 UTC is Monday 05:00 in Asia/Kolkata, so a workout then counts in the new week (spec Story 1 #6).

**Rationale**: Reuses `localDate`/`addDays`; a timezone change never rewrites past dates, which satisfies the "applied from the change onward" assumption for free.

**Alternatives considered**: Storing instants and converting per view (more math, and entries don't store instants of the workout anyway).

## R4. Weekly target history

**Decision**: The stats item stores `weeks: { [weekStart]: { days: number, target: number } }` for every week with ≥ 1 workout day. On rebuild, a week that already exists in the previous stats item **and has ended** keeps its stored `target`; the current week and newly seen weeks use the profile's current `weeklyTarget`. Weeks with no workouts are absent (never hit).

**Rationale**: Spec Story 7 #3 (changing the target applies from the current week; ended weeks keep theirs). Storing it per week is the smallest record that makes the rebuild deterministic.

**Alternatives considered**: A separate target-history log (more items, same information).

## R5. PRs, working sets and jump flags

**Decision**: `buildMemberStats` walks each exercise's gym strength entries in date order:

- Working set (FR-012): `completed && reps >= 1 && weightKg > 0`.
- `e1rm(w, r) = r <= 10 ? w * (1 + r / 30) : null`, rounded to 0.1 kg for display and comparison.
- Day best = max weight and max e1RM of the day's *eligible* working sets.
- First day with an eligible set = baseline, no PR. A later day is a PR day if its best weight > previous best weight or its best e1RM > previous best e1RM. At most one PR per exercise per day (spec FR-015).
- **Jump rule** (FR-016, clarification): a set is suspicious if `x > prev * 1.5 && x - prev > 20` for weight or e1RM against the previous bests. It is *flagged* (excluded) unless the entry is confirmed or trusted:
  - Confirmed: the entry carries `jumpConfirmedAt` (set by "Looks right"; any full save drops it, so an edit re-evaluates).
  - Trusted: the entry's `updatedAt` is before the member's `trustedBefore` (set by the backfill, clarification Q2).
- Bests and PR detection then continue as if the flagged set did not exist.

Output per exercise: all-time `bestWeight`/`bestE1rm` (with the set and date), `prDays: [{ date, weightKg, reps, e1rm }]`, and `dayBests` for the last 31 days (for "This week"/"Last 30 days" Lift boards). Flags are a list of `{ date, exerciseId }`.

**Rationale**: Deterministic from entries, so a rebuild after any edit gives the same answer. The 31-day window keeps the item well under DynamoDB's 400 KB limit (~28 exercises × 31 days worst case).

**Alternatives considered**: Detecting PRs only at save time against stored bests (wrong after edits of older days in the window); a per-set flag stored on the entry by the save path (would be lost or stale when an earlier day is edited).

## R6. Feed events: identity, diffing and launch

**Decision**: Each member's events are derived by `buildMemberStats` with stable ids:

| Kind | Event id | When |
|---|---|---|
| PR | `pr#<exerciseId>#<date>` | each PR day (FR-015), with exercise name, best set, e1RM |
| Streak week | `wk#<weekStart>` | a week becomes hit; `n` = its position in the consecutive run |
| First workout | `first` | the member has ≥ 1 workout day |

Stored as `USER#<sub>` / `FEED#<eventId>` with `gsi1pk = SQUADFEED#<squadId>`, `gsi1sk = <createdAt>#<sub>#<eventId>`. After the rebuild, `refreshSquadStats` queries the member's `FEED#` items and diffs: puts new events (createdAt = now), updates changed payloads (keeps createdAt), deletes events no longer derived along with their high-fives (FR-028).

Launch: the stats item holds `seededEventIds`. The backfill sets it to every event derived at that moment (minus events that already have a feed item, so re-running is safe) and creates no feed items (FR-031). Rebuilds never emit an event whose id is in `seededEventIds`.

**Rationale**: Ids make re-saving the same data idempotent; per-member keys make the diff a single Query; the GSI gives the squad feed newest-first with one Query.

**Alternatives considered**: Feed under `SQUAD#<id>` partition only (diffing a member's events needs a filter scan of the whole feed); an append-only event log (can't retract edited-away PRs).

## R7. High-fives

**Decision**: Reaction item `USER#<authorSub>` / `HI5#<eventId>#<reactorSub>`; the feed item carries `hi5Count`. Add = `TransactWrite` [Put reaction `attribute_not_exists(sk)`, Update feed item `ADD hi5Count :1` with `attribute_exists(sk)`]; remove = the mirror with `-1` and `attribute_exists`. A cancelled transaction because the reaction already exists (or doesn't) is treated as success (idempotent PUT/DELETE). `reactedByMe` for the 20 shown items comes from one `BatchGet` of `HI5#<eventId>#<viewer>` keys.

**Rationale**: One per member per item is enforced atomically by the key (FR-029); count stays exact.

**Alternatives considered**: A string set of reactor ids on the feed item (`ADD`/`DELETE` on a set is also atomic, but exposes reactor ids in the item and makes counting a read-side job). Viable; the separate item was kept because it matches the nudge-style "one per sender per target" pattern the PRD will need later.

## R8. Board read and ranking

**Decision**: `GET /squad/leaderboard?period=&exercise=` loads community profiles (`listCommunity`) and `BatchGet`s every member's `SQUADSTATS`, then the pure `buildBoards(input)` returns all four boards at once (they are small). Each member's "this week" and "last 30 days" use their own `today`. Ranking: `rankRows(rows, keys)` sorts by the keys descending, then display name; equal keys share a rank (competition ranking 1, 1, 3). Hidden members are removed before ranking; if the viewer is hidden, their row is appended unranked (`rank: null`) with `isYou: true`.

Lift board exercise options: the 4 defaults + built-in `gx-` strength exercises where ≥ 2 visible members have a best. Relative strength = `e1rm / bodyWeightKg` rounded to 2 decimals only when `shareBodyWeight && bodyWeightKg` is *saved* (not the 75 kg default); the API returns only the ratio, never the weight.

**Rationale**: One request for the page; tabs and the relative toggle switch on the client with no refetch. Period and exercise change via the URL (Server Component refetch).

**Alternatives considered**: One endpoint per board (four round trips or a waterfall per tab change).

## R9. Settings storage and endpoint

**Decision**: Profile gains `weeklyTarget` (1–7, absent = 3), `leaderboardVisible` (absent = true), `shareBodyWeight` (absent = false). A dedicated `PUT /me/squad` (strict body with all three) updates them with one `UpdateItem` and triggers a rebuild (the current week's target may change). Settings gets a "Squad" section with its own Server Action.

**Rationale**: Keeps `ProfileInputSchema` and the setup flow unchanged; absent attributes give the defaults with no data migration.

**Alternatives considered**: Extending `PUT /me/profile` (every profile save would need the three fields, and setup would need them too).

## R10. Confirming a flagged jump

**Decision**: `PUT /workouts/gym/entries/{date}/{exerciseId}/confirm` with body `{ updatedAt }` sets `jumpConfirmedAt` on the entry conditionally on `updatedAt = :seen` (409 if the entry changed), then rebuilds. It is allowed on any past date (it confirms, it doesn't edit the log), only for the caller's own entry. The gym view's entry gains `jumpFlag: boolean`, read from the member's stats item flags.

**Rationale**: The flag belongs to the entry version the member looked at; a newer edit already re-evaluates.

**Alternatives considered**: A separate confirmations list in the stats item (lost by the full rebuild unless copied forward).

## R11. Replacing the daily streak

**Decision**: The daily `currentStreak` is deleted; `DAILY_GOAL_MINUTES`/`goalProgress` stay (the day strip's progress ring still uses them). The Workouts pages stop loading 62 days of summaries for the streak and instead read `streak` from `GET /workouts/summary` (new field `weeklyStreak: { current, best, weekDays, target } | null`, from the member's stats item). `DayNav` shows "4-week streak · 2/3". MCP `get_full_context.streak` becomes the same object (description updated). The old `currentStreak` is deleted once unused.

**Rationale**: FR-032; one streak definition everywhere.

**Alternatives considered**: Keeping the daily streak on Workouts (two contradicting streaks).

## R12. Backfill

**Decision**: `pnpm admin squad backfill` (`infra/scripts/admin.ts`) runs, for each community member, the same rebuild with `seed: true`: `trustedBefore = now`, `seededEventIds` = derived events minus existing feed ids, no feed writes. Re-running is safe: trusted/seeded only grow, existing feed items are kept. It prints only counts.

**Rationale**: FR-031, clarification Q2; one code path for live and backfill.

**Alternatives considered**: A migration Lambda (extra infra for a one-off).

## R13. Concurrent rebuilds

**Decision**: The stats item carries `version`; the rebuild writes with `version = :prev` (or `attribute_not_exists`) and on a conditional failure re-reads entries and retries once. Feed writes are idempotent puts/deletes keyed by event id.

**Rationale**: Two quick saves (or the member and their agent) must not leave stats built from the older entry set.

**Alternatives considered**: Last-writer-wins (a slower rebuild with older data could overwrite a newer one).
