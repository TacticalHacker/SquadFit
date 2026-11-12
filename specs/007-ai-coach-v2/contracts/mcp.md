# Contract: MCP tools (`POST /mcp`, feature 004 server)

Same transport, auth (operator-issued `sfk_…` bearer key), rate limit (60 requests/min per member) and conventions as feature 004: tools act only as the key's member, never take a user id (unknown keys such as `userId` are stripped), validate input with zod shapes from `packages/shared/src/contracts/coach.ts`, and return `{ isError: true }` text on failure without echoing input values. Nothing about notes, reasons, entries or body weight is logged.

**Edit window** for every write on logs: `today − 2 … today` in the member's timezone (clarification Q1). Outside → `"That day can no longer be changed (only today and the 2 previous days)."` Future → `"Date cannot be in the future"`.

**logId**: `"<YYYY-MM-DD>#<id>"` (research R2). Ids that don't parse, don't exist or aren't the member's all return `"Log not found"`.

## Tool list after this feature

| Tool | Status |
|---|---|
| `get_user_history` | changed (adds body weight, log ids) |
| `get_full_context` | **new** |
| `update_workout_calories` | **new** |
| `upsert_workout_log` | **new** |
| `upsert_food_log` | **new** |
| `post_overall_coach_note` | **new** |
| `post_daily_coach_note` | retired: always returns an error pointing to `post_overall_coach_note` |
| `update_user_targets`, `list_pending_food_photos`, `get_food_photo`, `submit_food_estimate` | unchanged |

`update_workout_log` from the original request is merged into `update_workout_calories` (clarification Q5).

## get_full_context

Input: `{ startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }`. Default `today−6 … today`; one given → the other defaults to it ± 6 days, clamped to today. `validateHistoryWindow` rules (≤ 31 days, end ≤ today).

Output (JSON text):

```jsonc
{
  "today": "2026-11-12", "timezone": "Asia/Kolkata",
  "profile": {
    "bodyWeightKg": 75, "bodyWeightIsDefault": true,
    "calorieTarget": 2200, "proteinTarget": 140        // null when unset
  },
  "editableFrom": "2026-11-10",                        // oldest date the AI may write
  "streak": 4,                                         // provisional rule: consecutive days with a workout
  "leaderboard": null, "leaderboardNote": "Scoring is not built yet",
  "days": [{
    "date": "2026-11-12",
    "workouts": [
      { "logId": "2026-11-12#gx-bench-press", "kind": "gym", "name": "Bench press", "muscleGroup": "chest",
        "exerciseKind": "strength", "minutes": 8, "calories": 45, "aiNote": null,
        "sets": [{ "set": 1, "reps": 8, "weightKg": 60, "done": true }], "volumeKg": 1440 },
      { "logId": "2026-11-12#c-ab12", "kind": "activity", "name": "Padel", "minutes": 60, "calories": 420, "aiNote": null }
    ],
    "food": [
      { "logId": "2026-11-12#01J…", "meal": "breakfast", "name": "Eggs", "servings": 2, "calories": 156,
        "protein": 12.6, "carbs": 1.2, "fat": 10.6, "source": "standard" },
      { "logId": "2026-11-12#01K…", "meal": "lunch", "name": "Photo meal", "source": "photo", "status": "pending", "calories": 0 }
    ],
    "totals": { "eaten": 156, "burned": 465, "net": -309, "protein": 12.6, "carbs": 1.2, "fat": 10.6, "gymVolumeKg": 1440 },
    "coachNote": { "headline": "…", "status": "on_track" }   // or null
  }]
}
```

Pending photo meals are listed but not counted; the response adds the same `next` hint as `get_user_history` when any are pending.

## get_user_history (changed)

Unchanged input and existing fields. Adds top-level `profile.bodyWeightKg` / `profile.bodyWeightIsDefault`, and `logId` on every workout and food line, plus `aiNote` on workout lines and `exerciseKind` on gym lines.

## update_workout_calories

```ts
{ logId: string,
  updatedCalories: int 1–5000,
  updatedDurationMins: int 1–600,
  reasoning: string 1–120, no line breaks }   // e.g. "6.0 MET compound lift + rest intervals @ 78kg"
```

Works on gym and activity entries. Reads the entry, checks the edit window, then conditionally writes `calories`, `minutes`, `aiNote = reasoning` on the `updatedAt` it read (research R4). Sets and volume are untouched.

Success: `"Updated Bench press on 2026-11-12: 45 → 62 kcal, 8 → 14 min. Day burned: 465 → 482 kcal."`
Errors: `Log not found` · day locked · `"This log changed since you read it; call get_full_context again."` · validation messages per field.

## upsert_workout_log

```ts
{ date: "YYYY-MM-DD",
  exercise: string,                     // "gx-…" / "gc-…" id, or exact exercise name (case/spacing ignored)
  sets?: [{ reps: int 1–100, weightKg: number 0–500 step 0.5, completed?: boolean = true }] (1–20),
  minutes?: int 1–600 }                 // cardio exercises only
```

Creates or replaces the member's entry for that exercise and day through the same `saveGymEntry` the app uses (research R1): set numbers are assigned in order, minutes/calories/volume come from `gymTotals` / `cardioTotals`, any `aiNote` is cleared. No calories/volume input is accepted. Wrong shape for the exercise kind → error naming the field. Unknown name → `"Exercise not found. Close matches: …"` (≤ 5) or none.

Success: `"Saved Bench press on 2026-11-12: 3 sets, 1440 kg volume, 23 kcal. logId 2026-11-12#gx-bench-press"`.

## upsert_food_log

Either update or create:

```ts
// update an existing non-photo entry (same rules as PUT /food/entries)
{ logId: string, meal?: Meal, servings?: number, name?: string, calories?: int, protein?, carbs?, fat? }

// create
{ date: "YYYY-MM-DD", meal: "breakfast"|"lunch"|"dinner"|"snacks",
  food: string,              // built-in id, own food id, or exact name of either; otherwise a free-form name
  servings?: number,         // list foods only (default 1)
  calories?: int 1–5000,     // free-form only (required then)
  protein?, carbs?, fat? }   // free-form only, all three or none
```

Uses `createFoodEntry` / `patchFoodEntry` (research R1), so list foods follow servings × rate and free-form entries take the given values. A `logId` that points at a photo entry → `"Photo meals are filled with submit_food_estimate"`. Calories for list foods are refused (`"Calories follow the servings for foods from a list"`).

Success: `"Logged 2 × Eggs (156 kcal) for breakfast on 2026-11-12. logId 2026-11-12#01J…"`.

## post_overall_coach_note

```ts
{ date: "YYYY-MM-DD",                   // today or up to 30 days ago
  headline: string 1–65, single line,
  status: "on_track" | "needs_attention" | "pr_alert",
  highlights: string[1..3], each 1–120,
  actionItems: string[0..3], each 1–80 }
```

Replaces any note for that date (ticks reset). Success: `"Coach note saved for 2026-11-12."`

Tool description tells the agent: the headline shows on one line in a compact bar; highlights cover gym and nutrition; action items are things the member can tick off today.

## post_daily_coach_note (retired)

Still listed with its old input shape so old agents get a clear answer. Always returns `isError` with: `"This tool was replaced. Use post_overall_coach_note with a headline, status, highlights and actionItems."`
