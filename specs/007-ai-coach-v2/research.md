# Research: AI Coach v2

All Technical Context unknowns are resolved below. Each item: **Decision / Rationale / Alternatives considered**.

## R1. Sharing write rules between the web API and MCP tools

**Decision**: Move the write logic that now sits inside handlers into server-side service functions in `services/api/src/lib`, and have both the HTTP handler and the MCP tool call them:

- `lib/gym-save.ts`: `saveGymEntry(userId, date, exerciseId, input, deps)` (body of `gym-entry-put.ts`: target resolution, strength/cardio check, `gymTotals`/`cardioTotals`, put).
- `lib/food-write.ts`: `createFoodEntry(userId, date, input, deps)` and `patchFoodEntry(userId, date, entryId, patch, deps)` (bodies of `food-entry-post.ts` / `food-entry-put.ts`, non-photo branch).

Each returns `{ ok: true, ... } | { ok: false, status, code, message, fields? }`; handlers map that to `apiError`, tools map it to `fail(message)`.

**Rationale**: FR-007 and SC-005 require "the AI is rejected wherever the member would be". One code path is the only way to guarantee that; handlers stay thin (constitution III).

**Alternatives considered**: MCP tools calling the HTTP API with a minted token (needs a Cognito token for the member, which the MCP key model deliberately avoids); duplicating validation in tools (drifts).

## R2. Log ids exposed to the AI

**Decision**: An opaque string `logId = "<date>#<id>"`, e.g. `2026-11-12#gx-bench-press` (workout, where id is the entry's `workoutId`) and `2026-11-12#<entryId>` (food). `formatLogId` / `parseLogId` live in `packages/shared/src/domain/log-id.ts` (pure, tested). `parseLogId` validates the date and id patterns; anything else is "not found".

**Rationale**: Entries are keyed by `ENTRY#<date>#<id>` / food `FOOD#<date>#<entryId>`; carrying the date inside the id lets `update_workout_calories` take only `logId` (clarification Q5) with a single `GetItem`, and lets the edit window be checked before any read.

**Alternatives considered**: Exposing raw DynamoDB `sk` (leaks storage layout, prefix differs by type); a separate `date` argument (the merged tool spec has only `logId`).

## R3. Storing the AI adjustment and clearing it on member edits

**Decision**: Workout entry items gain an optional `aiNote` (string ≤ 120). 

- `update_workout_calories` → `WorkoutRepo.setAiAdjustment(userId, date, workoutId, { minutes, calories, aiNote }, expectedUpdatedAt, nowIso)`: one `UpdateItem` with `ConditionExpression: attribute_exists(pk) AND updatedAt = :seen`.
- Member edits clear it: `updateEntryMinutes` gains `REMOVE aiNote`; `putGymEntry` is a full `Put`, so the attribute disappears with no change; untick/delete removes the item.
- AI `upsert_workout_log` goes through `saveGymEntry` (full put), so it also clears any earlier adjustment (FR-010).

**Rationale**: Clarification Q2 (member edit resets). Burned totals are derived on read from entry `calories` (`summarize`, `buildFoodDay`), so FR-012 needs no extra writes.

**Alternatives considered**: Separate `aiCalories` field shown instead of `calories` (every consumer would need to pick one: history, ledger, strip, future scoring); a separate adjustment item (second read on every day view).

## R4. Concurrency between the agent and the member (FR-014)

**Decision**: Agent writes on an existing entry use optimistic concurrency: the tool reads the entry, validates, and writes conditionally on the `updatedAt` it read. If the condition fails, the tool returns "This log changed since you read it; call get_full_context again." Member writes stay last-writer-wins, as in 002/006. Every write is a single-item operation, so nothing is ever half-applied.

**Rationale**: The member's latest edit always wins (Q2), so only the agent needs to detect that it is stale. This is the same idea as feature 005's `updateEntryIf` on `photoStatus`.

**Alternatives considered**: Conditional member writes (would make the web show 409s for an AI change the member never saw; rejected for UX).

## R5. Structured coach note storage and the retired markdown note

**Decision**: Reuse the item `USER#<sub>/COACH#<date>`. A v2 note sets `format: 2`, `headline`, `status`, `highlights[]`, `actions: [{ text, done }]`, `updatedAt`, `createdAt`. Posting writes the whole item with `Put` (replacing a markdown note or an earlier v2 note, so ticks reset, FR-015). `CoachRepo.get` returns `null` for items without `format: 2`. `post_daily_coach_note` stays registered but returns an error pointing to `post_overall_coach_note` (FR-016).

**Rationale**: Clarification Q3. One note per day already has the right key; no migration is needed because legacy items simply read as "no note".

**Alternatives considered**: New `COACHV2#` prefix (two items per day, needs cleanup); deleting legacy notes (unnecessary write traffic).

## R6. Ticking action items

**Decision**: `PUT /coach-note/{date}/actions/{index}` with body `{ done: boolean, noteUpdatedAt }`. The repo runs `SET actions[<index>].done = :d` with `ConditionExpression: #f = :two AND updatedAt = :seen AND size(actions) > :index`. If the condition fails (note replaced since the page loaded), respond `409 CONFLICT` and the client reverts the tick and refreshes. Tick changes do **not** bump `updatedAt` (it identifies the note version). Allowed for any date that can hold a note (today − 30 … today); viewing is not limited to the edit window because ticks are not log data.

**Rationale**: FR-017 (survives reload and other devices); the version guard stops a tick from landing on a new note's item at the same index.

**Alternatives considered**: `localStorage` ticks (fails "other devices"); a separate `COACHTICK#` item (extra read).

## R7. Pulse metrics (net calories, protein, gym volume)

**Decision**: `GET /coach-note?date=` returns `{ note, metrics }`; `metrics` is computed only when a note exists, from the same day's food and workout entries: `net` and `protein` from `buildFoodDay(...).ledger`, `gymVolumeKg` from a new pure `dayGymVolume(entries)` (sum of `volumeKg` of gym entries). Pending photo meals are already excluded by `buildFoodDay`.

**Rationale**: Spec says metrics reflect current data (US1 #5), and the ledger math must stay single-sourced (CLAUDE.md, feature 003).

**Alternatives considered**: Copying metrics into the note at post time (goes stale); client-side computation (would need the food day on the Workouts page).

## R8. Where the Pulse Bar loads

**Decision**: Both Workouts pages (`/workouts/gym`, `/workouts`) fetch `/coach-note?date=<view.date>` in the same `Promise.all` as the strip/streak and pass it to a `<PulseBar>` client component placed right after `<DayStrip>`. A failed fetch becomes `null` (no bar), as the Food page does today. No bar is rendered when `note` is null, so there is no reserved gap (US1 #4).

**Rationale**: Fetching with the page avoids the bar popping in after paint; decoration must never break the page.

**Alternatives considered**: Separate `<Suspense>` streaming the bar (layout shift under the strip, which is right where the thumb is).

## R9. Expanded view: inline card vs bottom sheet

**Decision**: One client component. The bar is a `<button aria-expanded aria-controls>`. On click it checks `matchMedia("(min-width: 640px)")`: wide → toggles an inline card below the bar (CSS grid-rows `0fr → 1fr` transition, `motion-reduce:transition-none`); narrow → opens the existing `BottomSheet` (`<dialog>`, Escape closes) from feature 006 with the same card body. Checkboxes are native `<input type="checkbox">` with labels.

**Rationale**: Matches the spec (inline on wide, sheet on phones), reuses the 006 sheet; no new dependency.

**Alternatives considered**: Always a sheet (spec asks for inline on wide); a disclosure/animation library (constitution VII).

## R10. Status accents and glass styling

**Decision**: Tailwind classes only: `h-14 rounded-xl border bg-slate-900/60 backdrop-blur-md` with border tone by status: `on_track` → emerald-400/50, `needs_attention` → amber-400/60, `pr_alert` → fuchsia-400/60, plus an `sr-only` status label ("On track", "Needs attention", "PR alert") so colour is not the only signal. Headline uses `truncate` (`min-w-0 flex-1`).

## R11. Full context window, streak and leaderboard

**Decision**: `get_full_context({ startDate?, endDate? })`, default `today − 6 … today`, validated by the existing `validateHistoryWindow` (≤ 31 days). Streak reuses `currentStreak` over `today − 61 … today` workout summaries (the same as the Workouts pages), from one `listEntriesInRange(min(start, today−61), today)` query. `leaderboard` is always `null` with `leaderboardNote: "Scoring is not built yet"` (FR-006). Day building is shared with `get_user_history` (extracted `buildHistoryDays`).

## R12. Upsert targets: finding exercises and foods by name

**Decision**: `upsert_workout_log` takes `exercise` = id (`gx-…`, `gc-…`) **or** exact name (case- and space-insensitive, `normalizeWorkoutName`) among built-ins and the member's active own exercises. `upsert_food_log` takes either `entryLogId` (update, R2) or a new-entry body: `{ date, meal, food: { builtInId | ownFoodId | name } , servings }` or a typed entry `{ name, calories, macros? }`; a `name` that exactly matches a built-in or own food is treated as that food. Photo entries are refused (FR-011). Activity (002) entries are **not** upserted by the AI: with built-ins removed, they are only the member's own activities, and the request was gym + food.

**Rationale**: Agents speak in names; exact matching avoids silently logging the wrong item. Unknown names fail with the list of close names (up to 5, via the existing `filterExercises` / `searchFoods`).

## R13. Removing the built-in activities

**Decision**: Delete `STANDARD_WORKOUTS` and `findStandardWorkout`; `buildDayView` lists only own workouts, and past entries for `std-*` ids already fall into the existing "removed" rows (shown, counted, removable). `entry-put` no longer creates `std-*` entries (404). `isNameTaken` checks own names only. Web: drop `QUICK_PICK_IDS` quick picks and the `std-*` style map entries (fallback style for old rows), drop the 006 "Strength training" hint, add an empty state linking to `/workouts/mine`.

**Rationale**: FR-022..FR-025 with no data migration; historic totals are untouched (SC-006).

## R14. Body weight

**Decision**: `BodyWeightSchema` = number 20–400, at most one decimal; `DEFAULT_BODY_WEIGHT_KG = 75`; `effectiveBodyWeight(profile) → { kg, isDefault }`. Stored as optional `bodyWeightKg` on `PROFILE`; `ProfileInputSchema` gains `bodyWeightKg: BodyWeightSchema.nullish()` (null clears, as protein does). `OwnProfileSchema` gains `bodyWeightKg: number | null`. `PublicMemberSchema` is unchanged (FR-003); a test asserts it has no `bodyWeightKg`.

## R15. Dependencies

**Decision**: No new dependencies. `react-markdown` (and `lib/coach-markdown.ts` + its test, `components/coach-card.tsx`) are removed, because the markdown note is no longer rendered anywhere.
