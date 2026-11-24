---
description: "Tasks for feature 018: Daily Muscle Heatmap"
---

# Tasks: Daily Muscle Heatmap

**Input**: Design documents from `/specs/018-muscle-heatmap/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Constitution III (lean tests): one shared test file for the new pure functions only. No UI tests.

**Organization**: Tasks are grouped by user story.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Add heat tokens to `apps/web/src/app/globals.css`: in `:root` define `--heat-0: var(--surface-2)`, `--heat-1: color-mix(in oklab, var(--accent) 28%, var(--surface))`, `--heat-2: color-mix(in oklab, var(--accent) 60%, var(--surface))`, `--heat-3: var(--accent)` (they follow the light/dark base tokens through `var()`), and `--color-heat-0..3` in `@theme` so `fill-heat-N` utilities exist (research R4)

## Phase 2: Foundational (shared domain, blocks all stories)

- [X] T002 Write failing tests in `packages/shared/test/muscle-map.test.ts`: (a) every `GYM_EXERCISES` entry with `kind: "strength"` has a `MUSCLE_MAP` row with ≥ 1 primary, no region in both lists, and no cardio id has a row; (b) worked example: 4 completed Bench Press sets + 2 Tricep Pushdown → chest `{direct 4, indirect 0, score 4, step 2}`, front-delts `{0, 4, 2, 1}`, triceps `{2, 4, 4, 2}`, calves score 0; uncompleted sets and `reps: 0` sets and cardio entries add nothing; (c) fallback: an own `gc-x` exercise in group `arms` → primary `[biceps, triceps]`; (d) `heatStep`: 0 → 0, 2.5 → 1, 3 → 2, 5.5 → 2, 6 → 3; (e) `exercisesForRegion(…, "lats")` puts an exercise with a completed set first and excludes chest-only and cardio exercises
- [X] T003 Implement `packages/shared/src/domain/muscle-map.ts` per contracts/ui.md: `MUSCLE_REGIONS` (15 ids in data-model order), `MuscleRegion`, `MUSCLE_REGION_LABELS`, `MUSCLE_REGION_SIDE`, `ExerciseMuscles`, `MUSCLE_MAP` (exactly research R6), `GROUP_FALLBACK` (chest → [chest]; back → [lats, upper-back]; legs → [quads, hamstrings, glutes]; shoulders → [front-delts]; arms → [biceps, triceps]; core → [abs]; cardio → []), `musclesFor`, `heatStep` ("score = 0 → 0; 0 < score < 3 → 1; 3 ≤ score < 6 → 2; score ≥ 6 → 3"), `dayMuscleLoad` (a completed set = "completed && reps >= 1", strength only), `hasMuscleLoad`, `exercisesForRegion`; make T002 pass
- [X] T004 Re-export `./domain/muscle-map` from `packages/shared/src/index.ts`

**Checkpoint**: `pnpm --filter @calci/shared test` green.

## Phase 3: User Story 1 - See which muscles I trained (P1) 🎯 MVP

**Goal**: Figure under the "X min · Y kcal burned" line, coloured by the day's sets; hidden when there are none.

**Independent Test**: quickstart rows 1–5.

- [X] T005 [P] [US1] Create `apps/web/src/components/muscle-figure.tsx`: `MuscleFigure({ side, load, selected, onSelect })`, an original stylised inline SVG per side (silhouette `fill-heat-0 stroke-line`, one `<path>` per region of that side with left+right halves as sub-paths, `fill-heat-{step}`); worked regions `tabIndex={0}`, `role="button"`, `aria-label="{Label}, {n} sets"`, `aria-pressed`, selected outline `stroke-ink`, `onPointerEnter`/`onFocus`/`onClick` → `onSelect`; neutral regions `aria-hidden` + `pointer-events-none`
- [X] T006 [US1] Create `apps/web/src/components/muscle-heatmap.tsx`: `MuscleHeatmap({ load, onShowExercises })`, a `cardClass` card with front and back figures side by side (fits 320 px), card `aria-label` "Muscles worked: …" (step ≥ 1, highest score first)
- [X] T007 [US1] In `apps/web/src/components/gym-screen.tsx`: `load = useMemo(() => dayMuscleLoad(view.exercises.flatMap(e => e.entry ? [e.entry] : [])), [view.exercises])`; render `<MuscleHeatmap>` right after the summary row only when `hasMuscleLoad(load)`

## Phase 4: User Story 2 - Read the detail for one muscle (P2)

**Independent Test**: quickstart row 6.

- [X] T008 [US2] In `apps/web/src/components/muscle-heatmap.tsx`: `selected` state; detail line "{Label} · {direct} set(s)" + " · {indirect} indirect" when > 0; Escape, re-tapping the selection or `pointerdown` outside the card clears it; clear when the selected region's step becomes 0

## Phase 5: User Story 3 - Filter the exercise list by a muscle (P3)

**Independent Test**: quickstart rows 7–8.

- [X] T009 [US3] In `apps/web/src/components/muscle-heatmap.tsx`: **Show exercises** text button in the detail line calling `onShowExercises(selected)`
- [X] T010 [US3] In `apps/web/src/components/gym-screen.tsx`: `region` state; when set, `shown = exercisesForRegion(view.exercises, region)`, `MusclePills` `dimmed`, and a `chipClass(true)` chip "{Label}" with lucide `X` (16, `strokeWidth={1.75}`, `aria-label="Clear muscle filter"`) above the list; clear on chip press, pill choice, search input, and when `initialView.date !== seen.date` (not on every new `initialView`: saves call `router.refresh()`) (research R7)

## Phase 6: Polish

- [X] T011 Add a "Muscle heatmap (feature 018)" section to `CLAUDE.md` (module, mapping rules, tokens, own-tab only)
- [X] T012 Run `pnpm check` and fix any type, lint or test failures

## Dependencies

- T001, T002 → T003 → T004 → US1 (T005 ∥ then T006 → T007) → US2 (T008) → US3 (T009 → T010) → T011, T012.
- T005 can start alongside T003 (it only needs the exported types; write after T004 lands if the type import fails).

## Parallel Examples

- T001 ∥ T002 (different files).
- T005 ∥ T011 once T004 is done.

## Implementation Strategy

MVP = Phases 1–3 (figure only). US2 and US3 add to the same two components and can ship in the same change.
