# Data Model: Squad Leaderboard

Single table, same `pk`/`sk` + `gsi1pk`/`gsi1sk` as features 001–009. No new table or index. All new items live under the member's own partition, so `squadId` is an attribute and a GSI key component, not a partition (FR-005). Today there is one squad: `SQUAD_ID = "global"`.

## Changed: Profile (`USER#<sub>` / `PROFILE`)

| Attribute | Type | Default when absent | Rule |
|---|---|---|---|
| `weeklyTarget` | int | 3 | 1–7 (FR-006) |
| `leaderboardVisible` | bool | true | FR-003 |
| `shareBodyWeight` | bool | false | FR-004; only meaningful with a saved `bodyWeightKg` |

Written only by `PUT /me/squad`. No migration: absent = default.

## Changed: Workout entry (`USER#<sub>` / `ENTRY#<date>#<id>`)

| Attribute | Type | Rule |
|---|---|---|
| `jumpConfirmedAt` | ISO datetime, optional | Set by "Looks right" (conditional on `updatedAt`). Gym saves are full puts, so any edit drops it. |

## New: Member squad stats (`USER#<sub>` / `SQUADSTATS`)

Rebuilt in full from the member's entries (research R1). Contains inputs for read-time figures, never rendered directly.

```ts
interface SquadStatsItem {
  squadId: "global";
  version: number;                 // optimistic concurrency (R13)
  builtAt: string;                 // ISO
  trustedBefore?: string;          // ISO; entries updated before this are never flagged (backfill, R12)
  seededEventIds: string[];        // events that existed at backfill; never emitted to the feed
  firstWorkoutDate: string | null;
  weeks: Record<string /* Monday YYYY-MM-DD */, { days: number; target: number }>;  // only weeks with ≥1 workout day
  dayVolumeKg: Record<string /* date */, number>;  // last 14 days, working sets only (FR-019)
  lifts: Record<string /* exerciseId */, {
    name: string;                  // snapshot from the latest entry
    builtIn: boolean;              // gx-* (Lift board eligible) vs own gc-*
    best: { weightKg: number; reps: number; e1rm: number | null; date: string } | null;  // all-time heaviest
    bestE1rm: { weightKg: number; reps: number; e1rm: number; date: string } | null;    // all-time best estimate
    prDays: { date: string; weightKg: number; reps: number; e1rm: number | null }[];
    dayBests: Record<string /* date, last 31 days */, { e1rm: number; weightKg: number; reps: number }>;
  }>;
  flags: { date: string; exerciseId: string }[];  // unusual jumps awaiting "Looks right"
}
```

Size: worst case ~28 built-in + a few own exercises × (≤ 31 day bests + PR history) stays far below 400 KB at this scale; `prDays` older than 400 days could be trimmed later if needed (not now, YAGNI).

### Derivation rules (pure, `packages/shared/src/domain/squad.ts`)

- **Workout day** (FR-007): a date with ≥ 1 entry that is (a) `kind: "gym"` strength with ≥ 1 completed set, (b) `kind: "gym"` cardio, or (c) any non-gym entry (Activities, including retired `std-*`).
- **Week** (FR-008): `weekStart(date)` = Monday on/before; `days` = distinct workout days in Mon–Sun; `target` = stored target if the week has ended and was already stored, else the profile's current target.
- **Working set** (FR-012), **e1RM** (FR-013), **PR day** (FR-015), **jump flag** (FR-016): see research R5.

### Read-time figures (pure, given `today` per member)

| Figure | Rule |
|---|---|
| `hit(week)` | `days >= target` |
| current streak (FR-009) | count back from the last ended week while `hit`; add 1 if the current week is already hit |
| best streak (FR-010) | longest run of consecutive Monday-adjacent hit weeks |
| in progress | `{ days: weeks[currentWeek]?.days ?? 0, target: profile target }` |
| consistency (FR-018) | hit share of the last 4 ended weeks on or after `weekStart(joinedDate)`; `null` if none |
| weekly volume (FR-019) | sum of `dayVolumeKg` for dates in the current week |
| PRs in period | `prDays` with date in the period (week: `currentWeek..today`; 30d: `today−29..today`; all) |
| Lift best in period | max `dayBests` in period (week/30d) or `bestE1rm` (all) |

## New: Feed event (`USER#<sub>` / `FEED#<eventId>`)

| Attribute | Type | Notes |
|---|---|---|
| `squadId` | `"global"` | |
| `eventId` | `pr#<exerciseId>#<date>` \| `wk#<weekStart>` \| `first` | stable, R6 |
| `kind` | `pr` \| `streak_week` \| `first_workout` | |
| `eventDate` | YYYY-MM-DD | the member's local date of the event |
| `payload` | `{ exerciseName, weightKg, reps, e1rm }` \| `{ week: n }` \| `{}` | figures shown |
| `hi5Count` | int ≥ 0 | |
| `createdAt` | ISO | set once; orders the feed |
| `gsi1pk` | `SQUADFEED#global` | |
| `gsi1sk` | `<createdAt>#<sub>#<eventId>` | newest first with `ScanIndexForward: false` |

Lifecycle: created by a rebuild when first derived (and not seeded) → payload updated by later rebuilds if the figures change → deleted (with its high-fives) when no longer derived.

## New: High-five (`USER#<authorSub>` / `HI5#<eventId>#<reactorSub>`)

| Attribute | Type |
|---|---|
| `createdAt` | ISO |

Exists ⇔ reactor has high-fived the event. Created/removed in the same transaction as the `hi5Count` change (R7).

## Access patterns

| Need | Operation |
|---|---|
| Rebuild a member | Query `pk = USER#<sub>, sk BETWEEN ENTRY# and ENTRY#~`; Get `SQUADSTATS`; Query `begins_with(sk, "FEED#")` |
| Leaderboard | Query `gsi1pk = COMMUNITY` (profiles, existing); BatchGet `SQUADSTATS` for each |
| Feed | Query `gsi1pk = SQUADFEED#global`, newest first, pages of 50, drop hidden members, stop at 20 visible or the end; BatchGet viewer's `HI5#…` keys |
| High-five | TransactWrite on `FEED#` + `HI5#` items |
| Gym view flags / workouts streak | Get `SQUADSTATS` |
