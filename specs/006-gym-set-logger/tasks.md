---
description: "Task list for 006-gym-set-logger"
---

# Tasks: Gym Set Logger

**Input**: Design documents from `specs/006-gym-set-logger/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md)

**Tests**: Required. Constitution III makes domain tests test-first (write them, see them fail, then implement), and the project tests every handler with in-memory fakes and every data/access resource with CDK assertions.

**Organization**: Grouped by user story. Paths are repo-relative. Before writing any Next.js code, read `apps/web/node_modules/next/dist/docs/` (apps/web/AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

- [ ] T001 Read `apps/web/node_modules/next/dist/docs/` sections on Server Actions, `viewport` export and Cache Components/Suspense, and note any API differences from features 002/003 usage in a scratch note (no repo file).
- [ ] T002 [P] Add `.no-scrollbar` utility (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`) to `apps/web/src/app/globals.css`.
- [ ] T003 [P] Add `LIMIT_REACHED` to `ApiErrorCodeSchema` in `packages/shared/src/contracts/errors.ts`.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: Pure domain + contracts + storage + server routes that every story uses.

### Domain tests first (must fail before T009–T012)

- [ ] T004 [P] Write `packages/shared/test/gym.test.ts`: `GYM_EXERCISES` has exactly the 30 FR-001 items with `gx-` ids and groups per data-model table, unique names (ignoring case) also not clashing with `STANDARD_WORKOUTS`; cardio items have rates `20/140` (Incline Treadmill Walk) and `20/180` (Stairmaster); `gymTotals` worked examples: 3×(80×8) → `{volumeKg:1920, minutes:8, calories:45}`, 5×(60×5) → `1500/13/75`, 1 set → `minutes 3, calories 15`, 4×(0×12) → `0/10/60`, 2×(62.5×7) → `875/5/30`; cardio totals via `caloriesFor`; `topSet` picks max weight, ties → higher reps → lower setNumber; `formatLast` renders `Last: 80kg × 8` and `Last: BW × 12`.
- [ ] T005 Write parser tests in `packages/shared/test/gym.test.ts` (same file, separate `describe`, coordinate with T004): `parseWeight` accepts `62.5`, `62,5`, `0`, `500`; rejects `62.3`, `-1`, `500.5`, `abc`; `parseReps` accepts whole `1–100`, rejects `0`, `1.5`, `101`; `parseMinutes` whole `1–600`.
- [ ] T006 [P] Write `packages/shared/test/gym-drawer.test.ts`: `initDrawer` precedence draft → saved entry → last entry (`completed=false`, `repsEdited=false`) → defaults `3 × 10 × 0 kg`; cardio init minutes `20` or last minutes; reducer: sets `+` appends a copy of the last row incl. `repsEdited`, `completed=false`, max 20; sets `−` removes last, min 1; default reps `1–100` updates only rows with `repsEdited=false`; weight `±2.5` floors at 0 and caps at 500; reps `±1` within `1–100` and marks `repsEdited=true`; typed set actions validate with parsers; `toggleDone`; `dirty` flips on first change.
- [ ] T007 [P] Extend `packages/shared/test/day-view.test.ts`: entries with `kind: "gym"` go to `view.gym` (oldest `createdAt` first), never to `rows`; `summary` sums workout and gym entries; `gymMinutes` sums gym minutes only; entries without `kind` behave as before.
- [ ] T008 [P] Write `packages/shared/test/gym-view.test.ts`: `buildGymView` lists built-ins in catalog order then own exercises alphabetically; attaches that day's `entry` and the given `last`; includes a removed own exercise only when it has an entry that day; `editable` from `isEditableDay`; `filterExercises(list, group, query)` matches name substrings ignoring case across all groups when `query` is non-empty, else by group.

### Domain + contracts implementation

- [ ] T009 Implement `packages/shared/src/domain/gym.ts`: `MuscleGroupSchema` (`chest|back|legs|shoulders|arms|core|cardio`), `GYM_EXERCISES`, `isGymId` (`gx-`/`gc-` prefix), `gymTotals` (volume in tenths-of-kg integers, `Math.round(n*2.5)`, `n*15`), `topSet`, `formatLast`, `parseWeight` (0–500, multiple of 0.5, `,` as decimal), `parseReps` (int 1–100), `parseMinutes` (int 1–600), `ExerciseNameSchema` (trim, collapse spaces, 1–40 chars), `isExerciseNameTaken`, `filterExercises`; constants `GYM_MAX_SETS=20`, `GYM_MAX_OWN=50`, `STRENGTH_RATE={rateMinutes:5, rateCalories:30}`. Makes T004/T005 pass.
- [ ] T010 Implement `packages/shared/src/domain/gym-drawer.ts` (`DrawerState`, `DrawerAction`, `initDrawer`, `drawerReducer`, `drawerToBody`) per data-model "Drawer state". Makes T006 pass.
- [ ] T011 Extend `packages/shared/src/domain/day-view.ts`: `StoredEntry` gains optional `kind`, `muscleGroup`, `exerciseKind`, `sets`, `volumeKg`, `createdAt`, `updatedAt`; `buildDayView` splits gym entries into `gym: GymEntryView[]`, adds `gymMinutes`; `applyChange` leaves `gym` untouched. Makes T007 pass.
- [ ] T012 Implement `buildGymView` in `packages/shared/src/domain/gym.ts` (summary uses `summarize` over all of the day's entries). Makes T008 pass.
- [ ] T013 Create `packages/shared/src/contracts/gym.ts`: `GymSetSchema` (`setNumber` int ≥1, `reps` int 1–100, `weightKg` 0–500 multiple of 0.5, `completed` bool), `GymEntryPutSchema` (strict union `{sets: 1–20, setNumber 1..n contiguous}` | `{minutes: 1–600}`; extra keys rejected), `GymEntryViewSchema`, `GymLastSchema`, `GymExerciseSchema`, `GymViewSchema`, `GymExerciseInputSchema` (`name` 1–40, `group` any but `cardio`), `GymExerciseResponseSchema`, `GymDraftSchema` (`{v:1, savedAt, baseUpdatedAt: string|null, state}`); extend `DayViewSchema` in `packages/shared/src/contracts/workouts.ts` with `gym` (default `[]`) and `gymMinutes` (default `0`); export all from `packages/shared/src/index.ts`.

### Storage + server

- [ ] T014 Extend `services/api/src/lib/workout-repo.ts` `toEntry` to carry `kind`, `muscleGroup`, `exerciseKind`, `sets`, `volumeKg` when present, so day/range reads return gym entries intact.
- [ ] T015 Create `services/api/src/lib/gym-repo.ts` (`GymRepo` + `DynamoGymRepo`): `putGymEntry` (full `PutItem` of `ENTRY#<date>#<exerciseId>` with `kind:"gym"`, `gsi1pk = GYM#<sub>#<exerciseId>`, `gsi1sk = <date>`, keep `createdAt` of an existing item), `deleteGymEntry`, `getGymEntry`, `lastBefore(userId, exerciseId, date)` (`gsi1`, `gsi1sk < :d`, `ScanIndexForward:false`, `Limit:1`), `listOwnExercises` (`GYMEX#`, filter `removedAt`), `getOwnExercise`, `putOwnExerciseIfAbsent`, `updateOwnExercise` (`attribute_exists AND attribute_not_exists(removedAt)`), `markOwnRemoved`. Never log item contents.
- [ ] T016 Add `gym: GymRepo` to `services/api/src/lib/deps.ts` and an in-memory `FakeGymRepo` (sharing the fake entry store with `FakeWorkoutRepo`, and emulating the GSI lookup) to `services/api/test/fakes.ts`.
- [ ] T017 Create `services/api/src/lib/gym-view-loader.ts`: loads own exercises, the day's entries, and `lastBefore` for every listed exercise in parallel, then `buildGymView`.
- [ ] T018 [P] Guard 002 routes: `services/api/src/handlers/entry-put.ts` and `entry-delete.ts` return `404 NOT_FOUND` when `isGymId(workoutId)`; add cases to `services/api/test/entry-put.test.ts` and `entry-delete.test.ts`.
- [ ] T019 [P] Write `services/api/test/gym-get.test.ts` then implement `services/api/src/handlers/gym-get.ts` (`GET /workouts/gym?date=`; default today; future → 400; `PROFILE_REQUIRED`; returns `GymView` with `last`).
- [ ] T020 Add the six routes from contracts/api.md to `infra/lib/api-stack.ts` and assert them in `infra/test/stacks.test.ts` (JWT authorizer on each; `gym-get` read-only incl. `gsi1` index ARN; mutations read-write).

**Checkpoint**: `pnpm check` green; `GET /workouts/gym` works with fakes.

---

## Phase 3: User Story 1 - Log an exercise's sets from a bottom drawer (P1) 🎯 MVP

**Goal**: Tap an exercise → drawer → adjust rows → Save/Remove; totals update everywhere; drafts survive close/reload.

**Independent test**: quickstart §2 and §5.

- [ ] T021 [P] [US1] Write `services/api/test/gym-entry.test.ts`: PUT strength body stores server-computed `volumeKg/minutes/calories` (3×60×10 → 1800/8/45); body with `totalVolumeKg` or `calories` → 400; cardio body on strength exercise (and vice versa) → 400; unknown/other member's/removed own exercise with no entry → 404; existing entry of a removed own exercise can be re-saved keeping its `name`/`muscleGroup` snapshot; `today−3` → 409 `DAY_LOCKED`; future → 400; re-save replaces sets and keeps `createdAt`; DELETE idempotent; response is the `GymView`; `GET /workouts` summary and `GET /food` ledger `burned` include the gym calories exactly once.
- [ ] T022 [US1] Implement `services/api/src/handlers/gym-entry-put.ts` and `gym-entry-delete.ts` (parse with `GymEntryPutSchema`, `resolveWriteDate`, recompute with `gymTotals`/`caloriesFor`, snapshot name/group/kind and rate, respond via `loadGymView`). Makes T021 pass.
- [ ] T023 [P] [US1] Write `apps/web/src/lib/gym-draft.test.ts` then implement `apps/web/src/lib/gym-draft.ts`: key `sf:gymdraft:v1:<userId>:<date>:<exerciseId>`; `loadDraft` (zod-validated, bad → removed), `saveDraft`, `clearDraft`, `listDraftExerciseIds(userId, date)`, `pruneDrafts(userId, today)` removing dates `< today−2`; every storage access in try/catch.
- [ ] T024 [P] [US1] Create `apps/web/src/components/bottom-sheet.tsx` per research R9: `<dialog>` + `showModal()`, `max-h-[85dvh] rounded-t-2xl`, drag handle, fixed header / `overflow-y-auto overscroll-contain` body / footer with `pb-[env(safe-area-inset-bottom)]`, backdrop click and Escape close, pointer drag on handle+header closes past 25% height or velocity > 0.5 px/ms, `<html>` scroll lock, `prefers-reduced-motion` respected.
- [ ] T025 [P] [US1] Create `apps/web/src/components/stepper.tsx`: `[−] value [+]`, buttons `min-h-11 min-w-11 touch-manipulation select-none` with `aria-label`s, disabled at bounds.
- [ ] T026 [US1] Create `apps/web/src/server/actions/gym.ts` with `saveGymEntry` and `removeGymEntry` (validate with shared schemas, `apiFetch`, parse `GymViewSchema`, return `{ok:true, view} | {ok:false, code, message}`); then `revalidatePath` for `/workouts` and `/food` as features 002/003 do.
- [ ] T027 [US1] Create `apps/web/src/components/gym-drawer.tsx`: `drawerReducer` state; header (name, group); set rows `#n` with weight Stepper (±2.5), reps Stepper (±1) and a ≥44 px `✓` toggle (`aria-pressed`); cardio → minutes Stepper (±5); sticky footer `Volume · ~min · ~kcal` from `gymTotals`, full-width **Save**, **Remove** when saved; read-only (no Save/Remove, steppers disabled) when `!editable`; save error keeps drawer open with retry; `DAY_LOCKED` → read-only message. Persists drafts via `gym-draft` when `dirty`, restores on open with **Discard draft**, clears on Save/Remove/Discard, and shows "A saved version also exists" when `baseUpdatedAt` ≠ entry `updatedAt`.
- [ ] T028 [US1] Create `apps/web/src/components/gym-screen.tsx` and `exercise-list.tsx`: list exercises grouped by muscle group (pills/search come in US3), rows ≥ 56 px, logged badge `3 sets · 1,920 kg` / `25 min`, `Draft` badge from `listDraftExerciseIds`; opens `GymDrawer`; replaces state with the returned `GymView`; calls `pruneDrafts` on mount; `open` search param opens that drawer.
- [ ] T029 [US1] Create `apps/web/src/app/(app)/workouts/gym/page.tsx` (session read inside `<Suspense>`, `requireProfile`, invalid `date` → redirect `/workouts/gym`, fetch `GymView` + `getMe()` userId, render `DayNav` with `basePath="/workouts/gym"` and `GymScreen`) and `apps/web/src/components/workouts-tabs.tsx` ("Activities | Gym", keeps `?date=`, `aria-current`), rendered on both `/workouts` and `/workouts/gym`.
- [ ] T030 [US1] Show gym entries in "Logged today" in `apps/web/src/components/workout-checklist.tsx` (name, `3 sets · 1,920 kg` or minutes, kcal; links to `/workouts/gym?date=D&open=<id>`) and make sure optimistic `applyChange` keeps `view.gym` (FR-021).
- [ ] T031 [US1] Set `viewport.interactiveWidget = "resizes-content"` in `apps/web/src/app/layout.tsx` if absent (no `maximumScale`/`userScalable`).

**Checkpoint**: MVP: log/edit/remove an exercise on a phone; totals, ledger and drafts work.

---

## Phase 4: User Story 2 - Adjust sets, reps and weight one-handed (P1)

**Goal**: Sets and Default Reps steppers, tap-to-type with validation.

**Independent test**: quickstart §3.

- [ ] T032 [P] [US2] Create `apps/web/src/components/number-field.tsx`: tap value to edit; `<input type="text" inputMode="decimal"|"numeric" enterKeyHint="done" className="text-base">`; commits on blur/Enter via `parseWeight`/`parseReps`/`parseMinutes`; invalid → inline message and revert. Use it as the value inside `Stepper` (`apps/web/src/components/stepper.tsx`).
- [ ] T033 [US2] Add the top **Sets** (1–20) and **Default Reps** (1–100) steppers to `apps/web/src/components/gym-drawer.tsx`, wired to the reducer actions; keep the body scrollable for 20 rows with header/footer fixed; ensure the focused field scrolls into view above the keyboard (`scrollIntoView({block:"center"})` on focus).
- [ ] T034 [P] [US2] Extend `packages/shared/test/gym-drawer.test.ts` for typed actions: `62.3` rejected and previous kept; `62,5` → 62.5; reps `0` rejected.

---

## Phase 5: User Story 3 - Find exercises by muscle group or search (P1)

**Goal**: Sticky horizontally scrollable pills + cross-group search.

**Independent test**: quickstart §6 (search) and the US3 acceptance scenarios.

- [ ] T035 [P] [US3] Create `apps/web/src/components/muscle-pills.tsx`: `sticky top-0 z-10 flex gap-2 overflow-x-auto no-scrollbar snap-x`, 7 pills ≥ 44 px tall in data-model order, selected highlighted with `aria-pressed`, selected scrolled into view.
- [ ] T036 [P] [US3] Create `apps/web/src/components/exercise-search.tsx`: `type="search"`, `text-base`, clear button ≥ 44 px.
- [ ] T037 [US3] Wire pills and search into `apps/web/src/components/gym-screen.tsx` using `filterExercises`; search results show the group label; clearing returns to the selected group; page wrapper `overflow-x-clip` so only the pill bar scrolls sideways.

---

## Phase 6: User Story 4 - Start from last time (P2)

**Goal**: Pre-fill from the latest earlier entry; "Last: 80kg × 8" in the header.

**Independent test**: quickstart §4.

- [ ] T038 [P] [US4] Extend `services/api/test/gym-get.test.ts`: `last` is the most recent entry strictly before `?date` (not the same day, not later days); null when never logged; top set per `topSet`; removed own exercise's history still found for an entry that day.
- [ ] T039 [US4] Pass `exercise.last` into `initDrawer` and render `formatLast(last)` under the title in `apps/web/src/components/gym-drawer.tsx`; no line when `last` is null.

---

## Phase 7: User Story 5 - Add a custom exercise (P3)

**Goal**: Own exercises with name + group; edit/remove.

**Independent test**: quickstart §6 (custom).

- [ ] T040 [P] [US5] Write `services/api/test/gym-exercise.test.ts`: create (`name` 1–40 chars trimmed, `group` not `cardio`) → 201; duplicate of a built-in or own name ignoring case/spaces → 409 `DUPLICATE_NAME`; 51st → 409 `LIMIT_REACHED`; update another member's / removed / built-in id → 404; delete soft-removes and is idempotent; past entries keep their name/group snapshot after rename.
- [ ] T041 [US5] Implement `services/api/src/handlers/gym-exercise-post.ts`, `gym-exercise-put.ts`, `gym-exercise-delete.ts` (ids `gc-<uuid>`). Makes T040 pass.
- [ ] T042 [US5] Add `createGymExercise`, `updateGymExercise`, `removeGymExercise` to `apps/web/src/server/actions/gym.ts`.
- [ ] T043 [US5] Create `apps/web/src/components/custom-exercise-form.tsx` (name `text-base`, group select without Cardio, inline field errors) shown in a `BottomSheet` from a `+ Custom Exercise` row in `exercise-list.tsx`; own rows get an "Edit" action opening the same form with Remove.

---

## Phase 8: Cross-story requirements

- [ ] T044 [P] Strength training hint (FR-025): in `apps/web/src/components/workout-checklist.tsx`, when `view.gymMinutes > 0` show `Logged in Gym: N min` on the `std-strength` card; both remain loggable.
- [ ] T045 [P] AI history (FR-024): extend `get_user_history` in `services/api/src/lib/mcp/tools.ts` so gym workout items add `kind:"gym"`, `muscleGroup`, and for strength `sets:[{set, reps, kg, done}]`, `volumeKg`; update its description; extend `services/api/test/mcp-history.test.ts` (existing fields unchanged, only the key holder's entries).
- [ ] T046 [P] Privacy check: add a test in `services/api/test/gym-entry.test.ts` that member B can neither read (via `GET /workouts/gym`) nor modify member A's entries or own exercises (FR-022, SC-007).

---

## Phase 9: Polish

- [ ] T047 [P] Update `CLAUDE.md` with a "Gym logger (feature 006)" section: routes, `ENTRY#` gym items with `kind:"gym"` + `gsi1` `GYM#<sub>#<exerciseId>`, `gymTotals` as the single source of gym math, drafts in `localStorage`, never log sets/weights.
- [ ] T048 Run `pnpm check` and `pnpm synth`; fix failures.
- [ ] T049 Run quickstart §2–§8 on `dev` with a real iPhone (Safari) and an Android phone; record results in `specs/006-gym-set-logger/quickstart.md` under a "Validation log" heading.

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T020)** → stories.
- Within Foundational: tests T004–T008 before T009–T012; T013 after T009/T011; T014–T017 after T013; T018–T020 after T016/T017.
- **US1 (T021–T031)** depends only on Foundational. MVP.
- **US2 (T032–T034)** depends on US1's drawer (T027) and Stepper (T025).
- **US3 (T035–T037)** depends on US1's `GymScreen` (T028); independent of US2.
- **US4 (T038–T039)** server side is in Foundational (T015/T017/T019); UI depends on T027.
- **US5 (T040–T043)** depends on Foundational and T028 for the list row.
- **Phase 8** after US1 (T044 needs T030; T045/T046 need T022).
- **Polish** last.

## Parallel Examples

- Foundational tests: T004, T006, T007, T008 together (separate files; T005 shares T004's file).
- US1: T021 (API test), T023 (drafts), T024 (sheet), T025 (stepper) together; then T022, T026–T031.
- After US1: US2, US3, US4 UI and US5 can proceed in parallel by different people; T044–T046 in parallel.

## Implementation Strategy

1. Setup + Foundational → `pnpm check` green.
2. US1 → deploy dev, run quickstart §2/§5 on a phone (MVP).
3. US2 + US3 (completes the P1 experience) → quickstart §3, §6, §7.
4. US4 → §4. US5 → §6 custom.
5. Phase 8 + Polish → §8, full validation log.
