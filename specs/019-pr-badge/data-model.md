# Data Model: Live PR Badge (019)

No new DynamoDB items or keys. Two existing items gain fields; both are rebuilt by `refreshSquadStats` and `pnpm admin squad backfill`.

## `USER#<sub>` / `SQUADSTATS` → `lifts[exerciseId]` (feature 010, versioned put)

| Field | Type | Notes |
|---|---|---|
| `prBase` *(new)* | `{ all: PrBests; before: Record<date, PrBests> } \| undefined` | `before` has the exercise's latest 3 entry dates (`GYM_LAST_KEEP`). Absent on stats written before 019 → drawer gets `bests: null`. |
| `prDays[]` | `PrDay` | Existing; extended below. One per exercise per day. |

### `PrBests` (the member's own; never in squad, public, share or MCP responses)

| Field | Type | Rule |
|---|---|---|
| `sessions` | int ≥ 0 | Days with ≥ 1 counted set. 0 → "Baseline set". |
| `bestWeight` | `{ weightKg, reps, date } \| null` | Heaviest counted set (most reps on a tie). |
| `bestE1rm` | `number \| null` | Highest Epley estimate, 1–10 reps only. |
| `frontier` | `{ weightKg, reps }[]` | Non-dominated points, weight descending, reps strictly increasing. `maxRepsAtOrAbove(w)` = reps of the lightest point with `weightKg ≥ w`, else 0. |

Counted set = `isWorkingSet` (completed, reps ≥ 1, weight > 0) and not held by the jump rule (unless trusted/confirmed). Same eligibility as today.

### `PrDay` (extended)

| Field | Type | Notes |
|---|---|---|
| `date`, `weightKg`, `reps`, `e1rm`, `gainKg` | existing | = the top record. `gainKg` is null for a Rep PR. |
| `type` *(new)* | `"weight" \| "reps" \| "e1rm"` | Absent on old stats → read as `"weight"` if `gainKg` came from weight, else `"e1rm"` (only until the backfill). |
| `gainReps` *(new)* | `int \| null` | Rep PR only. |
| `records` *(new)* | `PrRecord[]` | Every PR set that day, top first (≥ 1). |

### `PrRecord` (the spec's "personal record")

| Field | Type | Spec column |
|---|---|---|
| `type` | `"weight" \| "reps" \| "e1rm"` | type |
| `value` | number | value (kg, reps or estimate kg) |
| `previous` | number | previous_value (best before that day) |
| `weightKg`, `reps` | number, int | weight_kg, reps |
| `setIndex` | int ≥ 0 | set_id (position in the entry's `sets`) |
| `achievedAt` | ISO string | achieved_at (entry `updatedAt`) |

user_id = the item's `pk`; exercise_id = the `lifts` key; workout_id = `ENTRY#<date>#<exerciseId>` (date + key).

## `USER#<sub>` / `FEED#pr#<exerciseId>#<date>` (feature 010)

Payload gains `type` and `gainReps`. Old items lack them; the read path defaults both to `null` (shown as before). Event id, one per exercise per day, reactions and the diff are unchanged.

## Not stored

- `PrPreview` (device only): `{ setIndex, type, value, gain, bigJump }` from `previewPr(bests, sets)`.
- Toast figures: from the save response (`prs`, `streakWeeks`) and the drawer's volume.

## State: a PR's life

`typed (badge)` → `saved, ticked, eligible` → **record + feed PR** · `saved, held big jump` → no record → **Looks right** → record + feed PR · `edited/removed so not a PR` → record and feed item gone on the next refresh.
