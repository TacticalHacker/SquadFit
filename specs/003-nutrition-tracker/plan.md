# Implementation Plan: Nutrition Tracker

**Branch**: `003-nutrition-tracker` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-nutrition-tracker/spec.md`

## Summary

A signed-in user logs what they ate into four meals, either typed or picked from a built-in list of 40 foods, their own saved foods or their recent foods, with servings and optional protein, carbs and fat. A ledger shows eaten, burned (from the workout entries), net, remaining against the daily target and macro totals. Days, the three-day edit window and "today" work exactly as in workouts.

Approach:
- **Domain first** (test-first, in `packages/shared`): servings and macro rounding, the 40-food catalog, meal defaults, `buildFoodDay` / `applyFoodChange` (shared by server and optimistic client), `recentFoods`.
- **Storage**: two item types in the existing DynamoDB table, `FOODLOG#<date>#<entryId>` and `FOOD#<id>` under `USER#<sub>`; entries carry a snapshot of the rate they were logged with. No new indexes, tables or dependencies.
- **API**: nine JWT-protected Lambda routes; one food day view per screen and per mutation.
- **Web**: `/food` with an optimistic day screen, add panel (Find / Quick entry), inline editing; `/food/mine` for own foods; shared `DayNav`.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing only: Next.js 16.4 (App Router, Cache Components, Server Actions, React 19.3 `useOptimistic`), Tailwind 4, zod 4, AWS SDK v3 `lib-dynamodb`, AWS CDK 2.276. **No new dependencies.**

**Storage**: DynamoDB single table (food entries, own foods). The built-in catalog is code. Workout entries (feature 002) are read for the burned figure.

**Testing**: Vitest (shared domain, API handlers with in-memory repos and a fixed clock, web pure helpers), `aws-cdk-lib/assertions`, manual [quickstart.md](quickstart.md) on `dev`

**Target Platform**: Web browsers (mobile first) → Amplify Hosting (Next server) → API Gateway HTTP API → Lambda (arm64), `ap-south-1`

**Project Type**: Web application (extends the 001/002 monorepo)

**Performance Goals**: Add → UI updated < 1 s (SC-001, met by the optimistic update); a day or a month loads < 1 s (SC-006: one Query for the day, one for that day's workouts, one profile Get)

**Constraints**: "Today" and the edit window computed only on the server from the profile timezone; entries immutable in date and snapshot values; food data never exposed to other users

**Scale/Scope**: About 3 users (designed for ≤ 100), ≤ ~15 entries per user per day (recent foods reads at most ~1,400 items); 2 web routes, 9 API routes, 0 new infra resources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Pre-research | Post-design | Evidence |
|---|---|---|---|
| I. Spec-Driven Delivery | ✅ | ✅ | Spec clarified (five answers recorded), no open markers; every plan decision cites an FR or clarification. |
| II. End-to-End Type Safety | ✅ | ✅ | All request/response shapes are zod schemas in `packages/shared/src/contracts/food.ts`; handlers `safeParse` input; the web server parses output. |
| III. Test-First Domain Logic | ✅ | ✅ | Servings math, catalog invariants, ledger, day view/optimistic equivalence, recent foods and meal defaults are pure functions in `packages/shared/src/domain` with failing tests first (research R11). Handlers stay thin behind a `FoodRepo` interface. CDK assertions cover the new routes. |
| IV. IaC, Serverless by Default | ✅ | ✅ | Only new CDK routes on the existing Api stack; no new always-on or stateful services; per-function table grants. |
| V. Server-Authoritative, Fair Scoring | ✅ | ✅ | Server computes `today` from the profile timezone, enforces the 3-day window, recomputes calories and macros from the entry's own rate and recomputes the ledger; optimistic numbers are display-only. The ledger is informational (FR-011): no score is produced, and entries keep immutable snapshots so later scoring cannot be altered retroactively. |
| VI. Members-Only Visibility | ✅ | ✅ | JWT authorizer on all routes; every key starts with the caller's `sub`; nothing is added to the People response; no food data in logs. |
| VII. Simplicity | ✅ | ✅ | Catalog in code, no GSI, no summary item (ledger derived on read), recent foods derived with one range Query, all-or-none macros, hard delete of own foods (research R3, R4, R6, R7). |

**Result**: PASS with no violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-nutrition-tracker/
├── plan.md              # This file
├── research.md          # Phase 0: catalog, servings math, keys, macros, ledger, recents, UI
├── data-model.md        # Phase 1: food entry, own food, derived ledger and recents
├── quickstart.md        # Phase 1: 33 end-to-end scenarios
├── contracts/
│   ├── api.md           # 9 HTTP routes
│   └── web.md           # Routes, Server Actions, optimistic behaviour
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/
│   ├── nutrition.ts         # limits, MEALS, ServingsSchema, scaleCalories(), scaleGrams(), macro schemas
│   ├── foods.ts             # STANDARD_FOODS, normalizeFoodName(), isOwnFoodNameTaken(), OwnFoodInputSchema
│   ├── food-day.ts          # buildFoodDay(), applyFoodChange(), entryFromFood(), defaultMealForHour()
│   └── recent-foods.ts      # recentFoods()
└── contracts/
    └── food.ts              # EntryCreateSchema (union), EntryPatchSchema, FoodDayViewSchema, RecentFoodsSchema, OwnFood schemas
packages/shared/test/        # nutrition, foods, food-day, recent-foods tests (written first)

services/api/src/
├── lib/
│   ├── food-repo.ts         # FoodRepo interface + DynamoFoodRepo (entries, own foods)
│   ├── day-context.ts       # (002) loadDayContext also returns dailyCalorieTarget
│   ├── food-day-loader.ts   # loadFoodDay(): entries + workout total + target → buildFoodDay
│   └── deps.ts              # + food repo
└── handlers/
    ├── food-get.ts                # GET /food
    ├── food-entry-post.ts         # POST /food/entries/{date}
    ├── food-entry-put.ts          # PUT /food/entries/{date}/{entryId}
    ├── food-entry-delete.ts       # DELETE /food/entries/{date}/{entryId}
    ├── food-recent-get.ts         # GET /food/recent
    ├── own-foods-get.ts           # GET /food/foods
    ├── own-foods-post.ts          # POST /food/foods
    ├── own-foods-put.ts           # PUT /food/foods/{foodId}
    └── own-foods-delete.ts        # DELETE /food/foods/{foodId}
services/api/test/               # handler tests with InMemoryFoodRepo and a fixed clock

infra/
├── lib/api-stack.ts         # + 9 routes (table write on mutating ones)
└── test/stacks.test.ts      # + route and authorizer assertions

apps/web/src/
├── server/actions/food.ts   # entry and own-food actions
├── lib/food-input.ts        # parse calories / macros / servings text fields
├── components/
│   ├── food-screen.tsx          # client: optimistic day, meals, ledger, add panel, midnight check
│   ├── food-ledger.tsx          # remaining bar, eaten / burned / net, macro totals
│   ├── food-add-panel.tsx       # Find and Quick entry tabs
│   ├── own-food-form.tsx        # add / edit / remove own foods
│   ├── day-nav.tsx              # generalised with basePath
│   └── nav-links.tsx            # + Food link
└── app/(app)/food/
    ├── page.tsx             # day view
    └── mine/page.tsx        # own foods
```

**Structure Decision**: Reuse the monorepo layout: pure rules and contracts in `packages/shared`, thin handlers in `services/api`, route registration in `infra/lib/api-stack.ts`, UI and Server Actions in `apps/web`. `buildFoodDay`/`applyFoodChange` live in `shared` so the optimistic client and the authoritative server cannot drift (the pattern from 002).

## Complexity Tracking

No constitution violations to justify.
