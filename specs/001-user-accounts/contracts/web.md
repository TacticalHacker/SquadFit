# Contract: Web app routes, Server Actions & admin CLI

## Routes (`apps/web/src/app`)

| Route | Access | Purpose | Spec |
|---|---|---|---|
| `/sign-in` | public | Username + password form; says "Accounts are created by invitation" | US1-4, US2 |
| `/sign-in/new-password` | needs `sf_ch` cookie | Set a new password (first sign-in or after operator reset) | FR-004a |
| `/setup` | signed in, no profile | Profile setup (name, avatar, timezone pre-filled, calorie target) | US1, FR-011 |
| `/` | signed in + profile | Home (placeholder until feature 002) | |
| `/people` | signed in + profile | Community list, self marked "You" | US4 |
| `/settings` | signed in + profile | Edit profile, change password, sign out | US2-5, US3 |

**Gating**:
- `src/proxy.ts` does a cheap check: no `sf_rt` cookie → redirect to `/sign-in?next=<path>`. It also handles token refresh and the sliding 30-day `sf_rt` cookie (research R3).
- The authoritative check is a data access layer (`src/server/session.ts → getCurrentUser()`) called inside `<Suspense>` boundaries (Next 16 Cache Components). It calls `GET /me`:
  - `401` → `/sign-in`
  - `profile === null` → `/setup`
  - a user who has a profile and visits `/setup` → `/`

## Server Actions (`src/server/actions/*.ts`, `"use server"`)

All actions return `{ ok: true } | { ok: false, error: string, fields?: Record<string,string> }`
and validate input with the shared zod schemas.

| Action | Calls | Result |
|---|---|---|
| `signIn(username, password, next?)` | Cognito `InitiateAuth USER_PASSWORD_AUTH` | Tokens → set `sf_at`/`sf_rt`, redirect `next` or `/`. `NEW_PASSWORD_REQUIRED` → set `sf_ch`, redirect `/sign-in/new-password`. Any auth failure → "Incorrect username or password" (FR-007). Lockout → "Too many attempts. Try again in a few minutes." |
| `setNewPassword(newPassword)` | `RespondToAuthChallenge NEW_PASSWORD_REQUIRED` using `sf_ch` | Set tokens, clear `sf_ch`, redirect `/setup` (or `/` if profile exists). Expired challenge → back to `/sign-in` with "Please sign in again". |
| `changePassword(current, next)` | Cognito `ChangePassword` (access token) | Wrong current password → field error (FR-009) |
| `signOut()` | Cognito `RevokeToken` (refresh token), best-effort | Clear all `sf_*` cookies, redirect `/sign-in` (FR-006) |
| `saveProfile(input)` | API `PUT /me/profile` | First save redirects `/`; edits stay on `/settings` |
| `uploadAvatar(dataBase64)` | API `PUT /me/avatar` | |
| `removeAvatar()` | API `DELETE /me/avatar` | |

**Server-only env (Vercel)**: `API_URL`, `COGNITO_REGION`, `COGNITO_CLIENT_ID`. This replaces
`NEXT_PUBLIC_API_URL`. Nothing auth-related is exposed to the browser.

## Admin CLI (`infra/scripts/admin.ts`, run by the operator with AWS credentials)

```
pnpm admin -- create-user <username> [--stage dev]  # prints a generated temporary password
pnpm admin -- reset-password <username> [--stage dev]  # new temporary password; user must change it
pnpm admin -- list-users [--stage dev]  # username, status, created date
```

- Finds the user pool id from the `Calci-<stage>-Auth` stack output `UserPoolId`.
- Checks the username with `UsernameSchema` before calling Cognito. A taken username → exit 1 with "Username is taken" (US1-5).
- The temporary password is 16 random characters from a set without look-alike characters. It's printed once and never logged anywhere else.
- Uses `AdminCreateUser` (`MessageAction: SUPPRESS`) and `AdminSetUserPassword` (`Permanent: false`).
