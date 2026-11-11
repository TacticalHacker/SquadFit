---
description: "Task list for 002 Workout Tracker"
---

# Tasks: Workout Tracker

**Input**: Design documents from `specs/002-workout-tracker/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md). Feature 001 is merged or on the base branch.

**Tests**: Included. Constitution III requires failing tests first for domain logic, and research R10 defines the approach. Every test task comes **before** the code that makes it pass and MUST fail first (run it and see it fail).

**Organization**: Grouped by user story so each can be built and verified on its own. Route registration and its CDK assertion live with the story that adds the route.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 from spec.md
- Paths are relative to the repo root

## Lessons carried over from feature 001 (apply throughout)

- Handlers are written as `handle(event, deps)` plus `export const handler = (e) => handle(e, getDeps())`; tests call `handle` with fakes from `services/api/test/fakes.ts`.
- Read the session only inside `<Suspense>`; `getMe()` is memoised per request with React `cache()`. Read `apps/web/AGENTS.md` and the Next 16 docs before writing Next code.
- Never log request bodies or tokens. API responses for one user never include another user's data.
- `server-only` is already aliased in `apps/web/vitest.config.ts`.
- CDK bundling needs the handler entry file to exist before `pnpm synth` or the infra tests run.

---

## Phase 1: Setup

- [ ] T001 Confirm the baseline on branch `002-workout-tracker`: `pnpm install && pnpm check && pnpm synth` all green. This feature adds **no new dependencies** (plan Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared rules and contracts, the repository, and day-context helpers every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared domain: tests first

- [ ] T002 [P] Write failing tests in `packages/shared/test/calories.test.ts`:
  - `caloriesFor(rateMinutes, rateCalories, minutes) = Math.round(rateCalories × minutes ÷ rateMinutes)`: (30, 300, 45) → 450; (30, 300, 30) → 300; (45, 220, 1) → 5; (15, 45, 7) → 21; half rounds up: (4, 10, 1) → 3
  - `summarize(entries)` returns `{ totalMinutes, totalCalories }` as the sum of the **rounded** entry values; empty → `{0, 0}`
  - `MinutesSchema` accepts whole numbers 1–600 only; rejects 0, 601, 12.5, `NaN`, negatives, with the message "Minutes must be a whole number from 1 to 600"
- [ ] T003 [P] Write failing tests in `packages/shared/test/day.test.ts`:
  - `localDate(instant, tz)` returns `YYYY-MM-DD`: for `2026-11-11T20:00:00Z` → `Asia/Kolkata` `2026-11-12`, `America/Los_Angeles` `2026-11-11`, `Pacific/Kiritimati` `2026-11-12`, `UTC` `2026-11-11`; plus both sides of a US daylight-saving change (`2026-03-08`, `America/New_York`, 23-hour day) and a fall-back day (`2026-11-01`, 25 hours); at least five zones in total (SC-004)
  - `addDays("2026-02-28", 1)` → `2026-03-01`; `addDays("2024-02-28", 1)` → `2024-02-29`; `addDays("2026-01-01", -1)` → `2025-12-31`
  - `isEditableDay(date, today)`: `today`, `today−1`, `today−2` → true; `today−3` and `today+1` → false (FR-017)
  - `DateSchema` accepts `2026-11-11`; rejects `2026-02-30`, `2026-13-01`, `26-11-11`, `2026-11-11T00:00`, `""`
  - `dateRange("2026-11-09", "2026-11-11")` → three dates oldest first; `daysBetween` correct across a month end
- [ ] T004 [P] Write failing tests in `packages/shared/test/workouts.test.ts`:
  - catalog invariants for `STANDARD_WORKOUTS`: exactly 12 items; ids unique and matching `^std-[a-z0-9-]+$`; names unique ignoring case; `defaultMinutes` integer 1–600 and `defaultCalories` integer 1–5,000; values equal the table in [research R1](research.md#r1-starter-catalog-lives-in-code-not-in-the-database)
  - `normalizeWorkoutName(" Bad   Minton ")` → `"bad minton"`
  - `WorkoutNameSchema` trims, collapses inner spaces, and requires 1–40 chars (FR-019)
  - `CustomWorkoutInputSchema`: `defaultMinutes` whole 1–600, `defaultCalories` whole 1–5,000, with a per-field message
  - `isNameTaken(name, existingCustomNames)` is true for a standard name ("running") and for a repeat ignoring case and spaces
- [ ] T005 [P] Write failing tests in `packages/shared/test/day-view.test.ts`:
  - `buildDayView({ date, today, timezone, customWorkouts, entries })`: rows are the 12 standard (catalog order), then active custom workouts A→Z, then **orphan rows** for entries whose workout is not on the checklist (`removed: true`, defaults taken from the entry's own rate); `editable` from `isEditableDay`; summary from entries
  - `applyChange(view, change)` for `{type:"tick", workoutId}`: creates an entry with default minutes and `caloriesFor` calories and updates the summary; idempotent on an already-ticked row; `{type:"untick"}` removes it; `{type:"setMinutes", minutes}` recomputes calories **from the entry's own rate** (not the row default) and the summary
  - equivalence: for a set of changes, `applyChange` output equals `buildDayView` rebuilt from the entries the server would store (so optimistic numbers match the server)

### Shared domain & contracts: implementation

- [ ] T006 [P] Implement `packages/shared/src/domain/calories.ts` (`MIN_MINUTES = 1`, `MAX_MINUTES = 600`, `MIN_CALORIES = 1`, `MAX_CALORIES = 5000`, `MinutesSchema`, `caloriesFor`, `summarize`) so T002 passes
- [ ] T007 [P] Implement `packages/shared/src/domain/day.ts` (`EDIT_WINDOW_DAYS = 2`, `DateSchema` refined to a real calendar date, `localDate` via `Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })`, `addDays` via UTC arithmetic on the date string, `isEditableDay`, `dateRange`, `daysBetween`) so T003 passes
- [ ] T008 [P] Implement `packages/shared/src/domain/workouts.ts` (`STANDARD_WORKOUTS` with the 12 rows from research R1, `WorkoutNameSchema`, `normalizeWorkoutName`, `isNameTaken`, `CustomWorkoutInputSchema`) so T004 passes
- [ ] T009 Implement `packages/shared/src/domain/day-view.ts` (`buildDayView`, `applyChange`, types `DayView`, `DayRow`, `DayChange`) using T006–T008 so T005 passes
- [ ] T010 [P] Add `DAY_LOCKED`, `DUPLICATE_NAME`, `NOT_FOUND` to `ApiErrorCodeSchema` in `packages/shared/src/contracts/errors.ts` (contracts/api.md)
- [ ] T011 [P] Create `packages/shared/src/contracts/workouts.ts`: `EntryPutSchema` `{ minutes?: MinutesSchema }`, `WorkoutRowSchema`, `DayViewSchema` (shape in contracts/api.md "Day view"), `CustomWorkoutSchema` `{ workoutId, name, defaultMinutes, defaultCalories }`, `CustomWorkoutResponseSchema` `{ workout }`, `SummaryRangeResponseSchema` `{ days: { date, totalMinutes, totalCalories }[] }`
- [ ] T012 Export the new modules from `packages/shared/src/index.ts`; run `pnpm --filter @calci/shared test && pnpm --filter @calci/shared typecheck` (all green)

### API foundation (test-first where logic exists)

- [ ] T013 [P] Create `services/api/src/lib/workout-repo.ts`: `interface WorkoutRepo` with `listEntriesForDay(userId, date)`, `listEntriesInRange(userId, from, to)`, `getEntry(userId, date, workoutId)`, `putEntryIfAbsent(entry)` (returns whether it created), `updateEntryMinutes(userId, date, workoutId, minutes, calories, nowIso)` (condition `attribute_exists(pk)`), `deleteEntry(userId, date, workoutId)`, `listCustomWorkouts(userId)` (includes removed, caller filters), `getCustomWorkout`, `putCustomWorkout`, `updateCustomWorkout` (condition `attribute_exists(pk)`), `markCustomRemoved`. `DynamoWorkoutRepo` uses the keys and queries in [data-model.md](data-model.md): `pk = USER#<sub>`, `sk = ENTRY#<YYYY-MM-DD>#<workoutId>` / `WORKOUT#<workoutId>`; day = `begins_with(sk, "ENTRY#<date>#")`; range = `sk BETWEEN "ENTRY#<from>" AND "ENTRY#<to>~"`; `putEntryIfAbsent` uses `attribute_not_exists(sk)`. Entry fields per data-model.md: `date`, `workoutId`, `name`, `rateMinutes`, `rateCalories`, `minutes` (1–600), `calories`, `createdAt`, `updatedAt`
- [ ] T014 [P] Extend `services/api/test/fakes.ts`: `InMemoryWorkoutRepo` implementing `WorkoutRepo` (sorted by sk like Dynamo), a settable clock in `makeDeps` (`setNow`), a helper `seedProfile(profiles, sub, timezone)`, and `makeEvent` support for `pathParameters` and `queryStringParameters`
- [ ] T015 Write failing tests in `services/api/test/day-context.test.ts`:
  - `loadDayContext` returns `{ timezone, today }` where `today = localDate(now, profile.timezone)`: the same instant gives different `today` for an `Asia/Kolkata` user and an `America/Los_Angeles` user
  - no profile → 409 `PROFILE_REQUIRED`
  - `resolveReadDate(raw, today)`: undefined → `today`; malformed → 400 `VALIDATION_FAILED`; after `today` → 400
  - `resolveWriteDate(raw, today)`: `today`, `today−2` ok; `today−3` → 409 `DAY_LOCKED` ("This day can no longer be edited"); after `today` → 400
- [ ] T016 Implement `services/api/src/lib/day-context.ts` (`loadDayContext(caller, deps)`, `resolveReadDate`, `resolveWriteDate`, each returning either a value or a ready `APIGatewayProxyResultV2` error) so T015 passes
- [ ] T017 Extend `services/api/src/lib/deps.ts` with `workouts: WorkoutRepo` (`DynamoWorkoutRepo(TABLE_NAME)`) and update `makeDeps` accordingly
- [ ] T018 Create `services/api/src/lib/day-view-loader.ts`: `loadDayView(userId, ctx, date, deps)` reads the day's entries and the caller's custom workouts and returns `buildDayView(...)` (used by every route that returns a day view)

**Checkpoint**: `pnpm check` green. No routes exist yet; the API package has the repository, helpers and shared rules.

---

## Phase 3: User Story 1 - Check off today's workouts (Priority: P1) 🎯 MVP

**Goal**: A user sees the checklist for today, ticks and unticks workouts, and the ticks persist.

**Independent Test**: quickstart 3–5, 10. Tick Running, reload and see it ticked, untick it.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T019 [P] [US1] Write failing tests in `services/api/test/workouts-get.test.ts`: no profile → 409 `PROFILE_REQUIRED`; a new user gets the 12 standard rows in catalog order, all `entry: null`, `date === today`, `editable: true`; custom workouts follow the standard ones A→Z; removed custom workouts are not rows; entries of **another user** never appear; a future `date` → 400
- [ ] T020 [P] [US1] Write failing tests in `services/api/test/entry-put.test.ts` (tick only): creates an entry with the workout's default minutes and calories and stores `name`, `rateMinutes`, `rateCalories` snapshots; ticking again leaves it unchanged (idempotent); unknown id → 404 `NOT_FOUND`; another user's custom workout id → 404; a removed custom workout → 404; `date` three days back → 409 `DAY_LOCKED`; tomorrow → 400; no profile → 409; response is the day view
- [ ] T021 [P] [US1] Write failing tests in `services/api/test/entry-delete.test.ts`: removes the entry and returns the day view; deleting an absent entry succeeds (idempotent); `DAY_LOCKED` for a day three back; works for an entry whose custom workout was removed

### Implementation for User Story 1

- [ ] T022 [US1] Implement `services/api/src/handlers/workouts-get.ts` (`GET /workouts`): `loadDayContext`, `resolveReadDate(query.date)`, `loadDayView` → 200 day view (T019 green)
- [ ] T023 [US1] Implement `services/api/src/handlers/entry-put.ts` (`PUT /workouts/entries/{date}/{workoutId}`) for the **tick** case: resolve workout (standard from `STANDARD_WORKOUTS` or the caller's non-removed custom), `resolveWriteDate`, `putEntryIfAbsent` with default minutes/calories and snapshots, return day view. Body is ignored in this story (T020 green)
- [ ] T024 [US1] Implement `services/api/src/handlers/entry-delete.ts` (`DELETE /workouts/entries/{date}/{workoutId}`): `resolveWriteDate`, `deleteEntry`, day view (T021 green)
- [ ] T025 [US1] Register `GET /workouts` (read), `PUT /workouts/entries/{date}/{workoutId}` and `DELETE …` (`write: true`) in `infra/lib/api-stack.ts` with the JWT authorizer, and add assertions to `infra/test/stacks.test.ts` that these three route keys exist and have `AuthorizationType: JWT`; run `pnpm --filter @calci/infra test` and `pnpm synth`
- [ ] T026 [US1] Create Server Actions in `apps/web/src/server/actions/workouts.ts` (`"use server"`): `tickWorkout(date, workoutId)` and `untickWorkout(date, workoutId)` call the API via `apiFetch` with `DayViewSchema`, return `{ ok: true, view } | { ok: false, error }`; validate `date` with `DateSchema`; `UnauthorizedError` → `redirect("/sign-in")`; `ApiRequestError` with `PROFILE_REQUIRED` → `redirect("/setup")`, `DAY_LOCKED` → `{ ok: false, error: "This day can no longer be edited" }`
- [ ] T027 [US1] Create `apps/web/src/components/workout-checklist.tsx` (client): props `initialView`; `useOptimistic` + `useTransition`; each checkbox applies `applyChange(view, { type: "tick" | "untick", workoutId })` immediately, then calls the action; on `ok: false` shows "Couldn't save. Try again." (or the server's message) in a `role="alert"` region and React reverts the box; each row is a `<label>` with an accessible name "Running, 30 minutes, 300 calories" (or the entry's values when ticked); removed rows show a "removed" tag; rows are disabled when `view.editable` is false
- [ ] T028 [US1] Create `apps/web/src/app/(app)/workouts/page.tsx`: inside `<Suspense>` call `requireProfile()` then `apiFetch("/workouts?date=…", { schema: DayViewSchema })` and render the page heading and `WorkoutChecklist`; accept `?date=` (validated with `DateSchema`, invalid → `redirect("/workouts")`). Replace `apps/web/src/app/(app)/page.tsx` with `redirect("/workouts")`; add a **Workouts** link first in the nav in `apps/web/src/app/(app)/layout.tsx`; set `metadata.title` "Workouts · SquadFit"
- [ ] T029 [US1] Run `pnpm check`, `pnpm synth` and `pnpm --filter @calci/web build` (all green); deploy with `pnpm deploy:dev` and run quickstart 1–5 and 10 via `curl` for the API parts (`401` without a token, tick/untick through the API) and the browser for the rest; note results in `specs/002-workout-tracker/quickstart.md` under "Validation log"

**Checkpoint**: MVP. A user can tick and untick workouts and see them persist.

---

## Phase 4: User Story 2 - See today's totals (Priority: P1)

**Goal**: A summary of total minutes and calories sits above the checklist and updates as the user ticks.

**Independent Test**: quickstart 3, 6, 10. Tick two workouts and see the sums; untick one and see both drop.

### Tests for User Story 2 ⚠️

- [ ] T030 [P] [US2] Write failing tests in `services/api/test/workouts-summary.test.ts` (day totals in the day view): after ticking Running (30/300) and Yoga (30/90) the view's `summary` is `{ totalMinutes: 60, totalCalories: 390 }`; after unticking Running it is `{ 30, 90 }`; an empty day is `{ 0, 0 }`; the total equals the sum of the `rows[].entry` values (SC-003)
- [ ] T031 [P] [US2] Write failing tests in `services/api/test/timezone-day.test.ts`: with a fixed clock of `2026-11-11T20:00:00Z`, an `Asia/Kolkata` user's tick is stored under `2026-11-12` and shows in their "today", while an `America/Los_Angeles` user's tick is stored under `2026-11-11`; changing a profile's timezone later moves **no** existing entry (FR-015); each user sees only their own (SC-004, US2-4)

### Implementation for User Story 2

- [ ] T032 [US2] Make T030–T031 pass (fix `buildDayView` / handlers where they fail; no behaviour changes expected beyond what tests prove)
- [ ] T033 [P] [US2] Create `apps/web/src/components/day-summary.tsx`: a card with "Total minutes" and "Total calories burned" (`aria-live="polite"` so changes are announced), taking the summary from the optimistic view
- [ ] T034 [US2] Render `DaySummary` above the list inside `WorkoutChecklist` in `apps/web/src/components/workout-checklist.tsx` so it reads the same optimistic view as the rows (updates on tick/untick without a refresh, FR-012); verify quickstart 4, 6, 10 in the browser and log the result

**Checkpoint**: US1 + US2 work independently.

---

## Phase 5: User Story 3 - Adjust the duration of a logged workout (Priority: P2)

**Goal**: The user changes the minutes of a ticked workout; calories scale in proportion.

**Independent Test**: quickstart 7–9. Running at 45 min shows 450 kcal; invalid values are rejected.

### Tests for User Story 3 ⚠️

- [ ] T035 [P] [US3] Extend `services/api/test/entry-put.test.ts` with failing cases:
  - `{ minutes: 45 }` on an existing 30-min/300-kcal entry → minutes 45, calories 450
  - minutes change recomputes from the **entry's own** rate: set the custom workout's default to 800 kcal after the entry was logged; editing the entry still uses the old rate
  - `{ minutes: 45 }` with no entry creates it with calories `round(defaultCalories × 45 ÷ defaultMinutes)`
  - `0`, `601`, `12.5`, `"30"` and `-5` → 400 `VALIDATION_FAILED` with `fields.minutes = "Minutes must be a whole number from 1 to 600"`, and the stored entry is unchanged
  - no `minutes` on an existing 45-min entry leaves it at 45
  - editing a day three back → 409 `DAY_LOCKED`
- [ ] T036 [P] [US3] Write failing tests in `apps/web/src/lib/minutes-input.test.ts` for `parseMinutesInput(raw)`: `"45"` → 45; `""`, `"0"`, `"601"`, `"12.5"`, `"abc"`, `"4e1"` → an error with the same message as `MinutesSchema`

### Implementation for User Story 3

- [ ] T037 [US3] Extend `services/api/src/handlers/entry-put.ts` with the minutes branch: parse `EntryPutSchema` (empty body allowed), validate via the shared schema, recompute calories from the entry's `rateMinutes`/`rateCalories` (or the workout's defaults when creating), `updateEntryMinutes` / create-then-retry-as-update on a race (T035 green)
- [ ] T038 [P] [US3] Create `apps/web/src/lib/minutes-input.ts` (`parseMinutesInput`, built on `MinutesSchema`) so T036 passes
- [ ] T039 [US3] Add `setEntryMinutes(date, workoutId, minutes)` to `apps/web/src/server/actions/workouts.ts` (same result shape and error mapping as `tickWorkout`; maps `fields.minutes` to the error text)
- [ ] T040 [US3] In `apps/web/src/components/workout-checklist.tsx`, show a minutes `<input type="number" inputMode="numeric" min=1 max=600 step=1>` (labelled "Minutes for Running") on ticked rows; on commit (blur / Enter) validate with `parseMinutesInput`, apply `applyChange(view, { type: "setMinutes", workoutId, minutes })` optimistically and call the action; invalid input shows the message under the field with `aria-describedby` and keeps the previous value; unticking and re-ticking returns to default minutes (US3-3). Verify quickstart 7–9 and log the result

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Look at previous days (Priority: P2)

**Goal**: Day navigation with a 7-day strip; the last three days are editable and older days read-only; the screen follows local midnight.

**Independent Test**: quickstart 12–17, 25, 26.

### Tests for User Story 4 ⚠️

- [ ] T041 [P] [US4] Write failing tests in `services/api/test/workouts-summary-get.test.ts` for `GET /workouts/summary?from&to`: returns every date in the range oldest first with zeros for empty days and correct sums for days with entries; `from > to` → 400; `to` after `today` → 400; a range over 62 days → 400; malformed dates → 400; other users' entries excluded; no profile → 409
- [ ] T042 [P] [US4] Extend `services/api/test/workouts-get.test.ts` with failing cases: past dates return their entries and totals; `editable` is true for `today`, `today−1`, `today−2` and false for `today−3`; with the clock advanced past local midnight the day that was `today−2` becomes `editable: false` (US4-6); a date years back loads
- [ ] T043 [P] [US4] Extend `services/api/test/entry-put.test.ts` and `entry-delete.test.ts` with failing cases for the window edges: tick/untick on `today−2` succeeds; on `today−3` → 409 `DAY_LOCKED` with the message "This day can no longer be edited" and nothing stored; **after** advancing the clock across midnight the previously editable `today−2` is refused
- [ ] T044 [P] [US4] Write failing tests in `apps/web/src/lib/rollover.test.ts` for `hasDayChanged(now, timeZone, today)`: false within the same local day; true after local midnight; correct for `Asia/Kolkata` and `America/Los_Angeles` at the same instant

### Implementation for User Story 4

- [ ] T045 [US4] Implement `services/api/src/handlers/workouts-summary-get.ts` (`GET /workouts/summary`): validate range, `listEntriesInRange`, group with `summarize`, fill empty dates with `dateRange` (T041 green); confirm T042–T043 pass against the existing handlers (fix `day-context`/handlers if not)
- [ ] T046 [US4] Register `GET /workouts/summary` (read) in `infra/lib/api-stack.ts` with the JWT authorizer, add its assertion to `infra/test/stacks.test.ts`, run infra tests and `pnpm synth`
- [ ] T047 [P] [US4] Create `apps/web/src/lib/rollover.ts` (`hasDayChanged`, using `localDate`) so T044 passes
- [ ] T048 [P] [US4] Create `apps/web/src/components/day-nav.tsx`: previous (◀) and next (▶) links using `addDays` (`?date=`), no ▶ on `today`, a "Back to today" link on other days, and the date shown with `Intl.DateTimeFormat` plus a "Today" label (accessible link names "Previous day" / "Next day")
- [ ] T049 [P] [US4] Create `apps/web/src/components/day-strip.tsx`: seven links to `?date=` with each day's minutes and calories from `GET /workouts/summary?from=<date−6>&to=<date>`, current day marked `aria-current="date"`
- [ ] T050 [US4] Update `apps/web/src/app/(app)/workouts/page.tsx`: fetch the summary range in parallel with the day view, render `DayNav` and `DayStrip`; a future date redirects to `/workouts` (FR-016); when `editable` is false show a banner "This day can no longer be edited" and render the checklist read-only
- [ ] T051 [US4] In `apps/web/src/components/workout-checklist.tsx`, pass `today` and `timeZone` as props and, on window focus, `visibilitychange` and every 60 s, call `router.refresh()` when `hasDayChanged(new Date(), timeZone, today)` (FR-018); every mutation already carries the displayed `date`. Verify quickstart 12–17, 25, 26 and log the results

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Add my own workouts (Priority: P3)

**Goal**: Users add, edit and remove their own workouts, which appear on their checklist and nowhere else.

**Independent Test**: quickstart 18–23.

### Tests for User Story 5 ⚠️

- [ ] T052 [P] [US5] Write failing tests in `services/api/test/custom-post.test.ts`: valid body creates `c-<uuid>` and returns `{ workout }`; `name` trimmed and 1–40 chars, `defaultMinutes` whole 1–600, `defaultCalories` whole 1–5,000, each with a `fields` message; `"running"` (standard, any case) and a repeat of an own name (ignoring case and spaces) → 409 `DUPLICATE_NAME` ("You already have a workout with that name"); a removed workout's name can be reused; no profile → 409
- [ ] T053 [P] [US5] Write failing tests in `services/api/test/custom-put.test.ts`: edit name/minutes/calories succeeds; the new name must not clash (excluding itself); editing does **not** change existing entries (FR-010); another user's id → 404; a standard id → 404; a removed workout → 404
- [ ] T054 [P] [US5] Write failing tests in `services/api/test/custom-delete.test.ts` and extend `workouts-get.test.ts`: removing hides it from the checklist rows but past and today's entries remain in the day view as `removed: true` rows and stay editable inside the window; removing twice succeeds; another user's id and standard ids → 404; a second user never sees the first user's custom workouts (FR-023, SC-005)

### Implementation for User Story 5

- [ ] T055 [US5] Implement `services/api/src/handlers/custom-post.ts` (`POST /workouts/custom`): parse `CustomWorkoutInputSchema`, check `isNameTaken` against the caller's active custom names, generate `c-${randomUUID()}`, `putCustomWorkout` (T052 green)
- [ ] T056 [US5] Implement `services/api/src/handlers/custom-put.ts` (`PUT /workouts/custom/{workoutId}`) (T053 green) and `services/api/src/handlers/custom-delete.ts` (`DELETE /workouts/custom/{workoutId}`, soft remove via `markCustomRemoved`, idempotent) (T054 green)
- [ ] T057 [US5] Register `POST /workouts/custom`, `PUT /workouts/custom/{workoutId}`, `DELETE /workouts/custom/{workoutId}` (`write: true`) in `infra/lib/api-stack.ts`, add the assertions to `infra/test/stacks.test.ts`, run infra tests and `pnpm synth`
- [ ] T058 [US5] Add `createCustomWorkout`, `updateCustomWorkout` (both `(prev, formData) => ActionState`, validating with `CustomWorkoutInputSchema` and mapping `fields` and `DUPLICATE_NAME` to the name field) and `removeCustomWorkout(workoutId)` to `apps/web/src/server/actions/workouts.ts`, each calling `revalidatePath("/workouts", "layout")`
- [ ] T059 [US5] Create `apps/web/src/components/custom-workout-form.tsx` (client, `useActionState`): fields Name (max 40), Default minutes (1–600), Default calories (1–5,000) with `Field`/`describedBy` from `form-bits`; used for the add form and for each row's edit form (Save, Remove)
- [ ] T060 [US5] Create `apps/web/src/app/(app)/workouts/mine/page.tsx`: inside `<Suspense>`, `requireProfile()`, load rows from `GET /workouts` filtered to `!isStandard && !removed`, show the add form and one edit form per workout; add a "My workouts" link from `/workouts`; standard workouts are not listed (FR-022). Verify quickstart 18–23 and log the results

**Checkpoint**: All five stories work.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T061 [P] Update `README.md` and `CLAUDE.md`: the Workouts feature, the `/workouts` and `/workouts/mine` routes, "today and the edit window come only from the server" (constitution V), the shared `buildDayView` / `applyChange` rule, and the new API routes
- [ ] T062 [P] Verify no handler or action logs request bodies or tokens: run `grep -rn "console\." services/api/src apps/web/src` and confirm no matches (constitution VI)
- [ ] T063 [P] Accessibility pass on `/workouts` and `/workouts/mine`: every checkbox and input has an accessible name, errors are linked with `aria-describedby`, focus is visible, the read-only banner is announced, and layouts work at 360 px; record what was checked and what still needs a screen-reader pass
- [ ] T064 Run `pnpm check`, `pnpm synth`, `pnpm --filter @calci/web build` (all green); `pnpm deploy:dev`; run the whole [quickstart.md](quickstart.md) and record the results, including SC-001 (tick feels instant), SC-002 (three workouts in under 30 s), SC-006 (30-day summary under 1 s) and SC-007 (add and tick a custom workout in under 1 min), in the validation log

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**
- **US1 (Phase 3)**: depends on Foundational. It is the MVP
- **US2 (Phase 4)**: depends on Foundational and on the page/checklist from US1 (T027, T028)
- **US3 (Phase 5)**: depends on US1 (the tick handler and checklist)
- **US4 (Phase 6)**: depends on US1 (page and checklist); its API tests can start after Foundational
- **US5 (Phase 7)**: depends on Foundational; its web pages depend on the US1 page (link) but the API work is independent
- **Polish (Phase 8)**: after the stories you want

### Within Foundational

T002–T005 (tests) → T006–T009 (implementation: T009 needs T006–T008) → T010–T012; T013 ∥ T014 → T015 → T016 → T017 → T018 (needs T009, T013, T016).

### Parallel opportunities

- Foundational: the four shared test files T002–T005 together, then T006–T008 together, then T010 ∥ T011; T013 ∥ T014
- US1: tests T019 ∥ T020 ∥ T021; handlers T022–T024 are separate files and can be done in parallel once their tests exist
- US2: T030 ∥ T031 ∥ T033
- US3: T035 ∥ T036; T038 alongside T037
- US4: tests T041–T044 together; T047 ∥ T048 ∥ T049
- US5: tests T052 ∥ T053 ∥ T054
- After Foundational: the US5 API work can proceed alongside US1–US4 web work (different files)

### Parallel example: User Story 1

```text
Task: T019 Write failing tests in services/api/test/workouts-get.test.ts
Task: T020 Write failing tests in services/api/test/entry-put.test.ts
Task: T021 Write failing tests in services/api/test/entry-delete.test.ts
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 → Phase 2 (shared domain, repository, day helpers)
2. Phase 3 US1 → `pnpm deploy:dev` → tick and untick workouts in the browser
3. **Stop and validate.** Logging works end to end

### Incremental delivery

1. + US2 (totals) → the product's headline number
2. + US3 (minutes) → accurate workouts
3. + US4 (history and rollover) → the last three days editable, older days read-only
4. + US5 (custom workouts) → the list fits each person
5. Polish → merge `002-workout-tracker`

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Tests MUST fail before implementation (constitution III); run each new test file and see it fail before writing the code
- The calorie and total numbers in the UI are display-only; the server recomputes and is the authority (constitution V)
- Commit after each task or logical group
