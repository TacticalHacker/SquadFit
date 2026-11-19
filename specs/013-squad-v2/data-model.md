# Data Model: Squad v2

Single table `pk`/`sk` (+ `gsi1pk`/`gsi1sk`). Only changes from features 010–012 are listed.

## Squad settings (new)

| pk | sk | Attributes |
|---|---|---|
| `SQUAD#global` | `SETTINGS` | `timezone` (IANA, validated with `isValidTimezone`), `updatedAt` |

Absent item = `{ timezone: "Asia/Kolkata" }`. Written only by `pnpm admin squad timezone <tz>`.

## SQUADSTATS (changed) `USER#<sub> / SQUADSTATS`

Adds:

```ts
months: Record<"YYYY-MM", { workoutDays: number; liftsImproved: number }>; // all history; month of the entry's local date
lifts[exerciseId].monthBests: Record<"YYYY-MM", { e1rm: number; date: string }>; // best eligible estimate that month
badges: Record<ClubId, string>; // club id → date earned (first date the best-so-far Big 3 met the threshold)
```

Removes `dayVolumeKg`. `version` handling is unchanged. Existing items without the new maps read as empty until the next rebuild; the deploy runs `pnpm admin squad backfill` once (safe to re-run).

Validation: `workoutDays` counts distinct workout dates (`isWorkoutEntry`); `liftsImproved` counts sessions whose top set beat the previous session of that exercise (eligible working sets only). Weekly weight lifted for profiles is computed on read (`weekVolumes`), not stored.

## Feed item (changed) `USER#<author> / FEED#<eventId>`

- `hi5Count` → removed; `rxFire`, `rxMuscle`, `rxCrown` (numbers, default 0).
- New kind `badge`, event id `badge#<clubId>`, payload `{ club: ClubId, totalKg }`.
- `pr` payload adds `gainKg: number | null` (estimate gain over the previous best; null for a weight-only PR).

## Reaction (new, replaces high-five) `USER#<author> / RX#<eventId>#<type>#<reactorSub>`

| Attribute | |
|---|---|
| `createdAt` | ISO |

`type ∈ fire | muscle | crown`. Add = transaction { Put RX with `attribute_not_exists(sk)`, Update feed `ADD rx<Type> :1` with `attribute_exists(sk)` }. Remove = { Delete RX with `attribute_exists(sk)`, Update `ADD rx<Type> :-1` with `rx<Type> > 0` }. Deleting a feed item deletes all its `RX#<eventId>#` items (same as HI5 today).

Old `HI5#<eventId>#<reactor>` items are converted by the migration (research R5) and then no longer exist.

## Profile (changed) `USER#<sub> / PROFILE`

| Attribute | Type | Default | Notes |
|---|---|---|---|
| `targetsConfirmedAt` | ISO string | absent = unconfirmed | set by `upsert` and `setTargets` |
| `targetsPromptDismissed` | boolean | false | set by `PUT /me/targets { dismiss: true }` |

## Derived (not stored)

- **Board**: `BOARD_DEFS` entry `{ id, group, monthly }`, ids: `workouts`, `streak`, `improved`, `steps`, `prJump`, `strength`, `protein`.
- **Club**: `CLUBS = [{ id: "club225", kg: 225 }, { id: "club300", kg: 300 }, { id: "club400", kg: 400 }, { id: "club450", kg: 450 }, { id: "club500", kg: 500 }]`; `clubOf(stats)` = highest held.
- **Record** (Hall of Fame): `{ id, holder, valueKg | value, date | month }`, ids: `liftBench`, `liftSquat`, `liftDeadlift`, `liftOhp`, `big3`, `longestStreak`, `monthWorkouts`, `monthPrJump`, `monthImproved`, `monthSteps`. Ties go to the earliest date.

## Key patterns summary

| Access | Key |
|---|---|
| Squad timezone | Get `SQUAD#global / SETTINGS` |
| Stats for all members | BatchGet `USER#<sub> / SQUADSTATS` (existing) |
| Viewer's reactions on N items | BatchGet `USER#<author> / RX#<eventId>#<type>#<viewer>` (3 per item) |
| Reactions on one item | Query `USER#<author>`, `begins_with(sk, "RX#<eventId>#")` |
| Migration | Scan `begins_with(sk, "HI5#")` (operator only) |
