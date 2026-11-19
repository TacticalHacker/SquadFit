# Research: Squad v2

All decisions below resolve the Technical Context; none are open.

## R1. Monthly figures: stored per month in SQUADSTATS

- **Decision**: `buildMemberStats` adds `months: { "YYYY-MM": { workoutDays, volumeKg } }` over all history, and each lift gains `monthBests: { "YYYY-MM": { e1rm, date } }`. Monthly boards, the PR-jump baseline and the monthly Hall of Fame records read these. `dayVolumeKg` (14 days, only used by the removed Consistency board) is dropped.
- **Rationale**: Stats are already rebuilt from all entries on every write (feature 010 R1), so this is a few extra maps, not a new pipeline. A squad with years of history has at most ~12 keys a year per map.
- **Alternatives**: Query entries per member on read (slow, repeats `walkLift`); store only the current month (breaks Hall of Fame and the 1-Dec edit of 30 Nov).

## R2. Month bucketing and the squad timezone

- **Decision**: An entry belongs to the month of its stored local date (`date.slice(0, 7)`). The *current* month is `localDate(now, squadTimezone).slice(0, 7)`. The squad timezone lives in a new item `SQUAD#global / SETTINGS` (`timezone`, default `Asia/Kolkata` when absent), set by `pnpm admin squad timezone <IANA>`.
- **Rationale**: Entry dates never need a clock (constitution V); the reset moment is one shared instant. Changing the timezone rewrites nothing.
- **Alternatives**: Convert every entry to the squad timezone (entries have no time of day); env var (needs a redeploy to change).

## R3. Biggest PR jump

- **Decision**: For lift L and month M: `jump = monthBests[M].e1rm − max(monthBests[m].e1rm for m < M)`, only when an earlier month exists and the result is > 0. `pct = round(jump / before × 100)`. Eligible lifts: `gx-bench-press`, `gx-barbell-squat`, `gx-deadlift`, `gx-overhead-press`, `gx-barbell-row`, `gx-pull-ups`. Pull-ups have weight > 0 only when weight is added (working-set rule already requires weight > 0), so no extra rule. Flagged jumps are already excluded by `walkLift`. The member's value is their largest kg jump (largest % jump for the % ranking, which may come from a different lift).
- **Rationale**: Uses the existing estimated max and exclusions; first-ever logs have no earlier month, so they are never jumps.

## R4. Current strength (Big 3 / Big 4) and badges

- **Decision**: Big 3 = sum of `lifts[id].bestE1rm.e1rm` for bench, squat and deadlift; Big 4 adds overhead press. Missing lifts are listed as `missing: string[]`. Badge thresholds: 225, 300, 400, 450, 500 kg (ids `club225` … `club500`). The date a badge was earned is found during the rebuild by walking the three lifts' best-so-far estimates in date order (an internal timeline from `walkLift`, not stored); the first date the running sum meets the threshold is the event date. Badge events are `badge#club300`, kind `badge`, posted through the existing feed diff: created once, updated if the date moves, deleted when no longer true. The backfill seeds them (no feed items), exactly like PRs.
- **Rationale**: "Once" falls out of deterministic event ids plus the existing diff; nothing new to keep consistent.
- **Alternatives**: Permanent badges in a separate item (needs its own consistency rules; owner accepted the PR-like rule).

## R5. Reactions replace high-fives

- **Decision**: Item `USER#<author> / RX#<eventId>#<type>#<reactor>` with `type ∈ fire|muscle|crown`, and counts `rxFire`, `rxMuscle`, `rxCrown` on the `FEED#` item. Add/remove are one transaction each (conditional put/delete of the RX item + `ADD rx<Type> :±1`), as high-fives are today, so counts stay exact under concurrency. Viewer state: one BatchGet of 3 keys per item. Rules carry over from `high-five.ts`: not your own items; `day#<date>` targets created lazily, unlisted. Endpoints `PUT|DELETE /squad/feed/{id}/reactions/{type}`.
- **Migration**: `pnpm admin squad migrate-reactions` scans `HI5#` items; for each, puts the matching `RX#…#muscle` item (overwrite is harmless), then for each touched feed item sets `rxMuscle` to the count of its `RX#…#muscle` items, then deletes the `HI5#` items and `hi5Count`. Re-running finds no `HI5#` items and changes nothing. Run immediately after deploying; between deploy and migration old high-fives show as 0 (acceptable for a friend squad, noted in quickstart).
- **Alternatives**: Keep HI5 as 💪 under its old key (two key shapes forever); dual-read during migration (code that lives for minutes).

## R6. One boards endpoint, ranks from the server

- **Decision**: `GET /squad/boards` returns every board's **full** ranked list in one response (`month`, boards, viewer flags). The card shows the top 3 + the viewer's row; `/squad/boards/[id]` renders the same response in full. Alternate orders (PR jump by %, Big 4) are returned as a second rank on each row (`pctRank`, `big4Rank`), like the existing `relativeRank`, so ranks stay server-authoritative and the toggle is a plain link. `GET /squad/hall-of-fame` returns the records.
- **Rationale**: Tens of members × 7 boards is a few KB; one cached request for both pages; no query parameters to validate.
- **Alternatives**: Separate card and list endpoints (two shapes, same work).

## R7. Board registry

- **Decision**: `packages/shared/src/domain/boards.ts` exports `BOARD_DEFS: readonly BoardDef[]` (`id`, `group: grind|strength|nutrition`, `monthly`) and one pure `rank<Id>(members, ctx)` per board, combined by `buildSquadBoards(input)`. Titles and the (i) sentences are copy, so they live in the web phrases file keyed by board id. Adding a board = one `BOARD_DEFS` entry + one rank function + one schema variant + one phrase.
- **Rationale**: Matches FR-005 without a plugin system (constitution VII).

## R8. Steps and protein for the month

- **Decision**: Steps board reuses `stepsBoardRow`/`rankSteps` with the month's dates (from the 1st of the squad month to the member's today, clamped). Protein days reuses `proteinByDay`/`hitDays`/`rankNutrition` with the same dates; "19" in "14 / 19 days" = number of those dates. Hall of Fame's monthly step average reads each sharing member's full `ACTIVITY#` history (one Query each; ≤ a few hundred items) on request.
- **Rationale**: Reuse; activity writes do not rebuild squad stats, so steps stay computed on read as in feature 012.

## R9. Targets confirmed

- **Decision**: Profile attribute `targetsConfirmedAt` (ISO). Set by `upsert` (profile create and every Settings save, which always submits the targets) and by `setTargets` (prompt, MCP `update_user_targets`). `targetsPromptDismissed` (boolean) hides the prompt. New `PUT /me/targets` with body `{ dailyCalorieTarget, dailyProteinTarget | null }` confirms, or `{ dismiss: true }` dismisses. `GET /me` gains `targetsConfirmed`, `targetsPromptDismissed`.
- **Enforcement**: `nutritionOn` gains the viewer id; when the viewer is not the owner and the owner is unconfirmed, `calorieTarget` and `proteinTarget` are `null` before `nutritionFor` runs (one choke point). The Protein board and `protein-events.ts` skip unconfirmed members.
- **Alternatives**: A `targetsSource: default|member` flag (there is no code default to distinguish; the values were typed).

## R10. Plain wording

- **Decision**: `apps/web/src/lib/plain.ts` holds every phrase and formatter (`kg`, `steps`, `weeksInARow`, `setSummary`, `bestSet`, `estMax`, `feedLine`, board titles and info sentences, `perDumbbell`). Dumbbell detection: name contains "Dumbbell", or id in `gx-hammer-curl`, `gx-lateral-raises`. All squad-area components import from it; a lint-free grep for "e1RM" in `apps/web/src` must find only identifiers, never JSX text. The `(i)` control is one small component (`InfoTip`) that opens a `BottomSheet` (all widths, one component).
- **Rationale**: One file to tweak (owner request); formatting stays on the client because it is presentation only.

## R11. Removed

- `GET /squad/leaderboard` handler, `SquadLeaderboardSchema`/`SquadLeaderboardFullSchema`, `buildBoards`, `consistency`, `weekVolumeKg`, `PeriodSchema`, the `squad-hi5-*` handlers and `high-five.ts` (replaced by `reaction.ts`), `HighFiveButton`, the old `squad-boards.tsx` tabs and notes. The `shareBodyWeight` setting stays stored but unused until feature 014 (its Settings switch is hidden).
