# Implementation Plan: User Accounts & Profiles

**Branch**: `001-user-accounts` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-user-accounts/spec.md`

## Summary

The operator creates accounts. Friends sign in with a username and password, must replace
their temporary password on first sign-in, complete a profile (name, avatar, timezone, calorie
target), and then appear in a global community list (People). That list is the base for the
leaderboard in feature 004.

Approach:
- **Identity**: an Amazon Cognito user pool (self-sign-up off, case-insensitive usernames, built-in forced password change and lockout).
- **Sessions**: the Next.js server on Vercel acts as a backend-for-frontend, keeping Cognito tokens in httpOnly cookies, with a sliding 30-day refresh cookie.
- **Profiles**: stored in the existing DynamoDB single table, served by JWT-protected Lambda routes.
- **Avatars**: resized to 256 px WebP in the browser and stored in a private S3 bucket.
- **Accounts**: created with an admin CLI script.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24 (Lambda + Vercel)

**Primary Dependencies**: Next.js 16.4 (App Router, Cache Components, `proxy.ts`), React 19.3, Tailwind 4, zod 4, AWS CDK 2.276 (`aws-cognito`, `aws-apigatewayv2-authorizers`, `aws-s3`), AWS SDK v3 (`lib-dynamodb`, `client-s3`, `s3-request-presigner` in Lambda; `client-cognito-identity-provider`, `client-cloudformation` in the admin CLI)

**Storage**: DynamoDB single table (profiles), S3 (avatars), Cognito (credentials)

**Testing**: Vitest (shared domain, API handlers with an in-memory repo, web cookie helpers), `aws-cdk-lib/assertions` (infra), manual [quickstart.md](quickstart.md) end to end

**Target Platform**: Web browsers (desktop + mobile) → Vercel (Next.js server) → AWS API Gateway HTTP API → Lambda (arm64)

**Project Type**: Web application (Next.js frontend/BFF + serverless API + IaC)

**Performance Goals**: People and profile screens render in < 1 s for ≤ 100 users (SC-004); sign-in round trip < 1.5 s

**Constraints**: No credentials or tokens reachable by browser JavaScript; no AWS credentials on Vercel; no public sign-up; Cognito Lite plan (free tier)

**Scale/Scope**: About 3 users (designed for ≤ 100); 6 web routes, 5 API routes, 1 admin CLI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Pre-research | Post-design | Evidence |
|---|---|---|---|
| I. Spec-Driven Delivery | ✅ | ✅ | Spec clarified (3 Qs), no open markers. FR-008 amended to match R2 and recorded in the spec's Clarifications. |
| II. End-to-End Type Safety | ✅ | ✅ | All bodies are zod schemas in `packages/shared/src/contracts`; handlers `safeParse` input; the web app parses API output. |
| III. Test-First Domain Logic | ✅ | ✅ | Username, display-name, calorie-target and timezone rules and `initials()` live in `packages/shared/src/domain` with tests written first. Handlers stay thin behind a `ProfileRepo` interface. CDK assertions cover auth and the bucket. |
| IV. IaC, Serverless by Default | ✅ | ✅ | New `AuthStack` (Cognito) and an S3 bucket in `DataStack`, all CDK. No always-on services. Per-function IAM grants (S3 read/write only for the avatar functions). |
| V. Server-Authoritative, Fair Scoring | ✅ | ✅ | No scoring in this feature. Timezone validated and stored server-side for later day-boundary math. |
| VI. Members-Only Visibility | ✅ | ✅ | JWT authorizer on every route except `/health`. `GET /people` leaves out calorie target and timezone. Passwords handled only by Cognito. Tokens in httpOnly cookies. Request bodies never logged. Sign-in limited by Cognito lockout. |
| VII. Simplicity | ✅ | ✅ | Managed Cognito instead of custom auth; `fetch` wrapper instead of Amplify/SDK on Vercel; no S3 CORS or presigned uploads; no client-side token handling, so the API needs no CORS. |

**Result**: PASS with no violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-accounts/
├── plan.md              # This file
├── research.md          # Phase 0: auth decision, cookies, avatars, testing
├── data-model.md        # Phase 1: Cognito user, Profile item, S3 object, schemas
├── quickstart.md        # Phase 1: end-to-end validation scenarios
├── contracts/
│   ├── api.md           # HTTP API routes (Lambda)
│   └── web.md           # Web routes, Server Actions, admin CLI
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/
│   ├── username.ts          # UsernameSchema (3–20, [A-Za-z0-9_])
│   ├── profile.ts           # displayName / calorie-target rules, initials()
│   └── timezone.ts          # isValidTimeZone(), listTimeZones()
└── contracts/
    ├── errors.ts            # ApiError shape + codes
    ├── me.ts                # ProfileInput, OwnProfile, MeResponse, AvatarUpload
    └── people.ts            # PublicMember, PeopleResponse
packages/shared/test/        # *.test.ts for each domain module (written first)

services/api/src/
├── lib/
│   ├── auth.ts              # claims → { userId, username }
│   ├── profile-repo.ts      # ProfileRepo interface + DynamoDB implementation
│   ├── avatar-store.ts      # S3 put/delete/presign
│   └── http.ts              # json(), error helpers (existing)
└── handlers/
    ├── me-get.ts            # GET /me
    ├── me-profile-put.ts    # PUT /me/profile
    ├── me-avatar-put.ts     # PUT /me/avatar
    ├── me-avatar-delete.ts  # DELETE /me/avatar
    └── people-get.ts        # GET /people
services/api/test/           # handler tests with in-memory ProfileRepo + fake AvatarStore

infra/
├── lib/
│   ├── auth-stack.ts        # NEW: UserPool + public client (USER_PASSWORD_AUTH, refresh 365d)
│   ├── data-stack.ts        # + avatar bucket
│   └── api-stack.ts         # + HttpUserPoolAuthorizer, 5 routes, remove CORS
├── scripts/admin.ts         # NEW: create-user / reset-password / list-users
└── test/stacks.test.ts      # + auth, authorizer, bucket assertions

apps/web/src/
├── proxy.ts                 # optimistic gate + token refresh + sliding sf_rt
├── server/
│   ├── cognito.ts           # fetch wrapper (InitiateAuth, RespondToAuthChallenge, ChangePassword, RevokeToken)
│   ├── cookies.ts           # sf_at / sf_rt / sf_ch helpers
│   ├── api.ts               # server-only API client (Bearer sf_at), parses shared schemas
│   ├── session.ts           # getCurrentUser() data access layer (redirects /sign-in or /setup)
│   └── actions/             # auth.ts, profile.ts ("use server")
├── components/              # Avatar (img | initials), AvatarPicker (canvas resize), TimezoneSelect, ProfileForm
└── app/
    ├── sign-in/page.tsx, sign-in/new-password/page.tsx
    ├── setup/page.tsx
    ├── (app)/layout.tsx     # nav; session read inside <Suspense>
    ├── (app)/page.tsx       # home placeholder
    ├── (app)/people/page.tsx
    └── (app)/settings/page.tsx
```

**Structure Decision**: Keep the existing monorepo layout from the constitution (`apps/web`,
`services/api`, `packages/shared`, `infra`). Add one stack (`AuthStack`), one bucket, and the
`infra/scripts` folder for operator tooling. The scaffold's `ApiStatus` client component and
`NEXT_PUBLIC_API_URL` are removed: all API calls now go through the Next server (research R3).

## Complexity Tracking

No constitution violations to justify.
