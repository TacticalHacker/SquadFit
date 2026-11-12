# Data Model: AI Coach v2

Single table, existing keys. No new GSI, no new item type. Changes are new attributes on existing items.

## Member profile: `pk = USER#<sub>`, `sk = PROFILE` (changed)

| Attribute | Type | Rule |
|---|---|---|
| `bodyWeightKg` | number, optional | 20–400, at most 1 decimal (`BodyWeightSchema`). Absent = 75 kg default (`effectiveBodyWeight`). Written by `PUT /me/profile`; `null` in the input removes it. |

Visible only to the member (own profile) and their AI key. Never in `PublicMemberSchema` or `/people`.

## Workout entry: `pk = USER#<sub>`, `sk = ENTRY#<date>#<workoutId>` (changed)

Covers activities (feature 002) and gym entries (`kind: "gym"`, feature 006).

| Attribute | Type | Rule |
|---|---|---|
| `aiNote` | string, optional | 1–120 chars, single line. Present ⇔ `calories`/`minutes` were last set by the AI (`update_workout_calories`). |

State transitions:

```text
            update_workout_calories (conditional on updatedAt)
 app-computed ─────────────────────────────────────────────► AI-adjusted (aiNote set)
      ▲                                                         │
      └──── member edit (minutes / sets) or AI upsert ──────────┘   (aiNote removed, app math restored)
```

- Member minutes change (`updateEntryMinutes`): `SET minutes, calories, updatedAt REMOVE aiNote`.
- Gym save from member or AI (`putGymEntry`): full `Put`, so no `aiNote`.
- Untick/delete removes the item.
- `calories` stays the single figure every reader sums (day summary, strip, food ledger `burned`, AI history). No stored daily totals exist, so nothing goes stale.

Built-in activity ids `std-*` are no longer creatable; existing `std-*` items are unchanged and keep counting.

## Overall coach note: `pk = USER#<sub>`, `sk = COACH#<date>` (changed format)

| Attribute | Type | Rule |
|---|---|---|
| `format` | `2` | Marks a v2 note. Items without it (feature 004 markdown notes) read as "no note". |
| `date` | `YYYY-MM-DD` | today − 30 … today (`validateNoteDate`). |
| `headline` | string | 1–65 chars after trim, single line. |
| `status` | `"on_track" \| "needs_attention" \| "pr_alert"` | |
| `highlights` | string[] | 1–3 items, each 1–120 chars. |
| `actions` | `{ text: string; done: boolean }[]` | 0–3 items, text 1–80 chars; `done` starts `false`. |
| `generatedBy` | `"AI"` | |
| `createdAt`, `updatedAt` | ISO datetime | `updatedAt` is the note version; ticks do not change it. |

- Post (`post_overall_coach_note`): `Put` of the whole item, so ticks reset (FR-015).
- Tick (`PUT /coach-note/{date}/actions/{index}`): `SET actions[i].done = :d` if `format = 2 AND updatedAt = :seen AND size(actions) > :i`, otherwise 409.

## Log id (not stored)

`logId = "<date>#<id>"`, where id is the workout entry's `workoutId` or the food entry's `entryId`. Built and parsed only by `formatLogId` / `parseLogId` (`packages/shared/src/domain/log-id.ts`).

## Derived views (not stored)

- **Pulse metrics** `{ netCalories, proteinG, gymVolumeKg }`: `buildFoodDay(...).ledger.net`, `.ledger.macros.protein`, `dayGymVolume(workoutEntries)`.
- **Full context** (MCP): profile figures, logs with ids, daily totals incl. `gymVolumeKg`, `streak`, `leaderboard: null`.

## Pure domain additions (`packages/shared/src/domain`, test-first)

| Module | Exports |
|---|---|
| `profile.ts` | `BodyWeightSchema`, `DEFAULT_BODY_WEIGHT_KG`, `effectiveBodyWeight` |
| `log-id.ts` (new) | `formatLogId`, `parseLogId` |
| `coach-note.ts` | `HEADLINE_MAX = 65`, `HIGHLIGHT_MAX = 120`, `ACTION_MAX = 80`, `MAX_HIGHLIGHTS = 3`, `MAX_ACTIONS = 3`, `AI_NOTE_MAX = 120`, `CoachStatus` |
| `gym.ts` | `dayGymVolume`, `findGymExerciseByName` |
| `day-view.ts` | rows from own workouts only; `DayEntry.aiNote`; `GymEntryView.aiNote` |
| `workouts.ts` | remove `STANDARD_WORKOUTS`, `findStandardWorkout`; `isNameTaken` checks own names only |
