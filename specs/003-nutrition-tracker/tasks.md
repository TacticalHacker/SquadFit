---
description: "Task list for 003 Nutrition Tracker"
---

# Tasks: Nutrition Tracker

**Input**: Design documents from `specs/003-nutrition-tracker/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md). Features 001 and 002 are on `main`.

**Tests**: Included. Constitution III requires failing tests first for domain logic (research R11). Every test task comes **before** the code that makes it pass and MUST fail first (run it and see it fail).

**Organization**: Grouped by user story so each can be built and verified on its own. Route registration and its CDK assertion live with the story that adds the route.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repo root

## Lessons carried over from 001 and 002 (apply throughout)

- Handlers are written as `handle(event, deps)` plus `export const handler = (e) => handle(e, getDeps())`; tests call `handle` with fakes from `services/api/test/fakes.ts`.
- Read the session only inside `<Suspense>`; `getMe()` is memoised per request with React `cache()`. Read `apps/web/AGENTS.md` and the Next 16 docs before writing Next code. Page components with `redirect()` need an explicit `Promise<null>` return type.
- Never log request bodies or tokens. API responses for one user never include another user's data.
- CDK bundling needs each handler entry file to exist before `pnpm synth` or the infra tests run.
- A shell chain with `&&` stops at the first failure (BSD `sed -i` needs `''`); prefer Python or the editor tools for edits.
- Range queries over `FOODLOG#` use `~` as the upper bound (it sorts after every id character).
- Dark-card styling for new screens follows the Workouts redesign (`bg-[#0F172A]` panel, `bg-[#1E293B]` cards); `nodeLinker: hoisted` stays in `pnpm-workspace.yaml` for Amplify.

---

## Phase 1: Setup

- [X] T001 Confirm the baseline on branch `003-nutrition-tracker`: `pnpm install && pnpm check && pnpm synth` all green. This feature adds **no new dependencies** (plan Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared rules and contracts, the repository, and the day-context changes every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared domain: tests first

- [X] T002 [P] Write failing tests in `packages/shared/test/nutrition.test.ts`:
  - `scaleCalories(rateCalories, servings) = Math.round(rateCalories × servings)`: (250, 1.5) → 375; (95, 0.5) → 48 (47.5 rounds up); (1, 0.5) → 1; (5000, 20) → 100000 (callers enforce the 5,000 cap)
  - `scaleGrams(grams, servings) = Math.round(Math.round(grams × 10) × servings) / 10`: (1.3, 1.5) → 2; (3.5, 1.5) → 5.3; (0.5, 0.5) → 0.3; (0, 7) → 0; no floating-point artefacts such as `1.9500000000000002`
  - `ServingsSchema` accepts 0.5, 1, 1.5, 20; rejects 0, 0.25, 0.7, 20.5, 21, `NaN`, negatives, with the message "Servings must be from 0.5 to 20 in steps of 0.5"
  - `CaloriesSchema` accepts whole 1–5,000; rejects 0, 5001, 99.5, `NaN`, with "Calories must be a whole number from 1 to 5,000"
  - `MacrosSchema` `{ protein, carbs, fat }` each 0–500 with at most one decimal; rejects -1, 500.1, 12.34; `MAX_MACRO_GRAMS = 500`
  - `MEALS` is `["breakfast","lunch","dinner","snacks"]` in that order
  - `completeMacros(input)`: all blank/undefined → `null`; any given → all three with blanks as 0 (analysis C1)
- [X] T003 [P] Write failing tests in `packages/shared/test/foods.test.ts`:
  - catalog invariants for `STANDARD_FOODS`: exactly 40 items; ids unique and matching `^sf-[a-z0-9-]+$`; names unique ignoring case; `name` 1–60 chars, `serving` 1–40 chars; `calories` integer 1–5,000; macros 0–500 with at most one decimal; values equal the table in [research R1](research.md#r1-built-in-food-catalog-lives-in-code)
  - energy sanity: for every food `|calories − (4·protein + 4·carbs + 9·fat)| ≤ 10% of calories`
  - `normalizeFoodName(" Mom's  Paratha ")` → `"mom's paratha"`
  - `FoodNameSchema` trims, collapses inner spaces, requires 1–60 chars (FR-002)
  - `OwnFoodInputSchema` `{ name, serving, calories, macros? }`: serving 1–40 chars, calories whole 1–5,000, macros all-or-none (FR-021), per-field messages
  - `isOwnFoodNameTaken(name, existingOwnNames)` is true for a repeat ignoring case and spacing, and **false** for a built-in name such as "dal" (FR-021)
- [X] T004 [P] Write failing tests in `packages/shared/test/food-day.test.ts`:
  - `entryFromFood(food, servings)` returns `{ servings, rate, calories, macros }` using `scaleCalories` and `scaleGrams`; macros absent when the food has none
  - `buildFoodDay({ date, today, timezone, target, entries, burnedCalories })`: four meals always present in `MEALS` order; entries in the order given (the order added); per-meal `subtotal`; `eaten`, `burned`, `net = eaten − burned`, `remaining = target − net` (negative when over); `editable` from `isEditableDay`; macro totals sum only entries that have macros in whole tenths (no `0.30000000000000004`) with `entriesWithoutMacros` counting entries with none; an empty day gives zeros and `remaining = target`
  - `applyFoodChange(view, change)` for `{type:"add", entry}` (adds to its meal, updates subtotal, ledger and macro totals), `{type:"update", entryId, patch}` (typed: name/calories/macros/meal; list: servings/meal with calories and macros recomputed **from the entry's own rate**), `{type:"remove", entryId}`; equivalence: for a set of changes, `applyFoodChange` output equals `buildFoodDay` rebuilt from the entries the server would store
  - `defaultMealForHour(h)`: 0–10 → breakfast, 11–14 → lunch, 15–17 → snacks, 18–23 → dinner (clarification Q4); `localHour(instant, tz)` gives the hour in that zone (check `Asia/Kolkata` and `America/Los_Angeles` at one instant)
- [X] T005 [P] Write failing tests in `packages/shared/test/recent-foods.test.ts`: `recentFoods(entries, 20)` keeps one item per normalized name (trimmed, collapsed, case-insensitive) using the **latest** entry (by `date`, then `entryId`), returns `{ name, calories, macros }` with the display name of the latest entry, orders most recent first, caps at 20, and is empty for no entries (FR-022, clarification Q5)

### Shared domain & contracts: implementation

- [X] T006 [P] Implement `packages/shared/src/domain/nutrition.ts` (`MIN_CALORIES_ENTRY = 1`, `MAX_CALORIES_ENTRY = 5000` or reuse the existing calorie limits from `calories.ts` without clashing names, `MAX_MACRO_GRAMS`, `MEALS`, `Meal`, `ServingsSchema`, `CaloriesSchema`, `MacrosSchema`, `scaleCalories`, `scaleGrams`) so T002 passes
- [X] T007 [P] Implement `packages/shared/src/domain/foods.ts` (`STANDARD_FOODS` with the 40 rows from research R1, `findStandardFood`, `FoodNameSchema`, `normalizeFoodName`, `OwnFoodInputSchema`, `isOwnFoodNameTaken`) so T003 passes
- [X] T008 Implement `packages/shared/src/domain/food-day.ts` (`entryFromFood`, `buildFoodDay`, `applyFoodChange`, `defaultMealForHour`, `localHour`, types `FoodEntry`, `FoodDayView`, `FoodChange`) using T006–T007 and 002's `summarize`-style whole-tenths summing so T004 passes
- [X] T009 [P] Implement `packages/shared/src/domain/recent-foods.ts` (`recentFoods`) so T005 passes
- [X] T010 [P] Create `packages/shared/src/contracts/food.ts`: `EntryCreateSchema` (discriminated union on `kind`: `typed` `{ meal, name, calories, macros? }`, `standard` and `own` `{ meal, foodId, servings }`), `EntryPatchSchema` (all optional: `name`, `calories`, `macros`, `meal`, `servings`), `FoodEntrySchema`, `FoodDayViewSchema` (shape in contracts/api.md "Food day view", `macros` nullable, `rate` on every entry), `RecentFoodsResponseSchema`, `OwnFoodSchema`, `OwnFoodsResponseSchema`, `OwnFoodResponseSchema`; no new error codes
- [X] T011 Export the new modules from `packages/shared/src/index.ts`; run `pnpm --filter @calci/shared test && pnpm --filter @calci/shared typecheck` (all green)

### API foundation (test-first where logic exists)

- [X] T012 [P] Create `services/api/src/lib/food-repo.ts`: `interface FoodRepo` with `listEntriesForDay(userId, date)`, `listEntriesInRange(userId, from, to)` (upper bound `FOODLOG#<to>~`), `getEntry(userId, date, entryId)`, `putEntry(userId, entry)` (condition `attribute_not_exists(sk)`), `updateEntry(userId, date, entryId, fields, nowIso)` (condition `attribute_exists(pk)`, returns false if absent), `deleteEntry`, `listOwnFoods`, `getOwnFood`, `putOwnFood`, `updateOwnFood` (returns false if absent), `deleteOwnFood` (returns whether it existed); `DynamoFoodRepo` with keys `FOODLOG#<date>#<entryId>` and `FOOD#<foodId>` per [data-model.md](data-model.md); a pure `newEntryId(nowMs, random)` producing `<13-digit epoch ms>-<6 hex>`
- [X] T013 [P] Extend `services/api/test/fakes.ts`: `InMemoryFoodRepo` implementing `FoodRepo` (sorted by sk like Dynamo), `makeDeps` returns `food` and wires it into `Deps`, and a helper `seedWorkoutEntry(workouts, userId, date, calories)` for ledger tests
- [X] T014 Write failing tests: extend `services/api/test/day-context.test.ts` so `loadDayContext` also returns `target` (the profile's `dailyCalorieTarget`) and update the existing equality assertions accordingly
- [X] T015 Extend `services/api/src/lib/day-context.ts` (`DayContext.target`) so T014 passes; extend `services/api/src/lib/deps.ts` with `food: FoodRepo` (`DynamoFoodRepo(TABLE_NAME)`); fix any 002 test that builds a `DayContext` by hand
- [X] T016 Create `services/api/src/lib/food-day-loader.ts`: `loadFoodDay(userId, ctx, date, deps)` reads the day's food entries and that day's workout entries (`deps.workouts.listEntriesForDay`), sums the workout calories, and returns `buildFoodDay(...)` (used by every route that returns a food day view)

**Checkpoint**: `pnpm check` green. No food routes exist yet; the API package has the repository, helpers and shared rules.

---

## Phase 3: User Story 1 - Log what I ate (Priority: P1) 🎯 MVP

**Goal**: A user adds typed food entries to the four meals, edits and removes them, and they persist.

**Independent Test**: quickstart 3–5, 9–13, 17. Add "Banana, 100" to Snacks, reload and see it, edit it, remove it.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T017 [P] [US1] Write failing tests in `services/api/test/food-get.test.ts`: no profile → 409 `PROFILE_REQUIRED`; a new user gets four empty meals in order and `date === today`, `editable: true`; entries of **another user** never appear; a future `date` → 400; entries are in the order added
- [X] T018 [P] [US1] Write failing tests in `services/api/test/food-entry-post.test.ts` (typed only): creates an entry under `FOODLOG#<date>#<entryId>` with `source: "typed"`, `servings: 1`, `rate` equal to the entered values, the meal and the user's date; name is trimmed and inner spaces collapsed, 1–60 chars; calories whole 1–5,000 with `fields.calories` = "Calories must be a whole number from 1 to 5,000" for 0, 5001, 99.5 and a missing value; empty name → `fields.name`; macros: any of protein/carbs/fat given → the other two stored as 0, none given → `macros: null`, each 0–500 with one decimal; the same name twice creates two separate entries (FR-005); unknown `meal` → 400; `DAY_LOCKED` for a day three back and 400 for a future date, nothing stored; two users never see each other's entries
- [X] T019 [P] [US1] Write failing tests in `services/api/test/food-entry-put.test.ts` (typed only): edits `name`, `calories`, `macros`, `meal` (the entry moves meal but keeps its date and `entryId`); sending `servings` for a typed entry → 400; invalid values → 400 with field messages and the stored entry unchanged; unknown entry → 404 `NOT_FOUND`; another user's entry id → 404; `DAY_LOCKED` three days back
- [X] T020 [P] [US1] Write failing tests in `services/api/test/food-entry-delete.test.ts`: removes the entry and returns the day view; deleting an absent entry succeeds (idempotent); `DAY_LOCKED` three days back; cannot delete another user's entry (no effect)

### Implementation for User Story 1

- [X] T021 [US1] Implement `services/api/src/handlers/food-get.ts` (`GET /food`): `loadDayContext`, `resolveReadDate(query.date)`, `loadFoodDay` → 200 food day view (T017 green)
- [X] T022 [US1] Implement `services/api/src/handlers/food-entry-post.ts` (`POST /food/entries/{date}`) for `kind: "typed"`: `resolveWriteDate`, parse `EntryCreateSchema`, fill missing macros with 0 when any is given, `newEntryId(deps.now().getTime(), random)`, `putEntry`, return the day view. List kinds return 400 "Not supported yet" until US4 (T018 green)
- [X] T023 [US1] Implement `services/api/src/handlers/food-entry-put.ts` (`PUT /food/entries/{date}/{entryId}`) for `typed` entries: load the entry first (absent → 404), reject fields not allowed for the source, validate, `updateEntry`, return the day view. List entries return 400 until US4 (T019 green)
- [X] T024 [US1] Implement `services/api/src/handlers/food-entry-delete.ts` (`DELETE /food/entries/{date}/{entryId}`): `resolveWriteDate`, `deleteEntry`, day view (T020 green)
- [X] T025 [US1] Register `GET /food` (read), `POST /food/entries/{date}`, `PUT` and `DELETE /food/entries/{date}/{entryId}` (`write: true`) in `infra/lib/api-stack.ts` with the JWT authorizer, and add assertions to `infra/test/stacks.test.ts` that these four route keys exist and have `AuthorizationType: JWT`; run `pnpm --filter @calci/infra test` and `pnpm synth`
- [X] T026 [US1] Create Server Actions in `apps/web/src/server/actions/food.ts` (`"use server"`): `addTypedEntry(date, input)`, `updateEntry(date, entryId, patch)`, `removeEntry(date, entryId)` call the API via `apiFetch` with `FoodDayViewSchema` and return `{ ok: true, view } | { ok: false, error, fields? }`; validate `date` with `DateSchema` and ids with their patterns; `UnauthorizedError` → `redirect("/sign-in")`; `PROFILE_REQUIRED` → `redirect("/setup")`; `DAY_LOCKED` → "This day can no longer be edited"; `NOT_FOUND` on update/remove → "That entry was already removed"; anything else → "Couldn't save. Try again."
- [X] T027 [P] [US1] Create `apps/web/src/lib/food-input.ts` with tests-first `apps/web/src/lib/food-input.test.ts`: `parseCaloriesInput(raw)` and `parseGramsInput(raw)` built on the shared schemas, rejecting `""` (calories), `"0"`, `"5001"`, `"99.5"`, `"abc"`, `"4e3"` with the shared messages; blank grams mean "not entered"; `"12.34"` rejected
- [X] T028 [US1] Create `apps/web/src/components/food-screen.tsx` (client): props `initialView`; `useOptimistic` + `useTransition` over `applyFoodChange`; four meal sections with subtotals and entries (name, calories, macros), an **Add** button per meal opening a quick-entry form (name, calories, optional protein/carbs/fat) that adds optimistically with a temporary id; tapping an entry expands inline editing for a typed entry and a Remove action; entries with a temporary id are not editable; failures show the message in a `role="alert"` region; dark-card styling per the Workouts redesign
- [X] T029 [US1] Create `apps/web/src/app/(app)/food/page.tsx`: inside `<Suspense>` call `requireProfile()` then `apiFetch("/food?date=…", { schema: FoodDayViewSchema })` and render the page and `FoodScreen`; accept `?date=` (validated with `DateSchema`, invalid → `redirect("/food")`, API 400 → `redirect("/food")`); add a **Food** link after Workouts in `apps/web/src/components/nav-links.tsx`
- [ ] T030 [US1] Run `pnpm check`, `pnpm synth` and `pnpm --filter @calci/web build` (all green); deploy with `pnpm --filter @calci/infra exec cdk deploy --all -c stage=dev --require-approval never` and run quickstart 1–3, 5, 9–13, 17 (`curl` for the API parts; browser for the rest); note results in `specs/003-nutrition-tracker/quickstart.md` under "Validation log"

**Checkpoint**: MVP. A user can log typed food into meals, edit and remove it, and see it persist.

---

## Phase 4: User Story 2 - See my day: eaten, burned and net (Priority: P1)

**Goal**: A ledger above the meals shows eaten, burned, net, remaining against the target and macro totals, updating as the user logs.

**Independent Test**: quickstart 3, 14–16. Log food and a workout; check eaten, burned, net, remaining.

### Tests for User Story 2 ⚠️

- [X] T031 [P] [US2] Write failing tests in `services/api/test/food-ledger.test.ts`: with food entries of 300 and 100 kcal and a seeded workout entry burning 300 kcal the view's `ledger` is `{ eaten: 400, burned: 300, net: 100, target, remaining: target − 100 }`; over the target gives a negative `remaining`; changing the profile target later changes `remaining` only for the new target while entries stay unchanged; `burned` equals the sum of that user's workout entries for that date and never includes other users' or other dates'; macro totals and `entriesWithoutMacros` follow the entries (SC-003, SC-007, SC-009)
- [X] T032 [P] [US2] Write failing tests in `services/api/test/food-timezone.test.ts`: with a fixed clock of `2026-11-11T20:00:00Z`, an `Asia/Kolkata` user's entry is stored under `2026-11-12` and shows in their "today", an `America/Los_Angeles` user's under `2026-11-11`; changing the profile timezone later moves **no** existing entry (FR-015); each user sees only their own (SC-004)

### Implementation for User Story 2

- [X] T033 [US2] Make T031–T032 pass (fix `buildFoodDay`, `loadFoodDay` or the handlers where they fail; no behaviour changes expected beyond what the tests prove)
- [X] T034 [P] [US2] Create `apps/web/src/components/food-ledger.tsx`: a card showing **remaining** (or "N kcal over", neutral wording) against the target as a bar, with eaten, burned and net, the protein/carbs/fat totals in grams and a "Some entries have no macros" note when `entriesWithoutMacros > 0`; `aria-live="polite"`, reading the optimistic view
- [X] T035 [US2] Render `FoodLedger` above the meals in `apps/web/src/components/food-screen.tsx` so it reads the same optimistic view (updates on add/edit/remove without a refresh, FR-009 and FR-011); verify quickstart 3, 14–16 in the browser and log the result

**Checkpoint**: US1 + US2 work independently.

---

## Phase 5: User Story 3 - Look at and fix recent days (Priority: P2)

**Goal**: Day navigation; the last three days are editable and older days read-only; the screen follows local midnight.

**Independent Test**: quickstart 19–24.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Extend `services/api/test/food-get.test.ts` with failing cases: past dates return their entries and ledger; `editable` is true for `today`, `today−1`, `today−2` and false for `today−3`; with the clock advanced past local midnight the day that was `today−2` becomes `editable: false`; a date years back loads
- [X] T037 [P] [US3] Extend `services/api/test/food-entry-post.test.ts`, `food-entry-put.test.ts` and `food-entry-delete.test.ts` with failing cases for the window edges: add/edit/remove on `today−2` succeeds; on `today−3` → 409 `DAY_LOCKED` with "This day can no longer be edited" and nothing stored; **after** advancing the clock across midnight the previously editable `today−2` is refused

### Implementation for User Story 3

- [X] T038 [US3] Confirm T036–T037 pass against the existing handlers (fix `day-context` or the handlers if not)
- [X] T039 [P] [US3] Generalise `apps/web/src/components/day-nav.tsx` with a `basePath` prop (`"/workouts"` or `"/food"`) and an optional `streak` (the streak badge shows only when given); update the Workouts page call site; no visual change on Workouts
- [X] T040 [US3] Update `apps/web/src/app/(app)/food/page.tsx`: render `DayNav` (`basePath="/food"`); a future date redirects to `/food` (FR-016); when `editable` is false show the banner "This day can no longer be edited" and render the screen read-only (no Add, edit or Remove)
- [X] T041 [US3] In `apps/web/src/components/food-screen.tsx`, on window focus, `visibilitychange` and every 60 s call `router.replace("/food")` when `hasDayChanged(new Date(), timezone, today)` (reusing `apps/web/src/lib/rollover.ts`, FR-018); every mutation already carries the displayed `date`. Verify quickstart 19–24 and log the results

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Pick from food lists (Priority: P2)

**Goal**: Search the built-in list, own foods and recent foods; add with servings; manage own foods.

**Independent Test**: quickstart 6–8, 25–30.

### Tests for User Story 4 ⚠️

- [X] T042 [P] [US4] Extend `services/api/test/food-entry-post.test.ts` with failing cases for list kinds: `standard` `sf-oats` at 1.5 servings stores `source: "standard"`, `foodId`, `name`, `serving`, a `rate` snapshot, `calories: 375` and macros `15 / 57 / 9`; servings 0, 0.25, 21 → 400 with `fields.servings` = "Servings must be from 0.5 to 20 in steps of 0.5"; a combination whose calories fall outside 1–5,000 → 400 on `servings`; unknown `sf-` id → 404; `own` food of the caller works; another user's own food id → 404; a removed own food → 404
- [X] T043 [P] [US4] Extend `services/api/test/food-entry-put.test.ts` with failing cases for list entries: `{ servings: 2 }` recomputes calories and macros from the **entry's own rate** (edit the own food's calories afterwards; the entry still uses the old rate); `{ meal }` moves it; `name`, `calories` or `macros` → 400 "Calories and macros follow the servings for foods from a list"; an entry whose own food was deleted can still be edited and removed (FR-008)
- [X] T044 [P] [US4] Write failing tests in `services/api/test/own-foods.test.ts`: `POST /food/foods` creates `f-<uuid>` and returns `{ food }`, trims the name, validates serving (1–40), calories and macros (all-or-none) with per-field messages; `409 DUPLICATE_NAME` for a repeat ignoring case and spacing, but **allowed** for a built-in name like "Dal"; `PUT` edits (own name allowed), 404 for another user's id and for `sf-` ids, `409` on clash with another own food; `DELETE` removes it, 404 for others' and built-in ids; entries already logged are unchanged after edit or delete; `GET /food/foods` lists only the caller's, A to Z; no profile → 409
- [X] T045 [P] [US4] Write failing tests in `services/api/test/food-recent.test.ts`: `GET /food/recent` returns one item per normalized name with the latest entry's calories and macros, most recent first, at most 20; entries older than 90 days (relative to `today`) are excluded and entries from exactly `today−89` included; only the caller's entries; empty for a new user; typed and list entries both feed it

### Implementation for User Story 4

- [X] T046 [US4] Extend `services/api/src/handlers/food-entry-post.ts` with the `standard` and `own` kinds using `entryFromFood` and the 1–5,000 calorie check (T042 green); extend `food-entry-put.ts` for list entries: servings/meal only, recompute from the entry's `rate` (T043 green)
- [X] T047 [US4] Implement `services/api/src/handlers/own-foods-get.ts`, `own-foods-post.ts`, `own-foods-put.ts`, `own-foods-delete.ts` (`isOwnFoodNameTaken` against the caller's other own foods; `f-${randomUUID()}`; 404 for `sf-` ids) (T044 green)
- [X] T048 [US4] Implement `services/api/src/handlers/food-recent-get.ts` (`GET /food/recent`): `loadDayContext`, `listEntriesInRange(userId, addDays(today, −89), today)`, `recentFoods(entries, 20)` (T045 green)
- [X] T049 [US4] Register `GET /food/recent` and `GET /food/foods` (read), `POST /food/foods`, `PUT` and `DELETE /food/foods/{foodId}` (`write: true`) in `infra/lib/api-stack.ts`, add the assertions to `infra/test/stacks.test.ts` (all nine food route keys now exist and are JWT-protected), run infra tests and `pnpm synth`
- [X] T050 [US4] Add `addListEntry(date, kind, foodId, servings, meal)`, `createOwnFood`, `updateOwnFood` (both `(prev, formData) => ActionState`, validating with `OwnFoodInputSchema` and mapping `fields` and `DUPLICATE_NAME` to the name field) and `removeOwnFood(foodId)` to `apps/web/src/server/actions/food.ts`, the last three calling `revalidatePath("/food", "layout")`
- [X] T051 [P] [US4] Create `apps/web/src/lib/food-search.ts` with tests-first `apps/web/src/lib/food-search.test.ts`: `searchFoods(query, builtIn, own, recent)` matches names ignoring capitalisation, returns labelled results (`Built-in`, `Mine`, `Recent`), orders Recent, then Mine, then Built-in for an empty query (recents shown first) and by name match otherwise, and de-duplicates nothing across lists (a saved food and a built-in one with the same name both show)
- [X] T052 [US4] Create `apps/web/src/components/food-add-panel.tsx` (client): **Find** tab (search box, labelled results, picking a built-in or own food shows a servings stepper in 0.5 steps and an Add button with a live calorie and macro preview via `entryFromFood`; a Recent result adds a typed entry straight away) and **Quick entry** tab (the form from T028 moved here); meal preselected for today with `defaultMealForHour(localHour(new Date(), timezone))`, none for other days; hidden on read-only days
- [X] T053 [US4] Wire `FoodAddPanel` into `apps/web/src/components/food-screen.tsx`; list entries expand to a servings stepper and meal selector (no calorie field); update `apps/web/src/app/(app)/food/page.tsx` to fetch `GET /food/recent` and `GET /food/foods` in parallel with the day (only when `editable`) and pass them down
- [X] T054 [P] [US4] Create `apps/web/src/components/own-food-form.tsx` (client, `useActionState`): fields Name (max 60), Serving (max 40), Calories (1–5,000), optional Protein/Carbs/Fat with `Field`/`describedBy` from `form-bits`; used for the add form and each row's edit form (Save, Remove)
- [X] T055 [US4] Create `apps/web/src/app/(app)/food/mine/page.tsx`: inside `<Suspense>`, `requireProfile()`, load `GET /food/foods`, show the add form and one edit form per food; add a "My foods" link from `/food`; built-in foods are not listed here. Verify quickstart 6–8, 25–30 and log the results

**Checkpoint**: All four stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T056 [P] Update `README.md` and `CLAUDE.md`: the Food feature, `/food` and `/food/mine`, the nine API routes, "today, the edit window and all calorie/macro math are server-authoritative", the shared `buildFoodDay` / `applyFoodChange` rule, and that the ledger is informational (scoring is feature 004)
- [X] T057 [P] Verify no handler or action logs request bodies or tokens: run `grep -rn "console\." services/api/src apps/web/src` and confirm no matches (constitution VI)
- [ ] T058 [P] Accessibility pass on `/food` and `/food/mine`: every control has an accessible name, errors are linked with `aria-describedby`, focus is visible, the ledger and read-only banner are announced, steppers work by keyboard, and layouts work at 360 px; record what was checked and what still needs a screen-reader pass
- [ ] T059 Run `pnpm check`, `pnpm synth`, `pnpm --filter @calci/web build` (all green); deploy; run the whole [quickstart.md](quickstart.md) and record the results, including SC-001 (add feels instant), SC-002 (four items in under 1 minute), SC-006 (a month loads in under 1 s) and SC-008 (find and add a built-in food in under 15 s)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**
- **US1 (Phase 3)**: depends on Foundational. It is the MVP
- **US2 (Phase 4)**: depends on Foundational and on the screen and page from US1 (T028, T029)
- **US3 (Phase 5)**: depends on US1 (page and screen); its API tests can start after Foundational
- **US4 (Phase 6)**: API work depends on Foundational and on the entry handlers from US1 (T022, T023); its web parts depend on the US1 screen
- **Polish (Phase 7)**: after the stories you want

### Within Foundational

T002–T005 (tests) → T006–T009 (implementation: T008 needs T006–T007) → T010–T011; T012 ∥ T013 → T014 → T015 → T016 (needs T008, T012, T015).

### Parallel opportunities

- Foundational: the four shared test files T002–T005 together, then T006, T007 and T009 together; T010 alongside; T012 ∥ T013
- US1: tests T017 ∥ T018 ∥ T019 ∥ T020 and T027; handlers T021–T024 are separate files once their tests exist
- US2: T031 ∥ T032 ∥ T034
- US3: T036 ∥ T037 ∥ T039
- US4: tests T042 ∥ T043 ∥ T044 ∥ T045 ∥ T051; T054 alongside the panel work; the own-food handlers (T047) and the recent handler (T048) are separate files

## Implementation Strategy

1. **MVP first**: Phases 1–3 (typed logging into meals). Stop and validate on `dev` with quickstart 1–3, 5, 9–13, 17.
2. Add **US2** (the ledger) next: it is small and is the reason the feature exists beside workouts.
3. Add **US3** (days) and **US4** (lists) in either order; US4 is the larger.
4. Finish with Polish and the full quickstart.

## Requirement coverage

FR-001 T017, T029 · FR-002 T018, T022, T027 · FR-003 T002, T042, T046 · FR-004 T019, T023, T043 · FR-005 T018 · FR-006 T018, T019, T027 · FR-007 T017, T012 · FR-008 T043, T046 · FR-009–FR-012 T004, T031, T034 · FR-013 T031 (informational only) · FR-014 T032 · FR-015 T032 · FR-016 T036, T040 · FR-017 T037 · FR-018 T041 · FR-019 T003, T007, T044 · FR-020 T051, T052 · FR-021 T003, T044, T054 · FR-022 T005, T045, T048 · FR-023 T044, T045 · FR-024 T017, T018, T044 · FR-025 T004, T031, T034
