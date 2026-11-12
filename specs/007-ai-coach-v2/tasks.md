---
description: "Task list for 007-ai-coach-v2"
---

# Tasks: AI Coach v2

**Input**: Design documents from `specs/007-ai-coach-v2/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/mcp.md](contracts/mcp.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md)

**Tests**: Required. Constitution III makes domain tests test-first (write them, see them fail, then implement); every handler and MCP tool is tested with the in-memory fakes in `services/api/test/fakes.ts`; new routes get CDK assertions.

**Organization**: Grouped by user story (US1–US6 from spec.md). Paths are repo-relative. Before writing Next.js code, read the relevant parts of `apps/web/node_modules/next/dist/docs/` (apps/web/AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 from spec.md

---

## Phase 1: Setup

- [X] T001 Read `apps/web/node_modules/next/dist/docs/` on Server Actions, `useOptimistic`/`router.refresh`, and Cache Components/Suspense; note differences from the features 004–006 usage in a scratch note (no repo file).

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: log ids, body weight in the profile and MCP context, and the shared write services that the AI tools and HTTP handlers both use (research R1, R2, R14).

### Tests first (must fail before implementation)

- [X] T002 [P] Write tests in `packages/shared/test/log-id.test.ts`: `formatLogId("2026-11-12","gx-bench-press") === "2026-11-12#gx-bench-press"`; `parseLogId` round-trips; rejects missing `#`, bad/unreal dates (`2026-02-30`), empty id, ids with whitespace or a second `#`, ids over 80 chars → `null`.
- [X] T003 [P] Write tests in `packages/shared/test/profile.test.ts` (extend): `BodyWeightSchema` accepts 20, 78.5, 400; rejects 19.9, 400.1, 78.55, NaN, strings; `DEFAULT_BODY_WEIGHT_KG === 75`; `effectiveBodyWeight({})` → `{ kg: 75, isDefault: true }`, `effectiveBodyWeight({ bodyWeightKg: 80 })` → `{ kg: 80, isDefault: false }`.
- [X] T004 [P] Write tests in `packages/shared/test/me-contracts.test.ts` (new or extend existing contract test): `ProfileInputSchema` accepts `bodyWeightKg` number/null/absent and rejects 500; `OwnProfileSchema` parses `bodyWeightKg: null` default; `PublicMemberSchema.shape` has no `bodyWeightKg` key (FR-003).

### Implementation

- [X] T005 [P] Create `packages/shared/src/domain/log-id.ts` with `formatLogId(date, id)` and `parseLogId(logId) → { date, id } | null` (date via `DateSchema`, id `^[A-Za-z0-9_-]{1,80}$`); export from `packages/shared/src/index.ts`.
- [X] T006 [P] In `packages/shared/src/domain/profile.ts` add `BodyWeightSchema` (number, min 20, max 400, at most 1 decimal; message "Must be between 20 and 400 kg, at most one decimal"), `DEFAULT_BODY_WEIGHT_KG = 75`, `effectiveBodyWeight(p: { bodyWeightKg?: number | null }) → { kg, isDefault }`.
- [X] T007 In `packages/shared/src/contracts/me.ts` add `bodyWeightKg: BodyWeightSchema.nullish()` to `ProfileInputSchema` and `bodyWeightKg: z.number().nullable().default(null)` to `OwnProfileSchema`; leave `PublicMemberSchema` unchanged.
- [X] T008 In `services/api/src/lib/profile-repo.ts` add optional `bodyWeightKg` to `ProfileItem` and `fromItem`; in `upsert` set it when a number is given, `REMOVE` it when `null`, leave it when `undefined` (same pattern as `dailyProteinTarget`); update the fake in `services/api/test/fakes.ts` identically.
- [X] T009 In `services/api/src/lib/views.ts` add `bodyWeightKg: item.bodyWeightKg ?? null` to `toOwnProfile`; extend `services/api/test/me-profile-put.test.ts` (or the existing profile test) for set / clear / keep.
- [X] T010 In `services/api/src/lib/mcp/types.ts` add `bodyWeight: { kg: number; isDefault: boolean }` to `ToolContext`; fill it in `services/api/src/handlers/mcp.ts` with `effectiveBodyWeight(profile)`; update the MCP test context helper(s) under `services/api/test/`.
- [X] T011 Extract the body of `services/api/src/handlers/gym-entry-put.ts` (target resolution, kind check, `gymTotals`/`cardioTotals`, `putGymEntry`) into `services/api/src/lib/gym-save.ts` as `saveGymEntry(userId, date, exerciseId, input: GymEntryPut, deps) → { ok: true, entry } | { ok: false, status, code, message, fields? }`; the handler becomes parse → `resolveWriteDate` → `saveGymEntry` → `loadGymSaveResult`. Existing `services/api/test/gym-entry.test.ts` must pass unchanged.
- [X] T012 Extract `services/api/src/handlers/food-entry-post.ts` and the non-photo branch of `food-entry-put.ts` into `services/api/src/lib/food-write.ts` as `createFoodEntry(userId, date, input: EntryCreate, deps)` (returns the new `entryId`) and `patchFoodEntry(userId, date, entryId, patch: EntryPatch, deps)` (refuses photo entries with `{ status: 400, message: "Photo meals are filled with submit_food_estimate" }` when called with `{ fromAgent: true }`; the handler keeps its own photo branch). Existing food handler tests must pass unchanged.

**Checkpoint**: `pnpm check` green; no behavior change visible in the app.

---

## Phase 3: User Story 1 - See the AI coach's verdict at a glance (P1) 🎯 MVP

**Goal**: The agent posts a structured note; both Workouts tabs show the Pulse Bar under the date strip; it expands to metrics, highlights and tickable actions; Food has no coach block.

**Independent Test**: quickstart §6.

### Tests first

- [X] T013 [P] [US1] Write tests in `packages/shared/test/coach-note.test.ts` (extend): `OverallNoteInputSchema` accepts a valid note; rejects headline "" / 66 chars / containing `\n`, unknown `status`, 0 or 4 highlights, highlight of 121 chars, 4 action items, action of 81 chars, empty strings after trim; `validateNoteDate` unchanged.
- [X] T014 [P] [US1] Write tests in `packages/shared/test/gym.test.ts` (extend): `dayGymVolume([])` = 0; sums `volumeKg` of `kind: "gym"` entries only; ignores cardio (no `volumeKg`) and activity entries.
- [X] T015 [P] [US1] Write `services/api/test/mcp-overall-note.test.ts`: `post_overall_coach_note` saves (repo item has `format: 2`, `actions` with `done: false`), replaces an earlier note and resets ticks, rejects future date / > 30 days ago / invalid fields without echoing values, strips a stray `userId`; `post_daily_coach_note` returns `isError` with the text pointing to `post_overall_coach_note` and writes nothing.
- [X] T016 [P] [US1] Write `services/api/test/coach-note-get.test.ts` (replace existing): no note → `{ note: null, metrics: null }`; legacy markdown item → nulls; v2 note → note fields plus `metrics` from current food + workout entries (`netCalories` = ledger net, `proteinG` = ledger protein, `gymVolumeKg` = `dayGymVolume`), pending photo meals excluded; future date → 400.
- [X] T017 [P] [US1] Write `services/api/test/coach-action-put.test.ts`: tick sets `done`, un-tick clears; returns `{ actions }`; missing note / legacy note → 404; `noteUpdatedAt` mismatch → 409 `VALIDATION_FAILED` with `fields._`; index ≥ actions length → 409; index not 0–2 or bad body → 400; date > 30 days ago or future → 400; ticking does not change `updatedAt`.

### Implementation

- [X] T018 [US1] In `packages/shared/src/domain/coach-note.ts` add `HEADLINE_MAX = 65`, `HIGHLIGHT_MAX = 120`, `ACTION_MAX = 80`, `MAX_HIGHLIGHTS = 3`, `MAX_ACTIONS = 3`, `COACH_STATUSES = ["on_track","needs_attention","pr_alert"]`; remove the markdown-only constants once nothing imports them.
- [X] T019 [US1] In `packages/shared/src/domain/gym.ts` add `dayGymVolume(entries: readonly StoredEntry[]): number`.
- [X] T020 [US1] In `packages/shared/src/contracts/coach.ts` add `CoachStatusSchema`, `OverallNoteShape`/`OverallNoteInputSchema` (date; headline 1–65 single line; status; highlights 1–3 × 1–120; actionItems 0–3 × 1–80; all trimmed), `OverallNoteSchema` (`{ date, headline, status, highlights, actions: {text, done}[], generatedBy: "AI", updatedAt }`), `PulseMetricsSchema` (`{ netCalories: int, proteinG: number, gymVolumeKg: number }`), `CoachPulseResponseSchema` (`{ note, metrics }` both nullable), `CoachActionPutSchema` (strict `{ done: boolean, noteUpdatedAt: iso datetime }`), `CoachActionsResponseSchema`; remove `CoachNoteSchema`/`CoachNoteResponseSchema` and keep `CoachNoteShape` only for the retired tool.
- [X] T021 [US1] Rewrite `services/api/src/lib/coach-repo.ts`: `CoachNoteItem` v2 (`format: 2`, headline, status, highlights, actions, generatedBy, createdAt, updatedAt); `get` returns `null` unless `format === 2`; `put` does a full `Put` of the item with `createdAt = updatedAt = now`; `setActionDone(userId, date, index, done, expectedUpdatedAt) → "ok" | "missing" | "conflict"` using `SET actions[i].done = :d` with condition `#f = :two AND updatedAt = :seen AND size(actions) > :i` (on failure, a `get` tells "missing" from "conflict"). Update the fake in `services/api/test/fakes.ts`.
- [X] T022 [US1] In `services/api/src/lib/mcp/tools.ts`: add `post_overall_coach_note` (parse `OverallNoteInputSchema` after `stripUnknown`, `validateNoteDate`, `coach.put`); change `post_daily_coach_note` to always `fail("This tool was replaced. Use post_overall_coach_note with a headline, status, highlights and actionItems.")`. The description says the headline shows on one line in a compact bar.
- [X] T023 [US1] Rewrite `services/api/src/handlers/coach-note-get.ts` to return `CoachPulseResponse`: when a v2 note exists, load the day's food and workout entries in parallel and compute metrics with `buildFoodDay` (same inputs as `food-day-loader`) and `dayGymVolume`.
- [X] T024 [US1] Create `services/api/src/handlers/coach-action-put.ts` (`handle(event, deps)`): `loadDayContext`, date must pass `validateNoteDate` (400 otherwise), `index` 0–2, body `CoachActionPutSchema`, `setActionDone`, map results to 200/404/409, return the note's `actions`.
- [X] T025 [US1] In `infra/lib/api-stack.ts` add `route("coach-action-put", HttpMethod.PUT, "/coach-note/{date}/actions/{index}", { write: true })`; assert route + write grant in `infra/test/stacks.test.ts`.
- [X] T026 [US1] Create `apps/web/src/server/actions/coach.ts` with Server Action `setCoachAction(date, index, done, noteUpdatedAt)` calling `PUT /coach-note/{date}/actions/{index}` via `apiFetch` and returning `{ ok: true, actions } | { ok: false, conflict: boolean, message }`.
- [X] T027 [US1] Create `apps/web/src/components/pulse-bar.tsx` (client) per contracts/web.md: collapsed `<button aria-expanded aria-controls>` `h-14 rounded-xl bg-slate-900/60 backdrop-blur-md border` tinted by status (on_track emerald-400/50, needs_attention amber-400/60, pr_alert fuchsia-400/60) with `sr-only` status text, `✨` (aria-hidden), `truncate` headline, `View ▾` chevron; on activate use `matchMedia("(min-width: 640px)")` → inline card (grid-rows 0fr→1fr transition, `motion-reduce:transition-none`) or the feature 006 `BottomSheet` titled "AI coach"; card body = full headline, 3-cell metric strip (Net calories signed kcal, Protein g with `/ target` when given, Gym volume kg with thousands separators), highlights `<ul>`, action checklist (`<input type="checkbox">` + label, ≥ 44 px rows) with optimistic toggle → `setCoachAction` → on failure revert + inline message, on conflict `router.refresh()`.
- [X] T028 [US1] In `apps/web/src/app/(app)/workouts/gym/page.tsx` and `apps/web/src/app/(app)/workouts/page.tsx` fetch `/coach-note?date=${view.date}` with `CoachPulseResponseSchema` inside the existing `Promise.all` (`.catch(() => null)`), and render `<PulseBar>` right after `<DayStrip>` only when `note` is non-null; pass the member's protein target (from `requireProfile`) for the "/ target" label.
- [X] T029 [US1] Remove the coach note from `apps/web/src/app/(app)/food/page.tsx` (fetch + `CoachCard`); delete `apps/web/src/components/coach-card.tsx`, `apps/web/src/lib/coach-markdown.ts`, `apps/web/src/lib/coach-markdown.test.ts`; remove `react-markdown` from `apps/web/package.json` and run `pnpm install`.

**Checkpoint**: quickstart §6 passes.

---

## Phase 4: User Story 2 - AI recalculates gym calories realistically (P1)

**Goal**: `update_workout_calories` sets calories, duration and a one-line reason; every total follows; the badge shows the reason; member edits reset it.

**Independent Test**: quickstart §4.

### Tests first

- [X] T030 [P] [US2] Extend `packages/shared/test/day-view.test.ts` and `packages/shared/test/gym-view.test.ts`: `aiNote` on a stored entry appears as `entry.aiNote` on its row and on `GymEntryView.aiNote`; absent → `null`; summaries use the stored (AI) calories.
- [X] T031 [P] [US2] Write `services/api/test/mcp-workout-calories.test.ts`: success on a gym and on an activity entry (calories, minutes, `aiNote` stored; sets/volume untouched; text reports old → new and the day's burned before → after); food ledger `burned` from `loadFoodDay` reflects it; rejects unparseable / unknown / another user's `logId` as "Log not found"; day older than today−2 → locked message; future → error; calories 0/5001, minutes 0/601, reasoning ""/121 chars/with newline → field errors; stale `updatedAt` (fake changes the item between read and write) → "changed since you read it".
- [X] T032 [P] [US2] Extend `services/api/test/entry-put.test.ts` and `services/api/test/gym-entry.test.ts`: changing minutes on an entry with `aiNote` recomputes calories from the rate and removes `aiNote`; saving a gym entry drops `aiNote`.

### Implementation

- [X] T033 [US2] In `packages/shared/src/domain/day-view.ts` add `aiNote?: string` to `StoredEntry`, `aiNote: string | null` to `DayEntry`; carry it in `buildDayView` rows. In `packages/shared/src/domain/gym.ts` carry it in `toGymEntryView`. Add `AI_NOTE_MAX = 120` to `coach-note.ts`. Update `DayViewSchema` (`packages/shared/src/contracts/workouts.ts`) and `GymEntryViewSchema` (`packages/shared/src/contracts/gym.ts`) with `aiNote: z.string().nullable()`; keep `applyChange` clearing `aiNote` on `setMinutes`.
- [X] T034 [US2] In `services/api/src/lib/workout-repo.ts`: read `aiNote` in `toEntry`; `updateEntryMinutes` adds `REMOVE aiNote`; add `setAiAdjustment(userId, date, workoutId, { minutes, calories, aiNote }, expectedUpdatedAt, nowIso) → "ok" | "missing" | "conflict"` (condition `attribute_exists(pk) AND updatedAt = :seen`). Mirror in `services/api/test/fakes.ts` (with a hook to simulate a concurrent change).
- [X] T035 [US2] Add `UpdateWorkoutCaloriesShape` / schema to `packages/shared/src/contracts/coach.ts`: `logId: string`, `updatedCalories: int 1–5000`, `updatedDurationMins: int 1–600`, `reasoning: string trimmed 1–120, no line breaks`.
- [X] T036 [US2] Create `services/api/src/lib/mcp/writes.ts` with `updateWorkoutCalories` tool: `parseLogId`, editable-day check with `isEditableDay(date, ctx.today)` (future → "Date cannot be in the future"; locked → "That day can no longer be changed (only today and the 2 previous days)."), `workouts.getEntry`, compute day burned before/after with `summarize`, `setAiAdjustment` on the read `updatedAt`; export `writeTools` and add them to `TOOLS` in `services/api/src/lib/mcp/tools.ts`.
- [X] T037 [P] [US2] Create `apps/web/src/components/ai-badge.tsx` (client): `<button aria-expanded>` "✨ AI adjusted" (text-xs, muted, ≥ 24 px hit area padded to 44 within row), toggles a one-line `role="note"` reason below; Escape and outside click close.
- [X] T038 [US2] Show `AiBadge` next to calories for logged gym rows (`apps/web/src/components/exercise-list.tsx` / `gym-screen.tsx`) and logged activity rows (`apps/web/src/components/workout-checklist.tsx`), only when `aiNote` is non-null.

**Checkpoint**: quickstart §4 passes.

---

## Phase 5: User Story 3 - AI reads the whole picture in one call (P2)

**Goal**: `get_full_context` returns profile figures with body weight, all logs with ids, totals incl. gym volume, streak and `leaderboard: null`; `get_user_history` gains body weight and ids.

**Independent Test**: quickstart §3.

### Tests first

- [X] T039 [P] [US3] Write `services/api/test/mcp-full-context.test.ts`: default window = today−6…today; explicit window validated (> 31 days, end after today, start after end → errors); profile block with `bodyWeightKg` 75 + `bodyWeightIsDefault: true` when unset and the stored value otherwise; every workout and food line has a `logId` that `parseLogId` accepts; gym lifts carry sets and `volumeKg`, activities carry `kind: "activity"`; `aiNote` present; totals include `gymVolumeKg`; `streak` equals `currentStreak` over 62 days; `leaderboard: null` with note; `editableFrom` = today−2; v2 coach note summary per day; pending photo meals listed, not counted, with the `next` hint; nothing about other members.
- [X] T040 [P] [US3] Extend `services/api/test/mcp-history.test.ts`: response has `profile.bodyWeightKg`/`bodyWeightIsDefault`, `logId` on every workout and food line, `aiNote` on workouts, `exerciseKind` on gym lines; existing assertions still hold.

### Implementation

- [X] T041 [US3] Create `services/api/src/lib/mcp/history.ts` with `buildHistoryDays(ctx, startDate, endDate, food, workouts, notes?)` (moved from `getUserHistory`), adding `logId` (`formatLogId`), `aiNote`, `exerciseKind`, `kind: "gym" | "activity"`, `source` on food, and `gymVolumeKg` in totals; `get_user_history` in `tools.ts` uses it and adds the `profile` block.
- [X] T042 [US3] Add `FullContextShape` / schema (`startDate?`, `endDate?`) to `packages/shared/src/contracts/coach.ts` and the `get_full_context` tool in `services/api/src/lib/mcp/tools.ts`: resolve the default window, `validateHistoryWindow`, one `workouts.listEntriesInRange(min(start, today−61), today)` + `food.listEntriesInRange(start, end)` + v2 notes per day in parallel (add `CoachRepo.listInRange(userId, from, to)` with a `begins_with`/`BETWEEN` query on `COACH#`, plus fake), streak via `summarize` per day + `currentStreak`, `leaderboard: null`, `leaderboardNote: "Scoring is not built yet"`.

**Checkpoint**: quickstart §3 passes.

---

## Phase 6: User Story 4 - AI logs and corrects entries for the member (P2)

**Goal**: `upsert_workout_log` and `upsert_food_log` write through the shared services with the member's rules.

**Independent Test**: quickstart §5.

### Tests first

- [X] T043 [P] [US4] Extend `packages/shared/test/gym.test.ts`: `findGymExerciseByName("  bench   PRESS ", own)` finds the built-in; finds an own exercise by name; removed own exercises are ignored; unknown → `null`.
- [X] T044 [P] [US4] Write `services/api/test/mcp-upserts.test.ts`: `upsert_workout_log` by id and by name creates an entry with app-computed minutes/calories/volume (set numbers assigned 1..n, `completed` default true); second call replaces (one entry per exercise/day) and clears `aiNote`; cardio needs `minutes` and strength needs `sets` (field errors); unknown name → "Exercise not found" with ≤ 5 close matches; locked day refused. `upsert_food_log` create with built-in id, own food name, and free-form name + calories (+ all-or-none macros); list food with `calories` refused; update by `logId` (servings on list entry, calories on typed entry); photo entry `logId` refused; locked day and unknown `logId` refused.

### Implementation

- [X] T045 [US4] Add `findGymExerciseByName(name, own)` to `packages/shared/src/domain/gym.ts` using `normalizeWorkoutName`.
- [X] T046 [US4] Add `UpsertWorkoutShape` and `UpsertFoodShape` (+ strict schemas, refine: update form `logId` vs create form `date`+`meal`+`food`) to `packages/shared/src/contracts/coach.ts` per contracts/mcp.md.
- [X] T047 [US4] Add `upsert_workout_log` to `services/api/src/lib/mcp/writes.ts`: resolve exercise (id → `findGymExercise`/own; else name via `findGymExerciseByName` over `gym.listOwnExercises`), edit-window check, map sets to `GymSet` with `setNumber` 1..n, call `saveGymEntry`; success text per contracts/mcp.md including the `logId`.
- [X] T048 [US4] Add `upsert_food_log` to `services/api/src/lib/mcp/writes.ts`: update form → `parseLogId` + window + `patchFoodEntry(..., { fromAgent: true })`; create form → resolve `food` (built-in id, own id, exact built-in/own food name compared after trimming, collapsing spaces and ignoring case, else typed) into an `EntryCreate`, window check, `createFoodEntry`; success text with `logId`.

**Checkpoint**: quickstart §5 passes.

---

## Phase 7: User Story 5 - Member sets their body weight (P2)

**Goal**: Body weight field in Settings.

**Independent Test**: quickstart §2.

- [X] T049 [US5] Add the **Body weight (kg)** field to the profile form used by `apps/web/src/app/(app)/settings/page.tsx` (and its form component / Server Action under `apps/web/src/server/actions/`): `type="number" inputMode="decimal" step="0.1" min="20" max="400"`, 16 px text, placeholder `75`, helper "Used by your AI coach for calorie estimates. 75 kg is used until you set it."; empty → `null`; show `BodyWeightSchema` errors; prefill from `profile.bodyWeightKg`. Make sure the setup page (`apps/web/src/app/setup/page.tsx`) still submits without it.

**Checkpoint**: quickstart §2 passes.

---

## Phase 8: User Story 6 - Activities list without built-in activities (P3)

**Goal**: Only own activities; past built-in entries keep working.

**Independent Test**: quickstart §7.

### Tests first

- [X] T050 [P] [US6] Update `packages/shared/test/day-view.test.ts` and `packages/shared/test/workouts.test.ts` (or wherever `isNameTaken` is tested): no built-in rows; a past `std-running` entry appears as a `removed: true` row with its saved name/minutes/calories and counts in `summary`; `isNameTaken("Running", [])` is `false`.
- [X] T051 [P] [US6] Update `services/api/test/entry-put.test.ts` / `entry-delete.test.ts` / custom workout tests: creating `std-running` → 404; changing minutes on an existing `std-running` entry and deleting it still work; own workout named "Running" is accepted.

### Implementation

- [X] T052 [US6] Remove `STANDARD_WORKOUTS` and `findStandardWorkout` from `packages/shared/src/domain/workouts.ts`; make `isNameTaken` own-names only; in `packages/shared/src/domain/day-view.ts` build rows from own workouts only and drop `isStandard` (and from `WorkoutRowSchema` in `packages/shared/src/contracts/workouts.ts`); fix every import (`services/api/src/handlers/entry-put.ts` creates only from own workouts).
- [X] T053 [US6] Web: in `apps/web/src/lib/workout-style.ts` drop `QUICK_PICK_IDS` and the `std-*` entries (old rows use the default style); in `apps/web/src/components/workout-checklist.tsx` remove quick picks and the "Logged in Gym" Strength-training hint, and add the empty state "No activities yet. Add the ones you do, like padel or a morning run." linking to `/workouts/mine` when there are no rows.

**Checkpoint**: quickstart §7 passes.

---

## Phase 9: Polish & Cross-Cutting

- [X] T054 [P] Update `CLAUDE.md`: add a "AI Coach v2 (feature 007)" section (tools list, logId format, `aiNote` lifecycle, v2 `COACH#` note + action ticks route, Pulse Bar placement, body weight, no built-in activities); fix the feature 004 lines that mention `react-markdown`, `post_daily_coach_note` and the note on `/food`, and the feature 002 line about `STANDARD_WORKOUTS`.
- [X] T055 [P] Grep `services/api/src` for `console.` calls added in this feature and make sure none logs notes, reasons, entries, names or body weight (FR-026).
- [X] T056 Run `pnpm check` and `pnpm synth`; fix failures.
- [ ] T057 Walk through quickstart §2–§7 against dev (manual; record anything that could not be run).

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** → stories. Phase 2 blocks everything (log ids, body weight in context, write services).
- **US1** (Phase 3) is independent of the other stories.
- **US2** (Phase 4) needs Phase 2 only; T038 touches `workout-checklist.tsx`, which **US6** T053 also edits, so do them in order (US2 before US6).
- **US3** (Phase 5) needs T033 (`aiNote` on `StoredEntry`) from US2 for the `aiNote` field; otherwise independent.
- **US4** (Phase 6) needs Phase 2 (T011, T012) and shares `writes.ts` with US2 (T036 creates the file).
- **US5** (Phase 7) needs T007–T009 only.
- **US6** (Phase 8) after US2 (shared files `day-view.ts`, `workout-checklist.tsx`).
- `packages/shared/src/contracts/coach.ts` and `services/api/src/lib/mcp/tools.ts` are edited by US1, US2, US3, US4: same-file tasks run sequentially.

## Parallel Examples

- Phase 2 tests: T002, T003, T004 together; then T005 and T006 together.
- US1 tests: T013–T017 together.
- US2: T030, T031, T032 together; T037 (badge) alongside T034–T036.
- US3: T039, T040 together.
- US6: T050, T051 together.

## Implementation Strategy

1. **MVP** = Phase 1 + 2 + US1 (Pulse Bar with structured notes, Food block removed): demo with a hand-posted note.
2. Add US2 (AI calories + badge), the main value of the richer access.
3. Add US3 (full context), US4 (AI logging) and US5 (Settings field).
4. Finish with US6 (built-ins removed) and polish.
5. Run `pnpm check` at every checkpoint.
