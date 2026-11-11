---
description: "Task list for 001 User Accounts & Profiles"
---

# Tasks: User Accounts & Profiles

**Input**: Design documents from `specs/001-user-accounts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution III requires test-first domain logic plus CDK assertion tests, and research R8 defines the test approach. Test tasks come **before** their implementation tasks and MUST fail first.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repo root (monorepo: `apps/web`, `services/api`, `packages/shared`, `infra`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, env, and removing scaffold pieces this design replaces

- [ ] T001 Add dependencies to `services/api/package.json`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (pin to the same `^3.1166.0` line as the existing AWS SDK deps), then `pnpm install`
- [ ] T002 [P] Add admin CLI dependencies to `infra/package.json`: `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-cloudformation` (`^3.1166.0`) and `@calci/shared: workspace:*`; add a script `"admin": "tsx scripts/admin.ts"` to `infra/package.json` and `"admin": "pnpm --filter @calci/infra admin"` to the root `package.json`
- [ ] T003 [P] Add `vitest` (`^5.1.0`) to `apps/web/package.json` devDependencies and change its `test` script to `vitest run --passWithNoTests`; add `apps/web/vitest.config.ts` with the `@/*` → `src/*` alias
- [ ] T004 [P] Replace `NEXT_PUBLIC_API_URL` in `.env.example` with server-only `API_URL`, `COGNITO_REGION`, `COGNITO_CLIENT_ID` (research R3/R4); keep the `CDK_DEFAULT_*` entries
- [ ] T005 Delete `apps/web/src/components/api-status.tsx` and `apps/web/src/lib/api.ts`, and remove `<ApiStatus />` from `apps/web/src/app/page.tsx` (replaced by server-side API calls, plan Structure Decision)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared rules, contracts, Cognito, the JWT-protected API skeleton, and the web session layer (sign-in itself). Every story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared domain & contracts (test-first)

- [ ] T006 [P] Write failing tests in `packages/shared/test/username.test.ts` for `UsernameSchema`: accepts 3–20 chars matching `^[A-Za-z0-9_]+$`; rejects `ab`, 21 chars, `a-b`, `a b`, empty
- [ ] T007 [P] Write failing tests in `packages/shared/test/profile.test.ts` for `DisplayNameSchema` (trimmed, 1–40 chars; whitespace-only rejected), `CalorieTargetSchema` (integer 500–10,000; rejects 499, 10001, 2000.5, negative) with the message "Must be between 500 and 10,000 kcal", `PasswordSchema` (min 8, message "Password must be at least 8 characters"), and `initials(displayName)` (`"Roshan Raj"`→`"RR"`, `"alice"`→`"A"`, at most 2 letters, uppercase)
- [ ] T008 [P] Write failing tests in `packages/shared/test/timezone.test.ts` for `isValidTimeZone` (true: `Asia/Kolkata`, `America/New_York`, `UTC`; false: `Mars/Base`, `""`, `"Asia/"`) and `listTimeZones()` (non-empty, contains `Europe/London`)
- [ ] T009 [P] Implement `UsernameSchema` in `packages/shared/src/domain/username.ts` so T006 passes
- [ ] T010 [P] Implement `DisplayNameSchema`, `CalorieTargetSchema`, `PasswordSchema`, `initials()` in `packages/shared/src/domain/profile.ts` so T007 passes
- [ ] T011 [P] Implement `isValidTimeZone()` (try/catch around `new Intl.DateTimeFormat("en-US", { timeZone })`) and `listTimeZones()` (`Intl.supportedValuesOf("timeZone")`) in `packages/shared/src/domain/timezone.ts` so T008 passes (research R7)
- [ ] T012 [P] Create `packages/shared/src/contracts/errors.ts`: `ApiErrorSchema` `{ error: { code, message, fields? } }` and code enum `VALIDATION_FAILED | PROFILE_REQUIRED | PAYLOAD_TOO_LARGE | UNAUTHORIZED` (contracts/api.md)
- [ ] T013 [P] Create `packages/shared/src/contracts/me.ts`: `ProfileInputSchema` `{displayName, timezone (refined with isValidTimeZone, message "Unknown timezone"), dailyCalorieTarget}`, `OwnProfileSchema` `{displayName, timezone, dailyCalorieTarget, avatarUrl: string|null, joinedAt: iso datetime}`, `MeResponseSchema` `{username, profile: OwnProfile|null}`, `AvatarUploadSchema` `{contentType: literal "image/webp", dataBase64: string}` (data-model.md)
- [ ] T014 [P] Create `packages/shared/src/contracts/people.ts`: `PublicMemberSchema` `{userId, displayName, avatarUrl: string|null, joinedAt, isYou: boolean}` (**no** calorie target, timezone, or username, FR-018) and `PeopleResponseSchema` `{members: PublicMember[]}`
- [ ] T015 Export all domain modules and contracts from `packages/shared/src/index.ts`; run `pnpm --filter @calci/shared test` (all green)

### Infrastructure: Cognito, bucket, authorizer (test-first)

- [ ] T016 Write failing assertions in `infra/test/stacks.test.ts` for:
  - `AWS::Cognito::UserPool`: `AdminCreateUserConfig.AllowAdminCreateUserOnly: true`, `UsernameConfiguration.CaseSensitive: false`, `Policies.PasswordPolicy.MinimumLength: 8` with no required character classes
  - `AWS::Cognito::UserPoolClient`: `ExplicitAuthFlows` includes `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`, `GenerateSecret: false`, `PreventUserExistenceErrors: ENABLED`, `EnableTokenRevocation: true`, refresh token validity 365 days, access token 60 minutes
  - `AWS::S3::Bucket` with all four `PublicAccessBlockConfiguration` flags true
  - every `AWS::ApiGatewayV2::Route` except `GET /health` has `AuthorizationType: JWT`
  - routes `GET /me`, `PUT /me/profile`, `PUT /me/avatar`, `DELETE /me/avatar`, `GET /people` exist
  - the API has no `CorsConfiguration`
- [ ] T017 Create `infra/lib/auth-stack.ts` (`AuthStack`):
  - `UserPool`: `featurePlan: FeaturePlan.LITE`, `selfSignUpEnabled: false`, `signInCaseSensitive: false`, `signInAliases: { username: true }`, `passwordPolicy` min 8 with all `require*` false, `tempPasswordValidity: Duration.days(7)`, `accountRecovery: AccountRecovery.NONE`, removal policy `RETAIN` when `config.retainData`
  - `UserPoolClient`: `authFlows: { userPassword: true }`, `generateSecret: false`, `preventUserExistenceErrors: true`, `enableTokenRevocation: true`, `refreshTokenValidity: Duration.days(365)`, `accessTokenValidity: Duration.minutes(60)`, `idTokenValidity: Duration.minutes(60)`
  - `CfnOutput`s `UserPoolId` (exportName `calci-<stage>-user-pool-id`) and `UserPoolClientId`
- [ ] T018 Add the avatar bucket to `infra/lib/data-stack.ts`: `blockPublicAccess: BLOCK_ALL`, `encryption: S3_MANAGED`, `enforceSSL: true`, removal `RETAIN` when `retainData` else `DESTROY` with `autoDeleteObjects: true`; expose it as `this.avatarBucket`
- [ ] T019 Update `infra/lib/api-stack.ts`:
  - accept `userPool`, `userPoolClient`, `avatarBucket` props
  - remove `corsPreflight`
  - create an `HttpUserPoolAuthorizer` and extend `route()` with `{ auth?: boolean (default true), write?: boolean, avatars?: "read" | "readwrite" }`; `/health` stays `auth: false`
  - add env `AVATAR_BUCKET`
  - grant `avatarBucket.grantRead` / `grantReadWrite` per function
- [ ] T020 Wire `AuthStack` into `infra/bin/app.ts` as `Calci-<stage>-Auth` and pass its pool and client plus `data.avatarBucket` to `ApiStack`; remove `allowedOrigins` from `infra/lib/config.ts`; run `pnpm --filter @calci/infra test` and `pnpm synth` (T016 green, no warnings)

### API skeleton

- [ ] T021 [P] Create `services/api/src/lib/auth.ts`: `getCaller(event: APIGatewayProxyEventV2WithJWTAuthorizer) → { userId: claims.sub, username: claims.username }`; throw if either is missing
- [ ] T022 [P] Extend `services/api/src/lib/http.ts` with `ok(body)`, `apiError(status, code, message, fields?)` (shape from `ApiErrorSchema`), and `parseBody(event, schema)`. On a zod failure, `parseBody` returns a 400 `VALIDATION_FAILED` with `fields` mapped from the issue paths. Request bodies are never logged (constitution VI)
- [ ] T023 [P] Create `services/api/src/lib/profile-repo.ts`:
  - `interface ProfileRepo { get(userId); create(profile); update(userId, patch); setAvatarKey(userId, key|null); listCommunity() }`
  - `DynamoProfileRepo` using `@aws-sdk/lib-dynamodb` with keys from data-model.md: `pk=USER#<sub>`, `sk=PROFILE`, `gsi1pk=COMMUNITY`, `gsi1sk=JOINED#<createdAt>#<sub>`; `create` uses `ConditionExpression: attribute_not_exists(pk)`; `listCommunity` queries index `gsi1` ascending
  - `InMemoryProfileRepo` in `services/api/test/fakes.ts`
- [ ] T024 [P] Create `services/api/src/lib/avatar-store.ts`: `interface AvatarStore { put(userId, bytes) → key; delete(key); urlFor(key) → presigned GET (expiresIn 3600) }` with an S3 implementation (key `avatars/<sub>/<uuid>.webp`, `ContentType: image/webp`), plus `FakeAvatarStore` in `services/api/test/fakes.ts`
- [ ] T025 Create `services/api/src/lib/deps.ts` that builds the real repo and store once per container from `TABLE_NAME` / `AVATAR_BUCKET` (via `requireEnv`) and lets tests inject fakes. Then write a failing test in `services/api/test/me-get.test.ts` (no profile → `{username, profile: null}`; existing profile → `OwnProfile` incl. presigned `avatarUrl` or `null`) and implement `services/api/src/handlers/me-get.ts` (`GET /me`)
- [ ] T026 Register `GET /me` (`auth`, read) in `infra/lib/api-stack.ts`

### Web session layer (BFF)

- [ ] T027 [P] Create `apps/web/src/server/cognito.ts` (`import "server-only"`):
  - `fetch` wrapper posting to `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/` with headers `Content-Type: application/x-amz-json-1.1` and `X-Amz-Target: AWSCognitoIdentityProviderService.<Op>`
  - typed functions `initiateUserPasswordAuth(username, password)`, `refresh(refreshToken)`, `respondNewPassword(username, session, newPassword)`, `changePassword(accessToken, prev, next)`, `revokeToken(refreshToken)`
  - each returns a discriminated union: `tokens | challenge(NEW_PASSWORD_REQUIRED, session) | error(kind: "invalid_credentials" | "locked_out" | "expired_session" | "invalid_password" | "unknown")`, mapping `NotAuthorizedException` (message containing "attempts exceeded" → `locked_out`), `UserNotFoundException`, `InvalidPasswordException`, `PasswordResetRequiredException`
  - never logs passwords or tokens (research R4)
- [ ] T028 [P] Write failing tests in `apps/web/src/server/cookies.test.ts`, then implement `apps/web/src/server/cookies.ts`:
  - names `sf_at` / `sf_rt` / `sf_ch`
  - shared options `{ httpOnly: true, secure: NODE_ENV==="production", sameSite: "lax", path: "/" }`
  - `sf_at` maxAge = token `exp` − now; `sf_rt` maxAge = 30 days; `sf_ch` maxAge = 180 s
  - helpers `setSessionCookies`, `clearSessionCookies`, `readAccessTokenExp(jwt)` (decode payload only, no verification: API Gateway verifies)
  - tests cover the maxAge values and expiry decoding (research R3)
- [ ] T029 Create `apps/web/src/proxy.ts`:
  - public paths are `/sign-in` and `/sign-in/new-password`
  - for other paths: no `sf_rt` → redirect `/sign-in?next=<path>`
  - if `sf_at` is missing or expires within 60 s → `refresh(sf_rt)`; on success set a new `sf_at`; on failure clear cookies and redirect to sign-in
  - always re-set `sf_rt` with a fresh 30-day maxAge (sliding inactivity, FR-005)
  - `matcher` excludes `_next/static`, `_next/image`, `favicon.ico`
  - read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first (apps/web/AGENTS.md)
- [ ] T030 Create `apps/web/src/server/api.ts` (`server-only`): `apiFetch(path, { method, body, schema })` reads `sf_at` via `cookies()`, sends `Authorization: Bearer`, parses success bodies with the given shared schema and errors with `ApiErrorSchema`; a 401 throws `UnauthorizedError`. Base URL comes from `API_URL`
- [ ] T031 Create `apps/web/src/server/session.ts` (data access layer):
  - `getMe()` uses `'use cache: private'`, calls `GET /me`, and redirects to `/sign-in` on `UnauthorizedError`
  - `requireProfile()` redirects to `/setup` when `profile === null`
  - `requireNoProfile()` redirects to `/` when a profile exists
  - read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` first
- [ ] T032 Create the `signIn` server action in `apps/web/src/server/actions/auth.ts` (`"use server"`, per contracts/web.md):
  - basic `UsernameSchema` format check; any failure → `"Incorrect username or password"` (FR-007)
  - `locked_out` → `"Too many attempts. Try again in a few minutes."` (FR-008)
  - challenge → set `sf_ch` = JSON `{username, session}` and redirect `/sign-in/new-password`
  - tokens → set cookies and redirect to `next` (only same-origin relative paths starting with `/`) or `/`
- [ ] T033 Create `apps/web/src/app/sign-in/page.tsx` and `apps/web/src/app/sign-in/sign-in-form.tsx` (client, `useActionState`): username and password fields, error area, the note "Accounts are created by invitation. Ask the admin for yours." and **no** sign-up link (US1-4)
- [ ] T034 Create `apps/web/src/app/(app)/layout.tsx` (nav: Home, People, Settings; `requireProfile()` called inside a `<Suspense>` boundary, never awaited at the layout's top level) and move the home page to `apps/web/src/app/(app)/page.tsx` (placeholder "Welcome, {displayName}. Workout logging arrives in feature 002."); delete `apps/web/src/app/page.tsx`
- [ ] T035 Implement `create-user` in `infra/scripts/admin.ts`:
  - parse `<command> <username> [--stage dev|prod]` (default `dev`)
  - get `UserPoolId` from CloudFormation `DescribeStacks` on `Calci-<stage>-Auth`
  - validate with `UsernameSchema`
  - generate a 16-character temporary password with `crypto.randomInt` from `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789`
  - call `AdminCreateUser` with `MessageAction: "SUPPRESS"` and `TemporaryPassword`
  - `UsernameExistsException` → stderr "Username is taken", exit 1
  - print the username and temporary password once to stdout

**Checkpoint**: `pnpm check` and `pnpm synth` are green. After `pnpm deploy:dev`, an admin-created user can sign in, gets sent to `/sign-in/new-password` (page not built yet), and `curl $ApiUrl/me` without a token returns 401.

---

## Phase 3: User Story 1 - First sign-in and profile setup (Priority: P1) 🎯 MVP

**Goal**: An operator-created user replaces their temporary password, completes a profile (name, optional avatar, pre-filled timezone, calorie target), and reaches Home.

**Independent Test**: quickstart scenarios 3–12. Create a user, sign in with the temporary password, set a new password, complete setup, sign out, then confirm the temporary password no longer works and the profile persists.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T036 [P] [US1] Write failing tests in `services/api/test/me-profile-put.test.ts`:
  - first call creates the profile with `createdAt` = `joinedAt`
  - second call updates fields and keeps `joinedAt`
  - 400 `VALIDATION_FAILED` with `fields.timezone` for `Mars/Base`, `fields.dailyCalorieTarget` for `100`, `fields.displayName` for `"   "`
  - `username` copied from claims
- [ ] T037 [P] [US1] Write failing tests in `services/api/test/me-avatar-put.test.ts`:
  - valid WebP (bytes start with `RIFF` and `WEBP` at offset 8) → key stored, old key deleted, response `avatarUrl` set
  - decoded > 300 KB → 413 `PAYLOAD_TOO_LARGE`
  - non-WebP bytes → 400
  - no profile → 409 `PROFILE_REQUIRED`

### Implementation for User Story 1

- [ ] T038 [US1] Implement `services/api/src/handlers/me-profile-put.ts` (`PUT /me/profile`): parse `ProfileInputSchema`; create if missing (sets `createdAt`, `gsi1pk`, `gsi1sk`), else update `displayName`, `timezone`, `dailyCalorieTarget`, `updatedAt`; respond with the `MeResponse` (T036 green)
- [ ] T039 [US1] Implement `services/api/src/handlers/me-avatar-put.ts` (`PUT /me/avatar`): parse `AvatarUploadSchema`, decode base64, enforce ≤ 300 KB and the WebP magic bytes, require a profile, `AvatarStore.put`, `setAvatarKey`, then delete the previous object (T037 green)
- [ ] T040 [US1] Register `PUT /me/profile` (`write`) and `PUT /me/avatar` (`write`, `avatars: "readwrite"`) in `infra/lib/api-stack.ts`; run `pnpm --filter @calci/infra test`
- [ ] T041 [US1] Add the `setNewPassword(newPassword)` server action to `apps/web/src/server/actions/auth.ts`:
  - validate with `PasswordSchema`; read `sf_ch` (missing → redirect `/sign-in`)
  - call `respondNewPassword`; `expired_session` → clear `sf_ch` and redirect `/sign-in?error=expired` ("Please sign in again")
  - `invalid_password` → field error
  - success → set tokens, clear `sf_ch`, redirect `/setup` (FR-004a)
- [ ] T042 [US1] Create `apps/web/src/app/sign-in/new-password/page.tsx` and its client form: new password + confirm (must match), with the explanation "Choose your own password to replace the temporary one"
- [ ] T043 [P] [US1] Create `apps/web/src/components/timezone-select.tsx` (client): options from `listTimeZones()`, default `Intl.DateTimeFormat().resolvedOptions().timeZone` when valid; if the device zone isn't recognized, no default and the field is required (edge case, FR-012)
- [ ] T044 [P] [US1] Create `apps/web/src/components/avatar.tsx`: renders `<img>` (rounded, sized by prop) when `avatarUrl` is set, otherwise a circle with `initials(displayName)` (FR-013)
- [ ] T045 [P] [US1] Create `apps/web/src/components/avatar-picker.tsx` (client):
  - accept `image/png,image/jpeg,image/webp,image/gif` ≤ 5 MB, otherwise the error "Images must be PNG, JPEG, WebP or GIF, max 5 MB"
  - center-crop to a square, draw to a 256×256 canvas, `canvas.toBlob(…, "image/webp", 0.85)`, base64-encode, preview
  - expose the result to the parent form (research R6)
- [ ] T046 [US1] Create the `saveProfile(input)` and `uploadAvatar(dataBase64)` server actions in `apps/web/src/server/actions/profile.ts`:
  - validate with `ProfileInputSchema` / `AvatarUploadSchema`
  - call `PUT /me/profile`, then `PUT /me/avatar` if an avatar was chosen
  - map API `fields` to form errors
  - `revalidatePath("/", "layout")`
  - first-time save redirects `/`
- [ ] T047 [US1] Create `apps/web/src/components/profile-form.tsx` (client, `useActionState`): display name (1–40), `AvatarPicker`, `TimezoneSelect`, calorie target (number input, 500–10,000, message "Must be between 500 and 10,000 kcal"), and a submit label set by prop. Inline field errors come from the action result
- [ ] T048 [US1] Create `apps/web/src/app/setup/page.tsx`: inside `<Suspense>`, call `requireNoProfile()` and render `ProfileForm` with heading "Set up your profile" and submit label "Join" (FR-011, US1-2/3)
- [ ] T049 [US1] Run quickstart scenarios 3–12 against `pnpm deploy:dev` + `pnpm dev` and note the results in `specs/001-user-accounts/quickstart.md` under a "Validation log" heading

**Checkpoint**: MVP. Friends can be onboarded end to end.

---

## Phase 4: User Story 2 - Sign in, stay signed in, sign out (Priority: P1)

**Goal**: Returning users stay signed in across restarts (sliding 30 days), can sign out and change their password, are locked out after repeated failures, and the operator can reset forgotten passwords.

**Independent Test**: quickstart scenarios 12, 16–21.

### Tests for User Story 2 ⚠️

- [ ] T050 [P] [US2] Write failing tests in `apps/web/src/server/cognito.test.ts` (stub `global.fetch`) for the error mapping:
  - `NotAuthorizedException` "Incorrect username or password." → `invalid_credentials`
  - `NotAuthorizedException` "Password attempts exceeded" → `locked_out`
  - `UserNotFoundException` → `invalid_credentials`
  - `InvalidPasswordException` → `invalid_password`
  - `ChallengeName: NEW_PASSWORD_REQUIRED` → challenge
  - `AuthenticationResult` → tokens

### Implementation for User Story 2

- [ ] T051 [US2] Make T050 pass by adjusting `apps/web/src/server/cognito.ts`
- [ ] T052 [US2] Add the `signOut()` server action to `apps/web/src/server/actions/auth.ts`: best-effort `revokeToken(sf_rt)` (errors ignored), `clearSessionCookies()`, redirect `/sign-in` (FR-006)
- [ ] T053 [US2] Add the `changePassword(current, next, confirm)` server action to `apps/web/src/server/actions/auth.ts`:
  - `PasswordSchema` on `next`; `next === confirm`
  - Cognito `ChangePassword` with `sf_at`
  - wrong current password (`invalid_credentials`) → field error on `current`: "Current password is incorrect"
  - success message "Password changed" (FR-009)
- [ ] T054 [US2] Create `apps/web/src/app/(app)/settings/page.tsx` with a "Password" section (`apps/web/src/app/(app)/settings/password-form.tsx`, client) and a "Sign out" button form calling `signOut`
- [ ] T055 [P] [US2] Add `reset-password <username>` to `infra/scripts/admin.ts`: generate a new temporary password (same generator as T035), call `AdminSetUserPassword` with `Permanent: false`, print it once. `UserNotFoundException` → "No such user", exit 1 (FR-004b)
- [ ] T056 [P] [US2] Add `list-users` to `infra/scripts/admin.ts`: `ListUsers` (paginate) and print a table of username, status (`FORCE_CHANGE_PASSWORD`/`CONFIRMED`), and created date
- [ ] T057 [US2] Show `?error=expired` ("Please sign in again") on the sign-in page; make sure the lockout message from T032 renders. Then run quickstart scenarios 12, 16–21 and append them to the validation log

**Checkpoint**: US1 and US2 both work. Accounts are fully manageable by the operator.

---

## Phase 5: User Story 3 - Edit profile (Priority: P2)

**Goal**: Users change name, avatar (or remove it), timezone, and calorie target at any time.

**Independent Test**: quickstart scenario 15. Edit each field, reload, and see the new values; remove the avatar and see initials.

### Tests for User Story 3 ⚠️

- [ ] T058 [P] [US3] Write failing tests in `services/api/test/me-avatar-delete.test.ts`: with an avatar → object deleted, `avatarKey` cleared, response `avatarUrl: null`; without an avatar → 200 (idempotent)

### Implementation for User Story 3

- [ ] T059 [US3] Implement `services/api/src/handlers/me-avatar-delete.ts` (`DELETE /me/avatar`) and register it (`write`, `avatars: "readwrite"`) in `infra/lib/api-stack.ts` (T058 green)
- [ ] T060 [US3] Add the `removeAvatar()` server action to `apps/web/src/server/actions/profile.ts`, and make `saveProfile` stay on `/settings` with the message "Saved" when the profile already exists
- [ ] T061 [US3] Add a "Profile" section to `apps/web/src/app/(app)/settings/page.tsx`: `ProfileForm` pre-filled from `getMe()` (submit label "Save"), plus a "Remove photo" button when an avatar exists. Username is shown read-only (FR-014)

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - See everyone in the community (Priority: P2)

**Goal**: A People screen lists every user with a completed profile, with the current user marked "You". It is the base list for the global leaderboard.

**Independent Test**: quickstart scenarios 1, 13, 14, 22. With 2+ profiled users, each sees all of them; anonymous `GET /people` → 401; no private fields in the response; a created-but-never-set-up user is absent.

### Tests for User Story 4 ⚠️

- [ ] T062 [P] [US4] Write failing tests in `services/api/test/people-get.test.ts`:
  - returns members in join order
  - `isYou` true only for the caller
  - presigned `avatarUrl` or `null`
  - the response JSON contains **no** `dailyCalorieTarget`, `timezone`, or `username` keys (FR-018)
  - a Cognito user without a profile item isn't listed

### Implementation for User Story 4

- [ ] T063 [US4] Implement `services/api/src/handlers/people-get.ts` (`GET /people`) using `listCommunity()` and mapping each item to `PublicMemberSchema`; register it (read, `avatars: "read"`) in `infra/lib/api-stack.ts` (T062 green)
- [ ] T064 [US4] Create `apps/web/src/app/(app)/people/page.tsx`: inside `<Suspense>`, fetch `GET /people` via `apiFetch` with `PeopleResponseSchema` and render a list of `Avatar`, display name, a "You" badge, and "Joined <date>" (formatted with `Intl.DateTimeFormat`)
- [ ] T065 [US4] Run quickstart scenarios 1, 13, 14, 22 and append them to the validation log

**Checkpoint**: All four stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Update `README.md` and `CLAUDE.md`:
  - new env vars (`API_URL`, `COGNITO_REGION`, `COGNITO_CLIENT_ID`) for Vercel and `.env.local`
  - the `Calci-<stage>-Auth` stack
  - `pnpm admin -- create-user | reset-password | list-users`
  - remove the CORS/`allowedOrigins` deploy step
- [ ] T067 [P] Make sure no handler or server action logs request bodies, passwords, or tokens: grep `console.` in `services/api/src` and `apps/web/src/server` and keep only error codes and user ids (constitution VI)
- [ ] T068 [P] Accessibility pass on the sign-in, new-password, setup, settings, and people pages: labelled inputs, error text linked with `aria-describedby`, visible focus, usable at 360 px width
- [ ] T069 Run `pnpm check`, `pnpm synth`, `pnpm --filter @calci/web build` (all green) and the full quickstart; record SC-001 timing (first sign-in → profile complete < 2 min) and SC-004 (People < 1 s) in the validation log

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**
- **US1 (Phase 3)**: depends on Foundational. It is the MVP
- **US2 (Phase 4)**: depends on Foundational. Its quickstart run needs a profiled user (US1), but the code is independent
- **US3 (Phase 5)**: depends on Foundational plus `ProfileForm`/`saveProfile` from US1 (T046, T047)
- **US4 (Phase 6)**: depends on Foundational plus `Avatar` (T044) from US1
- **Polish (Phase 7)**: after the desired stories

### Within Foundational

T006–T008 → T009–T011 → T012–T015 → (T016 → T017–T020) ∥ (T021–T025 → T026) ∥ (T027–T028 → T029–T034); T035 needs T009 and T017.

### Parallel opportunities

- Setup: T002, T003, T004 together
- Foundational: the three domain test files (T006–T008), then their three implementations (T009–T011), then contracts (T012–T014). After the contracts, the **infra**, **API skeleton**, and **web session** tracks run in parallel
- US1: T036 ∥ T037 (tests); T043 ∥ T044 ∥ T045 (components) alongside the API handlers T038–T039
- US2: T055 ∥ T056 (admin CLI) alongside the web work
- After Foundational, US2 and US4 can start in parallel with US1, given the component dependencies above

### Parallel example: User Story 1

```text
Task: T036 Write failing tests in services/api/test/me-profile-put.test.ts
Task: T037 Write failing tests in services/api/test/me-avatar-put.test.ts
Task: T043 Create apps/web/src/components/timezone-select.tsx
Task: T044 Create apps/web/src/components/avatar.tsx
Task: T045 Create apps/web/src/components/avatar-picker.tsx
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → Phase 2 Foundational (sign-in, Cognito, API skeleton, admin `create-user`)
2. Phase 3 US1 → deploy dev → onboard yourself with quickstart 3–12
3. **Stop and validate.** The 3 friends can be onboarded

### Incremental delivery

1. + US2 → sign-out, change password, operator reset (needed before handing accounts to friends)
2. + US4 → People screen (base for feature 004 leaderboard)
3. + US3 → profile editing
4. Polish → merge `001-user-accounts` to `main`

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Tests MUST fail before implementation (constitution III)
- Read `apps/web/AGENTS.md` before any Next.js task: Next 16 APIs differ from older versions (`proxy.ts`, Cache Components, `<Suspense>` around session reads)
- Commit after each task or logical group
