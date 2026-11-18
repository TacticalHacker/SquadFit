# Tasks: Health Activity Sync (012)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Lean (constitution III). Write domain tests first. Handler tests cover only auth, the overwrite rule and privacy.

## Phase 1: Setup

- [x] T001 Amend constitution VI to 2.5.0 (steps, goal, goal hits, step-run items, and profile-only active kcal/distance may be shown when the owner is visible and shares steps; no ranking by active calories) in .specify/memory/constitution.md

## Phase 2: Foundational (blocks all stories)

- [x] T002 [P] Write failing tests for `toNumber`, `normalizeActivityBody` (array, single object, `{days: object}`, strings "8,423.0", HAE summing + mi/kJ conversion, last duplicate date wins), `validateActivityDays` ("steps 0–100,000; active_kcal 0–5,000; distance 0–150 km; date ≤ today and ≥ today − 30", readable "18 Nov: …" messages), `isStepGoalHit`, `rankSteps` (no-data excluded, ties share rank), `isStepRun` in packages/shared/test/activity.test.ts
- [x] T003 Implement the functions from T002 in packages/shared/src/domain/activity.ts (constants: STEP_GOAL_DEFAULT 8000, STEP_GOAL_MIN 1000, STEP_GOAL_MAX 50000, ACTIVITY_MAX_DAYS 31, ACTIVITY_BACK_DAYS 30, STEP_STREAK_DAYS 7)
- [x] T004 [P] Add zod contracts (ActivityDay, ActivitySaveResult, HealthSyncStatus, HealthTokenIssued, StepSettings/StepSettingsInput, ActivitySource enum `mcp|shortcut|health_auto_export|manual`) in packages/shared/src/contracts/activity.ts and export from packages/shared/src/index.ts
- [x] T005 [P] Add `generateHealthToken`, `parseHealthBearer` (`sfh_` + 43 base64url chars) to packages/shared/src/domain/ai-credential.ts
- [x] T006 [P] Add `ActivityRepo` (putDays in one transaction, listRange, latest) in services/api/src/lib/activity-repo.ts
- [x] T007 [P] Add `HealthTokenRepo` (findUserId, get, issue, revoke, touch, hit per UTC hour with ttl) in services/api/src/lib/health-token-repo.ts
- [x] T008 Add `dailyStepGoal` / `shareSteps` to ProfileItem, `stepSettingsOf`, `setStepSettings` in services/api/src/lib/profile-repo.ts. Wire `activity` and `healthTokens` into services/api/src/lib/deps.ts and the in-memory fakes in services/api/test/fakes.ts
- [x] T009 Add the `activity-write.ts` save service (validate in the owner's timezone → putDays → safeRefreshSteps → result with goalHit) in services/api/src/lib/activity-write.ts

## Phase 3: US1 Shortcut sync (P1) 🎯 MVP

**Independent test**: generate a token, POST a day, the day is stored and the status shows the last sync.

- [x] T010 [US1] Write a test: valid token saves; re-send replaces (not adds); a later source wins; a wrong/revoked token gives 401; an `sfh_` token gives 401 on /mcp; a 422 message is readable; in services/api/test/integrations-activity.test.ts
- [x] T011 [US1] Implement POST /integrations/activity (1 MB limit, 401/409/413/422/429, touch lastUsedAt, never log the body) in services/api/src/handlers/integrations-activity-post.ts
- [x] T012 [P] [US1] Implement GET /me/health-sync, POST /me/health-token and DELETE /me/health-token in services/api/src/handlers/me-health-sync-get.ts, me-health-token-post.ts, me-health-token-delete.ts
- [x] T013 [US1] Add the five routes (integrations auth:false write; token post/delete write; steps put write; health-sync get) in infra/lib/api-stack.ts
- [x] T014 [US1] Add Server Actions (issue, revoke, saveSteps) in apps/web/src/server/actions/health.ts and the Apple Health sync section (token reveal once + copy, Shortcut button from HEALTH_SHORTCUT_URL, endpoint URL, setup steps, last sync) in apps/web/src/components/health-sync-section.tsx, wired into apps/web/src/app/(app)/settings/page.tsx

## Phase 4: US2 AI agent (P1)

- [x] T015 [US2] Implement `upsert_daily_activity` (verbatim description) and `get_daily_activity` in services/api/src/lib/mcp/activity.ts and register them in services/api/src/lib/mcp/tools.ts
- [x] T016 [US2] Write a test: the MCP upsert saves with source mcp and returns goalHit; invalid input saves nothing; in services/api/test/mcp-activity.test.ts

## Phase 5: US5 Privacy controls (P1)

- [x] T017 [US5] Add `stepsShared` / `stepsFor` in services/api/src/lib/member-access.ts. Implement PUT /me/steps (goal "whole number 1,000–50,000", shareSteps) in services/api/src/handlers/me-steps-put.ts. Add `OwnProfile.steps` in packages/shared/src/contracts/me.ts and services/api/src/handlers/me-get.ts (or its view helper)
- [x] T018 [US5] Add the goal and "Share my steps" fields to the Settings section in apps/web/src/components/health-sync-section.tsx

## Phase 6: US3 Profiles and Today's view (P2)

- [x] T019 [US3] Extend contracts: optional `DayCard.steps`, `Today.restDays`, `MemberProfile.steps`, leaderboard `stepsToday` in packages/shared/src/contracts/squad-profile.ts
- [x] T020 [US3] Add steps to the member, timeline, day and today handlers (through `stepsFor` only) in services/api/src/handlers/squad-member-get.ts, squad-member-timeline-get.ts, squad-member-day-get.ts, squad-today-get.ts and services/api/src/lib/member-view.ts
- [x] T021 [P] [US3] Steps line on day cards and rest-day cards in apps/web/src/components/day-card.tsx and today-workouts.tsx; a 30-day chart and "from Apple Health" info in apps/web/src/components/steps-chart.tsx and member-profile.tsx

## Phase 7: US4 Steps board (P2)

- [x] T022 [US4] Add `stepsBoard` and `stepsToday` to services/api/src/handlers/squad-leaderboard-get.ts using `rankSteps`
- [x] T023 [US4] Write a test: the board excludes no-data members, `shareSteps:false` and hidden members; in services/api/test/squad-steps.test.ts
- [x] T024 [US4] Add the Steps board tab (week/30d only) and steps on expanded rows in apps/web/src/components/squad-boards.tsx and the related squad page

## Phase 8: US6 Feed (P3)

- [x] T025 [US6] Implement `step_streak` events (`steps7#<end>`) in services/api/src/lib/step-events.ts; call them from activity-write, me-steps-put and me-squad-put; add the kind to the feed and timeline contracts; drop the items at read time for non-sharing authors in services/api/src/handlers/squad-feed-get.ts and the timeline; render them in apps/web/src/components/squad-feed.tsx and timeline.tsx

## Phase 9: US7 Health Auto Export (P3)

- [x] T026 [US7] Covered by T002/T003 (detection, summing, units) and T011 (source `health_auto_export`). Verify with a sample payload in the T010 test

## Phase 10: Polish

- [x] T027 [P] Document feature 012 in CLAUDE.md
- [x] T028 Run `pnpm check` and `pnpm synth`; fix failures

## Dependencies

Setup → Foundational (T002–T009) → US1 → (US2, US5 in parallel) → US3 → US4 → US6. US7 rides on the Foundational phase and US1.
MVP: Phases 1–3.
