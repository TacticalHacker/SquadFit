# Implementation Plan: Workout Tracker

**Branch**: `002-workout-tracker` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-workout-tracker/spec.md`

## Summary

A signed-in user ticks workouts from a checklist (a code-defined standard list of 12 plus their own), each tick logging an entry for a day with default or edited minutes and proportional calories. Totals update instantly, the last three days are editable and earlier days are read-only history, and "today" always comes from the user's profile timezone on the server.

Approach:
- **Domain first** (test-first, in `packages/shared`): `caloriesFor`, `summarize`, `localDate`/`addDays`/`isEditableDay`, workout-name rules, the standard catalog, and pure `buildDayView` / `applyChange` used by both server and client.
- **Storage**: two item types in the existing DynamoDB table, `ENTRY#<date>#<workoutId>` and `WORKOUT#<id>`, under `USER#<sub>`; no new indexes, no new tables.
- **API**: seven JWT-protected Lambda routes; one response (the day view) per screen and per mutation.
- **Web**: `/workouts` with an optimistic checklist (`useOptimistic` + Server Actions), day navigation, 7-day strip and midnight refresh; `/workouts/mine` for custom workouts; `/` redirects to `/workouts`.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing only: Next.js 16.4 (App Router, Cache Components, Server Actions, React 19.3 `useOptimistic`), Tailwind 4, zod 4, AWS SDK v3 `lib-dynamodb`, AWS CDK 2.276. **No new dependencies.**

**Storage**: DynamoDB single table (entries, custom workouts). The standard catalog is code.

**Testing**: Vitest (shared domain, API handlers with an in-memory repo and fixed clock, web pure helpers), `aws-cdk-lib/assertions`, manual [quickstart.md](quickstart.md) on `dev`

**Target Platform**: Web browsers (mobile first) → Vercel (Next server) → API Gateway HTTP API → Lambda (arm64), `ap-south-1`

**Project Type**: Web application (extends the 001 monorepo)

**Performance Goals**: Tick → UI updated < 1 s (SC-001, met by optimistic update); a day or a month loads < 1 s for a year of history (SC-006, one `Query` per request)

**Constraints**: "Today" and the edit window computed only on the server from the profile timezone; entries immutable in their date and snapshot values; workout data never exposed to other users

**Scale/Scope**: About 3 users (designed for ≤ 100), ≤ ~15 entries per user per day; 2 web routes, 7 API routes, 0 new infra resources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Pre-research | Post-design | Evidence |
|---|---|---|---|
| I. Spec-Driven Delivery | ✅ | ✅ | Spec clarified (edit window), no open markers; every plan decision cites an FR. |
| II. End-to-End Type Safety | ✅ | ✅ | All request/response shapes are zod schemas in `packages/shared/src/contracts/workouts.ts`; handlers `safeParse` input; the web server parses output. |
| III. Test-First Domain Logic | ✅ | ✅ | Calories, summary, day/timezone/edit-window and name rules are pure functions in `packages/shared/src/domain` with failing tests first (research R10); `buildDayView`/`applyChange` too. Handlers stay thin behind a `WorkoutRepo` interface. CDK assertions cover the new routes. |
| IV. IaC, Serverless by Default | ✅ | ✅ | Only new CDK routes on the existing Api stack; no new always-on or stateful services; per-function table grants. |
| V. Server-Authoritative, Fair Scoring | ✅ | ✅ | Server computes `today` from the profile timezone (never UTC, never client), enforces the 3-day window and recomputes calories and totals; optimistic UI numbers are display-only. The leaderboard formula is out of scope; entries keep immutable snapshots so later scoring can't be altered retroactively. |
| VI. Members-Only Visibility | ✅ | ✅ | JWT authorizer on all routes; every key starts with the caller's own `sub`; nothing is added to the People response; no workout data in logs. |
| VII. Simplicity | ✅ | ✅ | Catalog in code, no GSI, no client cache library, no summary item (sum on read), name uniqueness without a lock item (research R7). |

**Result**: PASS with no violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-workout-tracker/
├── plan.md              # This file
├── research.md          # Phase 0: catalog, calories, keys, day logic, optimistic UI, rollover
├── data-model.md        # Phase 1: entry and custom-workout items, derived day view
├── quickstart.md        # Phase 1: 26 end-to-end scenarios
├── contracts/
│   ├── api.md           # 7 HTTP routes + new error codes
│   └── web.md           # Routes, Server Actions, optimistic behaviour
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/
│   ├── calories.ts          # caloriesFor(), summarize(), minute/calorie limits
│   ├── day.ts               # localDate(), addDays(), isEditableDay(), dateRange(), EDIT_WINDOW_DAYS
│   ├── workouts.ts          # STANDARD_WORKOUTS, normalizeWorkoutName(), name clash check
│   └── day-view.ts          # buildDayView() (server), applyChange() (optimistic, client)
└── contracts/
    ├── errors.ts            # + DAY_LOCKED, DUPLICATE_NAME, NOT_FOUND
    └── workouts.ts          # DateSchema, EntryPutSchema, CustomWorkoutInputSchema, DayViewSchema, …
packages/shared/test/        # calories, day (zones + DST), workouts, day-view tests (written first)

services/api/src/
├── lib/
│   ├── workout-repo.ts      # WorkoutRepo interface + DynamoWorkoutRepo (entries, custom workouts)
│   ├── day-context.ts       # profile → { timezone, today }, 409 PROFILE_REQUIRED helper, date validation
│   └── deps.ts              # + workouts repo
└── handlers/
    ├── workouts-get.ts            # GET /workouts
    ├── workouts-summary-get.ts    # GET /workouts/summary
    ├── entry-put.ts               # PUT /workouts/entries/{date}/{workoutId}
    ├── entry-delete.ts            # DELETE /workouts/entries/{date}/{workoutId}
    ├── custom-post.ts             # POST /workouts/custom
    ├── custom-put.ts              # PUT /workouts/custom/{workoutId}
    └── custom-delete.ts           # DELETE /workouts/custom/{workoutId}
services/api/test/               # handler tests with InMemoryWorkoutRepo and a fixed clock

infra/
├── lib/api-stack.ts         # + 7 routes (table write on mutating ones)
└── test/stacks.test.ts      # + route and authorizer assertions

apps/web/src/
├── server/
│   └── actions/workouts.ts  # tickWorkout, untickWorkout, setEntryMinutes, custom workout actions
├── components/
│   ├── workout-checklist.tsx    # client: useOptimistic, minutes edit, errors, midnight check
│   ├── day-nav.tsx              # prev/next/today links, date label
│   ├── day-strip.tsx            # 7-day totals strip
│   └── custom-workout-form.tsx  # add/edit/remove forms
└── app/(app)/
    ├── page.tsx                 # redirect("/workouts")
    ├── layout.tsx               # + Workouts nav link
    └── workouts/
        ├── page.tsx             # day view + strip
        └── mine/page.tsx        # custom workouts
```

**Structure Decision**: Reuse the 001 monorepo layout unchanged: pure rules and contracts in `packages/shared`, thin handlers in `services/api`, route registration in `infra/lib/api-stack.ts`, UI and Server Actions in `apps/web`. The pure `applyChange` lives in `shared` so the optimistic client and the authoritative server cannot drift.

## Complexity Tracking

No constitution violations to justify.
