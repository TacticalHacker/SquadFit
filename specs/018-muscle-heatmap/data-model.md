# Data Model: Daily Muscle Heatmap (018)

**Nothing is stored.** No DynamoDB items, keys, attributes or migrations. All entities below are in-memory values derived from the member's own `GymView` (feature 006) in `packages/shared/src/domain/muscle-map.ts`.

## MuscleRegion

Fixed enum of 15 ids (spec FR-001).

| id | Label | Side |
|---|---|---|
| chest | Chest | front |
| front-delts | Front delts | front |
| biceps | Biceps | front |
| forearms | Forearms | front |
| abs | Abs | front |
| quads | Quads | front |
| traps | Traps | back |
| upper-back | Upper back | back |
| lats | Lats | back |
| rear-delts | Rear delts | back |
| triceps | Triceps | back |
| lower-back | Lower back | back |
| glutes | Glutes | back |
| hamstrings | Hamstrings | back |
| calves | Calves | back |

Exports: `MUSCLE_REGIONS` (ordered as above), `MuscleRegion`, `MUSCLE_REGION_LABELS`, `MUSCLE_REGION_SIDE`.

## ExerciseMuscles

`{ primary: MuscleRegion[]; secondary: MuscleRegion[] }`

- `MUSCLE_MAP`: built-in strength exercise id → row, exactly as in [research.md R6](research.md#r6-built-in-exercise-mapping-fr-002).
- `GROUP_FALLBACK`: chest → [chest]; back → [lats, upper-back]; legs → [quads, hamstrings, glutes]; shoulders → [front-delts]; arms → [biceps, triceps]; core → [abs]; cardio → [].
- `musclesFor(exerciseId, group)`: table row if present, else `{ primary: GROUP_FALLBACK[group], secondary: [] }`.

**Invariants** (checked by test): every built-in with `kind: "strength"` has a row with ≥ 1 primary; no region is both primary and secondary in a row; no cardio id has a row.

## RegionLoad / DayMuscleLoad

Per region for one day:

| Field | Meaning |
|---|---|
| `direct` | logged sets of exercises where the region is primary |
| `indirect` | logged sets of exercises where the region is secondary |
| `score` | `direct + 0.5 × indirect` |
| `step` | `0 | 1 | 2 | 3` from `heatStep(score)` |

`dayMuscleLoad(entries: { exerciseId; muscleGroup; exerciseKind; sets }[]) → Record<MuscleRegion, RegionLoad>`

- A logged set = any saved set with `reps >= 1`, ticked or not (research R3); cardio entries are skipped.
- `heatStep`: `score = 0` → 0; `0 < score < 3` → 1; `3 ≤ score < 6` → 2; `score ≥ 6` → 3.
- The figure is hidden when every region has `score = 0` (FR-009); helper `hasMuscleLoad(load)`.

Worked example (spec FR-007): 4 × Bench Press + 2 × Tricep Pushdown →
chest `{4, 0, 4, 2}`, front-delts `{0, 4, 2, 1}`, triceps `{2, 4, 4, 2}`, all others `{0, 0, 0, 0}`.

## Region filter

`exercisesForRegion(exercises: GymExerciseView[], region) → GymExerciseView[]`: strength exercises whose `musclesFor(exerciseId, group)` includes `region`; exercises logged on the day first, then the input order. Client state only (`region | null` in `GymScreen`), never in the URL or storage.
