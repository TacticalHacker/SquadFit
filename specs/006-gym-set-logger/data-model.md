# Data Model: Gym Set Logger

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Same DynamoDB single table (`pk`/`sk`, `gsi1pk`/`gsi1sk`). No new table or index. All items live in the caller's partition `USER#<sub>`.

## Muscle group (enum)

`chest | back | legs | shoulders | arms | core | cardio`, displayed as Chest, Back, Legs, Shoulders, Arms, Core, Cardio in that order (FR-003).

## Built-in exercise (code constant)

`GYM_EXERCISES` in `packages/shared/src/domain/gym.ts`. Ids are never reused or renamed once shipped.

| Field | Rule |
|---|---|
| `id` | `gx-<slug>` |
| `name` | as in FR-001; unique ignoring case, also unique against `STANDARD_WORKOUTS` names |
| `group` | muscle group |
| `kind` | `strength`, or `cardio` for the two cardio items |
| `rateMinutes`, `rateCalories` | cardio only: `20/140` Incline Treadmill Walk, `20/180` Stairmaster (research R4) |

| Group | Exercises (`gx-` ids) |
|---|---|
| chest | bench-press, incline-dumbbell-press, cable-flyes, chest-dips, machine-chest-press |
| back | deadlift, lat-pulldown, barbell-row, seated-cable-row, pull-ups |
| legs | barbell-squat, leg-press, romanian-deadlift, leg-extension, hamstring-curl, calf-raises |
| shoulders | overhead-press, lateral-raises, face-pulls, rear-delt-flyes |
| arms | barbell-curl, hammer-curl, tricep-pushdown, skullcrushers |
| core | hanging-leg-raises, cable-crunch |
| cardio | incline-treadmill-walk, stairmaster |

## Own exercise (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `GYMEX#gc-<uuid>` |
| `exerciseId` | string | `gc-<uuid>` |
| `name` | string | Trimmed, inner spaces collapsed, 1–40 chars. Unique among the member's non-removed own exercises and all built-in exercise names, ignoring case (FR-005) |
| `group` | enum | any muscle group except `cardio` (own exercises are strength only, research R4) |
| `createdAt` / `updatedAt` | ISO datetime | |
| `removedAt` | ISO datetime? | Soft remove (FR-005) |

At most 50 non-removed own exercises per member (create beyond → 409 `LIMIT_REACHED`); bounds the "last" fan-out (research R5).

## Gym entry (item, a kind of workout entry)

Shares the `ENTRY#` key space with feature 002 so every day total includes it (research R1).

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `ENTRY#<YYYY-MM-DD>#<exerciseId>` (one per member, exercise and day, FR-017) |
| `gsi1pk` | string | `GYM#<sub>#<exerciseId>` (research R5) |
| `gsi1sk` | string | `<YYYY-MM-DD>` |
| `kind` | `"gym"` | Absent on feature 002 entries (read as `"workout"`) |
| `date` | string | Member's local date; never changes |
| `workoutId` | string | The `exerciseId` (`gx-…` / `gc-…`); same attribute name as 002 entries |
| `name` | string | Exercise name snapshot at save time (FR-018) |
| `muscleGroup` | enum | Group snapshot at save time |
| `exerciseKind` | `strength \| cardio` | |
| `sets` | list | Strength only, 1–20 items, ordered: `{ setNumber: 1..n (contiguous), reps: int 1–100, weightKg: 0–500 multiple of 0.5, completed: bool }` |
| `volumeKg` | number | Strength only; `gymTotals` (one decimal) |
| `minutes` | int | Strength: `round(sets × 2.5)`; cardio: entered 1–600 |
| `calories` | int | Strength: `sets × 15`; cardio: `caloriesFor(rateMinutes, rateCalories, minutes)` |
| `rateMinutes` / `rateCalories` | int | Strength: `5` / `30` (= 6 kcal/min; keeps the 002 `StoredEntry` shape valid, never used for gym math); cardio: the exercise rate snapshot |
| `createdAt` / `updatedAt` | ISO datetime | `createdAt` kept on replace |

The client never sends `volumeKg`, `minutes` (strength) or `calories`; the server computes them from `sets` (FR-014).

**Write rules (server-enforced)**:
- Same day rules as feature 002 (FR-020): future → 400; older than `today−2` → 409 `DAY_LOCKED`.
- To save, the exercise must be built-in or one of the member's non-removed own exercises, **unless** an entry already exists for that day (it can be re-saved / removed even if the own exercise was removed since). A re-save keeps the entry's existing `name`/`muscleGroup` snapshot (FR-018), and locked days are never written.
- `PUT|DELETE /workouts/entries/{date}/{workoutId}` (feature 002) return 404 for ids starting `gx-`/`gc-` (research R2).

### State of one (member, exercise, day) slot

```
            save (PUT sets|minutes)               save (PUT)
 absent ──────────────────────────▶ present ───────────────────▶ present (replaced)
   ▲                                   │
   └────────── remove (DELETE) ────────┘
```

## Drawer state (client, not stored on the server)

`packages/shared/src/domain/gym-drawer.ts` (research R7).

| Field | Rule |
|---|---|
| `mode` | `strength` \| `cardio` |
| `defaultReps` | int 1–100, init 10 (or, when pre-filled, the reps of the last row) |
| `rows[]` | `{ weightKg, reps, completed, repsEdited }`, length 1–20 |
| `minutes` | cardio: int 1–600, init 20 or last entry's minutes |
| `dirty` | true once any action changed state from its initial value |

Init order: draft (if any) → saved entry for this day → last earlier entry (`completed=false`, `repsEdited=false`) → defaults `3 × 10 × 0 kg`.

## Draft (browser `localStorage`, never sent to the server)

Key `sf:gymdraft:v1:<userId>:<date>:<exerciseId>`; value `{ v: 1, savedAt, baseUpdatedAt: string | null, state }` validated by `GymDraftSchema`. Removed on Save, Remove, Discard, or when `date < today − 2` (FR-023, research R8).

## Derived

- **Day view** (`buildDayView`, extended): `rows` (002 workouts, unchanged), `gym: GymEntryView[]` (this day's gym entries by `createdAt`), `summary` = Σ minutes / calories over both, `gymMinutes` = Σ gym minutes (FR-025 hint).
- **Gym view** (`buildGymView`): `exercises[]` (built-in in catalog order, then own alphabetically) each with `entry` (this day, or null) and `last` (`{ date, sets | minutes, top: { weightKg, reps } }` or null); plus `date`, `today`, `editable`, `summary`.

## Access patterns

| Pattern | Operation |
|---|---|
| Day's entries (workouts + gym) | `Query pk, sk begins_with ENTRY#<date>#` (unchanged) |
| Range totals (strip, streak, ledger, AI) | unchanged `ENTRY#` range query: includes gym |
| Own exercises | `Query pk, sk begins_with GYMEX#`, filter `removedAt` |
| Last earlier entry for exercise X before D | `Query gsi1 gsi1pk = GYM#<sub>#X AND gsi1sk < D`, `ScanIndexForward=false`, `Limit=1` (one per listed exercise, in parallel) |
| Save | `PutItem` full item (research R14) |
| Remove | `DeleteItem` (idempotent) |
| Own exercise create / edit / remove | `PutItem` (`attribute_not_exists`) / `UpdateItem` (`attribute_exists AND attribute_not_exists(removedAt)`) / `UpdateItem SET removedAt` |
