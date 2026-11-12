# Quickstart: AI Coach v2

Validation guide. Shapes are in [contracts/mcp.md](contracts/mcp.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md) and [data-model.md](data-model.md).

## Prerequisites

- A member with a completed profile and an AI key: `pnpm admin create-user`, then `pnpm admin ai-key issue <user>`.
- `pnpm install`, `pnpm deploy:dev` (AWS creds), `pnpm dev` with `API_URL` pointing at dev.
- An MCP client pointed at `<api>/mcp` with `Authorization: Bearer sfk_…` (e.g. Claude with a custom connector, or `npx @modelcontextprotocol/inspector`).
- A phone or devtools at 375 × 667 for the sheet checks.

## 1. Automated checks

```sh
pnpm check
pnpm synth     # new route coach-action-put; mcp function unchanged grants
```

Must include failing-first tests for (constitution III): `BodyWeightSchema` / `effectiveBodyWeight`, `formatLogId`/`parseLogId` round-trip and rejects, `dayGymVolume`, overall-note schema limits (65 / 3 / 120 / 80), `buildDayView` without built-ins (past `std-*` entry becomes a removed row and still counts), `aiNote` carried into `DayView`/`GymEntryView`. Handler/tool tests with fakes: every new tool's success and rejection paths (wrong day, someone else's log id, stale `updatedAt`, photo entry via `upsert_food_log`, unknown exercise name), retired `post_daily_coach_note`, `PUT /coach-note/.../actions/...` 404/409, member minutes edit clears `aiNote`, `PublicMemberSchema` has no `bodyWeightKg`.

## 2. Body weight (US5)

Settings → Body weight shows empty with placeholder 75 and helper text. Enter `78.5`, save, reload: `78.5`. Enter `500`: range error, nothing saved. `/people` and another member's views never show it.

## 3. Full context (US3, SC-004)

Call `get_full_context` with no arguments → 7 days, `profile.bodyWeightKg: 78.5`, `bodyWeightIsDefault: false`, `streak` equals the 🔥 number on Workouts, `leaderboard: null`. Every workout and food line has a `logId`; gym lifts list sets.

## 4. AI calorie recalculation (US2, SC-003)

1. In the app, log Bench Press today: 3 × 8 × 60 kg → 23 kcal.
2. Call `update_workout_calories` with its `logId`, `updatedCalories: 62`, `updatedDurationMins: 14`, `reasoning: "6.0 MET compound lift + rest intervals @ 78kg"`.
3. Gym tab: row shows 62 kcal with **✨ AI adjusted**; tap → reason appears. Day summary, week strip bar, `/food` burned and `get_user_history` all show +39 kcal vs before.
4. Open Bench Press, change a set, save → app estimate returns, badge gone.
5. Call the tool with a `logId` from 3 days ago → locked error; with a made-up id → `Log not found`.
6. Stale write: call `get_full_context`, then edit the entry in the app, then call `update_workout_calories` → "changed since you read it".

## 5. AI logging (US4)

`upsert_workout_log { date: today, exercise: "bench press", sets: [{reps:8,weightKg:60},{reps:8,weightKg:60}] }` → replaces today's entry (2 sets, app-computed kcal). `exercise: "Benchpress"` → not found with close matches. `upsert_food_log { date: today, meal: "breakfast", food: "eggs", servings: 2 }` → list-food entry. A free-form `{ food: "Grandma's dal", calories: 320 }` → typed entry. Using a photo entry's `logId` → refused.

## 6. Pulse Bar (US1, SC-001, SC-002)

1. Call `post_overall_coach_note { date: today, headline: "Chest PR today, protein 30 g short — add a shake tonight", status: "pr_alert", highlights: [...3], actionItems: ["Protein shake after dinner", "10 min walk", "Sleep by 11"] }`.
2. `/` → Gym tab: bar under the date strip, 56 px, fuchsia edge, headline ellipsised on a 375 px screen. Switch to Activities: same bar.
3. Tap → phone: bottom sheet; desktop: inline card. Metrics match `/food` net and protein and the Gym volume. Tick "10 min walk"; reload on another browser → still ticked.
4. Post a new note for today → ticks reset. Tick on the old page → "This note was updated; refresh" and the tick reverts.
5. Select a day with no note → no bar, no gap. `/food` → no coach block.
6. Keyboard: Tab to bar, Enter opens, Space toggles a checkbox, Escape closes the sheet. Screen reader announces "expanded" and the status label.
7. `post_daily_coach_note` → error telling the agent to use `post_overall_coach_note`.

## 7. Built-in activities removed (US6, SC-006)

Activities tab for a member with no own activities: no built-ins, empty state links to My workouts. A day last week with "Running" logged still shows it and its kcal in the strip. Create own activity "Running" → accepted.
