# Implementation Plan: Exercise Admin Panel

**Branch**: `015-exercise-admin-panel` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-exercise-admin-panel/spec.md`

## Summary

Admins (Cognito group `admin`, granted by `pnpm admin admins add`) manage a gym exercise catalog stored in the existing DynamoDB table (`GYMCATALOG` partition + name guards). The API merges it with the code built-ins into a "library" (cached 2 minutes per Lambda container) that the gym view, gym save, own-exercise name checks and the MCP agent all use, so new exercises need no deploy. A `/settings/admin` page lists the library, adds/renames/regroups/retires/restores catalog exercises, and merges members' same-name own exercises via a shared merge service (moved out of the operator script).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Next.js 16 App Router + Tailwind 4 (web), AWS Lambda + API Gateway HTTP API, AWS SDK v3 (DynamoDB, Cognito Identity Provider), zod, lucide-react

**Storage**: Existing DynamoDB single table (new `GYMCATALOG` / `GYMCATALOGNAME#` items); Cognito user-pool group `admin`

**Testing**: Vitest (shared, api, web), `aws-cdk-lib/assertions` (infra)

**Target Platform**: AWS Lambda (ap-south-1), web on AWS Amplify Hosting

**Project Type**: Web app + serverless API monorepo

**Performance Goals**: Gym page load within 10% of today (one extra small query per container every 2 min); admin changes visible to members ≤ 5 min

**Constraints**: Server-enforced admin checks; no member data in admin responses beyond counts; no logging of names/sets; built-in ids unchanged

**Scale/Scope**: Tens of members, 2 admins, ≤ 200 catalog exercises, 4 new API routes, 1 web page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|---|---|
| I. Spec-Driven Delivery | ✅ spec.md complete, no open clarifications |
| II. End-to-End Type Safety | ✅ new zod contracts in `packages/shared/src/contracts/admin-exercises.ts`, parsed in handlers and the web client |
| III. Test-First Domain Logic (lean) | ✅ failing tests first for `buildLibrary`, `isLibraryNameTaken`, `catalogId` slugging, `isAdminClaim`; handler tests only for admin 403 + happy path + duplicate, gym save with catalog/retired id, MCP name match; CDK assertion for the `admin` group and route grants |
| IV. IaC, Serverless | ✅ Cognito group and routes in CDK; per-function grants (admin routes: table read/write; merge: 60 s timeout); no new stateful service |
| V. Server-Authoritative | ✅ library and admin role resolved on the server; client never decides what is editable |
| VI. Members-Only Visibility | ✅ admin responses carry only counts of members with matching own exercises; no member ids; nothing logged beyond error names/counts |
| VII. Simplicity | ✅ existing table and user pool; no new packages; in-memory cache instead of a cache service |

Post-design re-check: ✅ no violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/015-exercise-admin-panel/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/gym.ts                    # GymLibrary, buildLibrary, catalogId, isLibraryNameTaken; library param on find*/isExerciseNameTaken/buildGymView
├── contracts/admin-exercises.ts     # new admin schemas
└── contracts/me.ts                  # MeResponse.isAdmin

services/api/src/
├── lib/auth.ts                      # Caller.isAdmin, isAdminClaim, requireAdmin
├── lib/catalog-repo.ts              # DynamoCatalogRepo (list, create, update with guards)
├── lib/gym-library.ts               # getLibrary (2-min cache, fallback), invalidateLibrary
├── lib/gym-merge.ts                 # shared merge service (from infra/scripts/gym-merge.ts)
├── lib/gym-repo.ts                  # listEntriesByExercise, moveEntry, retireOwnExercise
├── lib/gym-save.ts, gym-view-loader.ts, own-exercises.ts, mcp/writes.ts   # use the library
├── handlers/admin-exercises-get.ts
├── handlers/admin-exercise-post.ts
├── handlers/admin-exercise-put.ts
└── handlers/admin-exercise-merge-post.ts
services/api/test/                   # fakes.ts gains an in-memory catalog; admin + gym tests

infra/
├── lib/auth-stack.ts                # CfnUserPoolGroup "admin"
├── lib/api-stack.ts                 # 4 admin routes
├── scripts/admin.ts                 # `admins add|remove|list`
└── scripts/gym-merge.ts             # thin wrapper over the shared merge service

apps/web/src/
├── app/(app)/settings/page.tsx      # "Admin" link when me.isAdmin
├── app/(app)/settings/admin/page.tsx  # panel (notFound() for non-admins)
├── components/admin-exercises.tsx   # list, add form, edit BottomSheet, merge confirm
└── server/admin-actions.ts          # Server Actions calling /admin/*
```

**Structure Decision**: Existing monorepo layout; one Lambda per new route, shared logic in `packages/shared`, Dynamo access in `services/api/src/lib` repos injected through `Deps` (`catalog: CatalogRepo`).

## Rollout

1. `pnpm deploy:dev` (Auth + Data + Api stacks; the Auth stack gains the group).
2. `pnpm admin admins add roshan`, `pnpm admin admins add nikhil`.
3. Web deploy (Amplify). Admins sign in again to pick up the group.
4. Update CLAUDE.md with a "Exercise admin (feature 015)" section.

## Complexity Tracking

None.
