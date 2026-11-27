# Tasks: Live PR Badge (019)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md)

Tests: domain logic is test-first (constitution III), kept lean.

## Phase 1: Setup

- [X] T001 Confirm the branch `019-pr-badge` and a green baseline with `pnpm check`

## Phase 2: Foundational (one PR definition, blocks every story)

- [X] T002 Write `packages/shared/test/pr.test.ts` from the spec acceptance table (bests 80×8, sessions 1): 82.5×5 weight +2.5; 80×10 reps +2; 77.5×12 reps +4; 60×15 none; 80×8 none; 125×3 weight +45 + big jump; 110×3 weight +30, no big jump; sessions 0 none; 0 kg none; two PR sets → top; `addToBests` frontier merge; `bestsBefore` today / past day without entry / unknown
- [X] T003 Implement `packages/shared/src/domain/pr.ts`: `PrBests` (`sessions`, `bestWeight {weightKg, reps, date} | null`, `bestE1rm: number | null`, `frontier` weight desc / reps strictly increasing), `classifySet`, `pickTopPr` (weight > reps > e1rm, then larger gain, then earlier set), `isBigJump` (>50% and >20 kg), `addToBests`, `bestsBefore`, `previewPr` (counts sets with reps ≥ 1 and weight > 0, ticked or not); export from `packages/shared/src/index.ts`
- [X] T004 Extend `packages/shared/test/squad.test.ts`: a Rep PR day yields a `pr` event with `type: "reps"`; a held big jump has no record until `jumpConfirmedAt`; a heavier earlier day removes a later PR; `prBase.before[date]` excludes that date
- [X] T005 Rework `walkLift` in `packages/shared/src/domain/squad.ts` to classify eligible sets with `pr.ts` against the bests before the day; `PrDay` gains `type`, `gainReps`, `records: PrRecord[]` (`type`, `value`, `previous`, `weightKg`, `reps`, `setIndex`, `achievedAt`); `LiftStats.prBase = { all, before }` for the latest `GYM_LAST_KEEP` entry dates; feed payload gains `type`, `gainReps`
- [X] T006 [P] Contracts: `PrBestsSchema`, `GymExerciseSchema.bests` (`.nullable().default(null)`), `GymSaveResultSchema.prs` / `streakWeeks` (`.int().nonnegative().default(0)`) in `packages/shared/src/contracts/gym.ts`; feed `pr.type` (`z.enum(["weight","reps","e1rm"]).nullable().default(null)`) and `pr.gainReps` in `packages/shared/src/contracts/squad.ts`; add `bests: null` default in `buildGymView` (`packages/shared/src/domain/gym.ts`)

## Phase 3: User Story 1 - See a PR the moment I enter it (P1) 🎯 MVP

Independent test: quickstart manual steps 1, 2, 5 with the network tab silent.

- [X] T007 [US1] `services/api/src/lib/gym-view-loader.ts`: reuse the stats read for `bests` per strength exercise via `bestsBefore(stats.lifts[id]?.prBase, date)`; cardio `null`
- [X] T008 [P] [US1] PR wording in `apps/web/src/lib/plain.ts`: `prBadgeText`, `baselineLine`, `BIG_JUMP_HINT`, `prAnnounce`
- [X] T009 [P] [US1] `apps/web/src/lib/haptics.ts`: `prHaptic()` = `navigator.vibrate([15, 40, 15])` when available, else click a hidden iOS `<input type="checkbox" switch>` label; silent no-op
- [X] T010 [US1] `apps/web/src/components/pr-badge.tsx`: footer line = pill (`bg-accent-fill text-on-accent-fill`, fade, no scale) / baseline (muted) / normal line; "Big jump — typo?" under the pill
- [X] T011 [US1] `apps/web/src/components/gym-drawer.tsx`: compute the preview in `dispatch` (haptic + announce when the PR key changes), render `PrBadge` in the footer, ★ at the end of the PR set's row, hidden polite live region

## Phase 4: User Story 2 - Saving confirms the PR (P2)

Independent test: quickstart manual steps 3, 4.

- [X] T012 [US2] `services/api/src/lib/gym-view-loader.ts` `loadGymSaveResult`: `prs` = records of that exercise on that date, `streakWeeks` = `streakFigures(...).current`
- [X] T013 [P] [US2] `services/api/src/handlers/squad-feed-get.ts`: pass `type`, `gainReps`; feed Rep PR line in `apps/web/src/lib/plain.ts`
- [X] T014 [P] [US2] `apps/web/src/components/toast.tsx` (3 s, tap to close, `role="status"`, never blocks) and `prToast` wording in `plain.ts`
- [X] T015 [US2] `apps/web/src/components/gym-screen.tsx`: show the toast from `onSaved` with volume from the saved entry
- [X] T016 [US2] API test in `services/api/test`: save 82.5×5 after an 80×8 day returns `prs: 1`; gym view carries `bests`

## Phase 5: User Story 3 - Works for everyone (P3)

- [X] T017 [US3] Check reduced motion (global rule in `apps/web/src/app/globals.css` covers the fade) and that the announcement fires once per PR key in `gym-drawer.tsx`

## Phase 6: Polish

- [X] T018 Add a "PR badge (feature 019)" section to `CLAUDE.md` (rules, `prBase`, rollout: deploy then `pnpm admin squad backfill`)
- [X] T019 Run `pnpm check` and fix failures

## Dependencies

T002–T006 before all stories. US1 (T007–T011) is the MVP. US2 needs T005/T006 only. US3 after US1.

## Parallel examples

- T006 alongside T003–T005 (different files).
- T008, T009 together; T013, T014 together.
