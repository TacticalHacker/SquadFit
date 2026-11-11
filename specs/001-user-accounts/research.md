# Research: User Accounts & Profiles

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-11

## R1. Authentication: Amazon Cognito vs custom auth

**Decision**: Amazon Cognito user pool (Lite feature plan) with self-sign-up disabled,
case-insensitive usernames, and the `USER_PASSWORD_AUTH` flow on a public app client (no
client secret). There is no Amplify and no Hosted UI.

**Rationale**: The spec's account model maps directly onto Cognito features we don't have to write:

| Spec | Cognito feature |
|---|---|
| FR-004 operator creates accounts | `AdminCreateUser` with `MessageAction=SUPPRESS` (no email needed) |
| FR-004a forced password change | User status `FORCE_CHANGE_PASSWORD` → `NEW_PASSWORD_REQUIRED` challenge |
| FR-004b operator reset | `AdminSetUserPassword --no-permanent` |
| FR-002 case-insensitive usernames | `signInCaseSensitive: false` |
| FR-003 never store passwords readably | Managed by Cognito |
| FR-007 no username enumeration | `preventUserExistenceErrors: true` |
| FR-008 lockout | Built-in lockout (see R2) |
| FR-009 change password | `ChangePassword` API |
| Protecting API routes | API Gateway HTTP API JWT authorizer validates tokens with no code |

A custom design (scrypt hashes in DynamoDB, a sessions table, lockout counters, and a Lambda
authorizer) would be about 400 lines of security-sensitive code that we would own. With three
users there's no cost or scale reason to do that. The Lite plan is free at this size.

**Alternatives considered**:
- *Custom auth on DynamoDB*: full control over the exact lockout numbers, but more code and more risk. Rejected (constitution VII: prefer platform primitives).
- *Amplify Auth (client SDK)*: keeps tokens in browser storage (XSS exposure) and adds a large dependency. Rejected in favour of a server-side backend-for-frontend (BFF) (R3).
- *Cognito Hosted UI / Managed Login*: redirect-based and needs a domain and callback setup. Overkill for a username + password form.

## R2. Lockout behaviour (FR-008)

**Decision**: Use Cognito's built-in lockout and amend FR-008 / SC-005 to match it.

**Rationale**: After 5 consecutive failed sign-ins, Cognito locks the user out. The lockout starts
at 1 second and doubles with each further failure, up to about 15 minutes. It resets after a
successful sign-in or after ~15 minutes with no attempts. The thresholds can't be configured.
This meets the intent (stop password guessing, cap at 15 minutes) but not the literal wording
("refused for 15 minutes after 5 failures"). Matching the wording exactly would mean
reintroducing custom lockout counters. Not worth it for 3 users.

**Alternatives considered**: a custom DynamoDB counter in front of Cognito. Rejected as
duplicate protection.

## R3. Where tokens live: Next.js BFF with httpOnly cookies

**Decision**: The browser never sees Cognito tokens. Next.js Server Actions on Vercel call
Cognito's JSON API with `fetch`, then store:

| Cookie | Contents | Max-Age |
|---|---|---|
| `sf_at` | Access token | Token lifetime (60 min) |
| `sf_rt` | Refresh token | **30 days, renewed on each authenticated request** |
| `sf_ch` | `{username, session}` for the `NEW_PASSWORD_REQUIRED` challenge | 3 min |

All three are `HttpOnly; Secure; SameSite=Lax; Path=/`. `src/proxy.ts` (Next 16's renamed
middleware, Node runtime) does two things:
1. If `sf_at` is missing or expired but `sf_rt` exists, it refreshes via `REFRESH_TOKEN_AUTH`.
2. It re-sets `sf_rt` with a fresh 30-day Max-Age.

If `sf_rt` is gone, the user is signed out. This gives exactly "30 days of **inactivity**"
(FR-005) even though Cognito refresh tokens have a fixed lifetime. That lifetime is set to
365 days, so a user who visits often still signs in again once a year. Sign-out deletes the
cookies and calls `RevokeToken`.

**Rationale**: httpOnly cookies keep tokens away from page scripts. Server-side calls to the
AWS API mean the API needs no CORS, and `NEXT_PUBLIC_API_URL` goes away.

**Alternatives considered**: sending the access token from the browser straight to the API
(needs CORS and tokens in JavaScript). Also iron-session sealing all tokens into one cookie:
the refresh and access tokens together come close to the 4 KB cookie limit, and they are
already signed.

## R4. Calling Cognito from Next.js

**Decision**: A ~60-line `fetch` wrapper around `https://cognito-idp.<region>.amazonaws.com/`
with the `X-Amz-Target: AWSCognitoIdentityProviderService.<Op>` header for `InitiateAuth`,
`RespondToAuthChallenge`, `ChangePassword`, and `RevokeToken`. These operations are
unauthenticated (they need only the client id), so no AWS credentials are needed on Vercel.

**Rationale**: It avoids `@aws-sdk/client-cognito-identity-provider` in the web bundle, and
any risk of the SDK looking for credentials that Vercel doesn't have. The admin script, which
does have credentials, uses the SDK.

## R5. Profile storage and the community list

**Decision**: One DynamoDB item per user in the existing single table. Users with a complete
profile also carry `gsi1pk = "COMMUNITY"`, so the People screen is a single `Query` on `gsi1`.
Partition key = Cognito `sub`, which never changes.

**Rationale**: At ~3 users (100 max for SC-004), one GSI partition is plenty. The same index
will serve the global leaderboard's member list later.

## R6. Avatars

**Decision**:
1. The browser checks the original file (PNG/JPEG/WebP/GIF, ≤ 5 MB; FR-013).
2. It center-crops and resizes to a 256×256 WebP on a canvas, then sends it via a Server Action → `PUT /me/avatar` (base64, ≤ 300 KB).
3. Lambda writes `avatars/<sub>/<uuid>.webp` to a private S3 bucket.
4. Reads return presigned GET URLs valid for 1 hour.

**Rationale**: No S3 CORS, no presigned upload flow, and no image processing in Lambda. The
files are tiny.

**Alternatives considered**: a presigned PUT straight from the browser (needs S3 CORS for each
Vercel origin and an extra step to confirm the upload). Storing the image in DynamoDB
(anti-pattern, 400 KB item limit). CloudFront for avatars (unnecessary for 3 users).

## R7. Timezone validation

**Decision**: `isValidTimeZone(tz)` in `packages/shared/src/domain/timezone.ts` uses
`new Intl.DateTimeFormat("en-US", { timeZone: tz })` inside try/catch. The picker list comes
from `Intl.supportedValuesOf("timeZone")`. The default comes from
`Intl.DateTimeFormat().resolvedOptions().timeZone`. The same function runs in the browser and
in Lambda (Node 24 has full ICU).

## R8. Testing approach

**Decision**:
- `packages/shared`: Vitest unit tests, written first, for the username, display-name, calorie-target and timezone rules, and for initials.
- `services/api`: handler tests against an in-memory `ProfileRepo` fake. Handlers depend on a small repository interface, so there's no AWS mocking library.
- `infra`: CDK assertion tests (self-sign-up off, case-insensitive pool, authorizer on every user route, bucket blocks public access).
- `apps/web`: Vitest for the cookie/session helpers. The end-to-end check is the manual [quickstart.md](quickstart.md) against a deployed `dev` stage. With 3 users, a Playwright suite isn't justified yet.
