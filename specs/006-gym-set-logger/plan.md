# Implementation Plan: Gym Set Logger

**Branch**: `006-gym-set-logger` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-gym-set-logger/spec.md`

## Summary

A mobile-first "Gym" tab inside Workouts: a sticky muscle-group pill bar, search, built-in and own exercises, and a bottom-sheet drawer with thumb-sized steppers for sets, reps and weight, per-set ticks, pre-fill from last time and on-device drafts. Each saved exercise is a **workout entry** in feature 002's `ENTRY#<date>#<id>` key space, so day totals, the 7-day strip, the food ledger's burned figure and the AI history include it with no second query (research R1).

Approach:
- **Domain first** (test-first, `packages/shared/src/domain`): `gym.ts` (catalog, `gymTotals`, `topSet`, input parsers, name rules, `filterExercises`, `buildGymView`), `gym-drawer.ts` (`initDrawer`, `drawerReducer`), and `buildDayView` extended to split gym entries (R12).
- **Storage**: gym entries as `ENTRY#…` items with `kind: "gym"` and `gsi1pk = GYM#<sub>#<exerciseId>` for "last time" lookups (R5); own exercises as `GYMEX#gc-<uuid>`. Existing table and `gsi1`; no new infra resources besides Lambdas.
- **API**: six JWT routes under `/workouts/gym…`; 002 routes refuse gym ids; MCP history gains set detail.
- **Web**: `/workouts/gym` page, `WorkoutsTabs`, hand-built `<dialog>` bottom sheet, steppers, `localStorage` drafts.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing only: Next.js 16 (App Router, Cache Components, Server Actions), React 19, Tailwind 4, zod 4, AWS SDK v3 `lib-dynamodb`, AWS CDK v2. **No new dependencies** (research R9 rejects a drawer library).

**Storage**: DynamoDB single table: gym entries (in the 002 `ENTRY#` space), own exercises; existing `gsi1` for last-entry lookups. Drafts in browser `localStorage`. Built-in exercises are code.

**Testing**: Vitest (shared domain incl. reducer; API handlers with `services/api/test/fakes.ts` extended for gym + GSI query; web pure helpers incl. draft storage), `aws-cdk-lib/assertions` for new routes/grants, manual [quickstart.md](quickstart.md) on a real phone.

**Target Platform**: Phone browsers first (iOS Safari 17+, Android Chrome) → Vercel → API Gateway HTTP API → Lambda arm64

**Project Type**: Web application (monorepo: `apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: Drawer opens with pre-filled values with no network wait (SC-001); save round-trip < 1 s (SC-006); `GET /workouts/gym` < 1 s with ≤ 80 parallel single-item GSI reads (R5).

**Constraints**: 44 × 44 px tap targets; 16 px inputs (no iOS zoom); drawer ≤ 85 dvh; no horizontal page scroll at 375 px; server recomputes all totals; "today" from profile timezone; never log sets, weights or names.

**Scale/Scope**: ~3 members; 30 built-in exercises, ≤ 50 own per member; ≤ 20 sets per entry; one entry per exercise per day.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Spec-Driven | ✅ | Spec clarified (5 Qs, no markers). Nothing beyond FR-001..FR-025. |
| II. End-to-End Types | ✅ | `contracts/gym.ts` zod schemas parsed by handlers and by the web; strict body schema rejects client totals. |
| III. Test-First Domain | ✅ | `gymTotals`, `topSet`, parsers, `drawerReducer`, `buildGymView`, extended `buildDayView` get failing tests first; CDK assertions for new routes and grants. |
| IV. IaC, Serverless | ✅ | Six `NodejsFunction` routes via `route()`; no new stateful resource; least privilege (read-only for `gym-get`, write only for mutations). |
| V. Server-Authoritative | ✅ | Minutes/calories/volume computed on the server from sets (FR-014); edit window and `today` server-side; client uses the same pure function only for preview. Calorie burn is a fixed per-set estimate; no scoring formula is introduced (leaderboard is a later feature). |
| VI. Members-Only Visibility | ✅ | All items under `USER#<sub>`; no route returns another member's gym data; `PublicMemberSchema` untouched; drafts stay on device, keyed by user; no logging of sets/names. AI history only for the key holder. |
| VII. Simplicity | ✅ (1 note) | Reuses 002 entry space, `gsi1`, `<dialog>`. Fan-out of per-exercise GSI reads is the one non-obvious choice; see Complexity Tracking. |

**Post-design re-check**: ✅ unchanged after research/data-model/contracts.

## Project Structure

### Documentation (this feature)

```text
specs/006-gym-set-logger/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/api.md, contracts/web.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/gym.ts              # NEW catalog, gymTotals, topSet, parsers, names, filterExercises, buildGymView
├── domain/gym-drawer.ts       # NEW initDrawer, drawerReducer
├── domain/day-view.ts         # CHANGED split gym entries, gymMinutes
├── contracts/gym.ts           # NEW GymView, GymEntryPut, exercise input, GymDraft
├── contracts/workouts.ts      # CHANGED DayView.gym, gymMinutes
├── contracts/errors.ts        # CHANGED + LIMIT_REACHED
└── index.ts                   # export new modules
packages/shared/test/gym.test.ts, gym-drawer.test.ts, gym-view.test.ts, day-view.test.ts (extended)

services/api/src/
├── handlers/gym-get.ts, gym-entry-put.ts, gym-entry-delete.ts            # NEW
├── handlers/gym-exercise-post.ts, gym-exercise-put.ts, gym-exercise-delete.ts  # NEW
├── handlers/entry-put.ts, entry-delete.ts   # CHANGED 404 for gx-/gc- ids
├── lib/gym-repo.ts            # NEW entries (kind=gym) + own exercises + last-by-GSI
├── lib/gym-view-loader.ts     # NEW
├── lib/workout-repo.ts        # CHANGED toEntry keeps kind + gym fields
├── lib/deps.ts                # CHANGED add gym repo
└── lib/mcp/tools.ts           # CHANGED history gym detail
services/api/test/             # fakes + handler tests

infra/lib/api-stack.ts         # CHANGED 6 routes; infra/test assertions

apps/web/src/
├── app/(app)/workouts/gym/page.tsx    # NEW
├── app/(app)/workouts/page.tsx        # CHANGED tabs, gym entries in Logged today
├── components/workouts-tabs.tsx, gym-screen.tsx, muscle-pills.tsx, exercise-list.tsx,
│   bottom-sheet.tsx, gym-drawer.tsx, stepper.tsx, number-field.tsx, custom-exercise-form.tsx  # NEW
├── components/workout-checklist.tsx   # CHANGED gym rows + Strength training hint
├── server/actions/gym.ts              # NEW
├── lib/gym-draft.ts (+ test)          # NEW
├── app/globals.css                    # CHANGED .no-scrollbar
└── app/layout.tsx                     # CHANGED viewport interactiveWidget (if absent)
```

**Structure Decision**: Extend the existing monorepo packages; gym code sits beside workouts code in each package, mirroring feature 002's split (domain → contracts → handlers/repo → routes → web).

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| Up to 80 parallel `Limit 1` GSI queries per `GET /workouts/gym` (R5) | Drawer must open with "last time" values already in place (SC-001) | Fetch-on-open swaps numbers under the thumb after opening; a stored "last" pointer goes stale on back-dated saves and removes. Fallback documented if latency is a problem. |
