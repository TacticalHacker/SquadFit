# Quickstart: validating User Accounts & Profiles

This proves feature 001 works end to end against a deployed `dev` stage. Contracts:
[api.md](contracts/api.md), [web.md](contracts/web.md).

## Prerequisites

- Node 24, pnpm, AWS credentials for the dev account (`AWS_PROFILE`), CDK bootstrapped.
- `pnpm install` at the repo root.

## 1. Automated checks

```sh
pnpm check          # shared domain + API handler + CDK assertion + web helper tests
pnpm synth          # Calci-dev-Data, Calci-dev-Auth, Calci-dev-Api synthesize cleanly
```

Expected: all green. The infra tests confirm self-sign-up is disabled, sign-in is
case-insensitive, the password minimum is 8, every route except `/health` has the JWT
authorizer, and the avatar bucket blocks public access.

## 2. Deploy and configure

```sh
pnpm deploy:dev     # note outputs: ApiUrl, UserPoolId, UserPoolClientId
```

Create `apps/web/.env.local` with `API_URL`, `COGNITO_REGION`, and `COGNITO_CLIENT_ID` from the outputs, then `pnpm dev`.

## 3. Scenarios

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | `curl $ApiUrl/people` | `401`, no body data | FR-017, SC-003 |
| 2 | Open `http://localhost:3000/people` signed out | Redirected to `/sign-in?next=/people`; no "create account" link, invitation note shown | US1-4 |
| 3 | `pnpm admin -- create-user alice` | Prints a temporary password | FR-004 |
| 4 | `pnpm admin -- create-user ALICE` | Exit 1, "Username is taken" | US1-5 |
| 5 | Sign in as `Alice` (mixed case) with the temp password | Lands on `/sign-in/new-password` | FR-002, FR-004a |
| 6 | Set the new password `short` | Field error "at least 8 characters" | FR-003 |
| 7 | Set a valid new password | Lands on `/setup`; timezone pre-filled with the browser zone | US1-1/2 |
| 8 | Visit `/people` before saving | Redirected back to `/setup` | US1-3 |
| 9 | Enter calorie target `100` | "Must be between 500 and 10,000 kcal" | Edge case |
| 10 | Upload a 6 MB image | Rejected client-side ("max 5 MB") | FR-013 |
| 11 | Complete setup with a valid avatar | Lands on `/`; time from step 5 to here < 2 min | SC-001 |
| 12 | Sign out, then sign in with the **temp** password | "Incorrect username or password" | FR-004a |
| 13 | Create `bob`, set him up, open `/people` as Bob | Alice and Bob, Bob marked "You", Alice's avatar shown, Bob shows initials | US4, FR-016 |
| 14 | Inspect the `/people` network response / `GET /people` | No `dailyCalorieTarget` or `timezone` fields | FR-018 |
| 15 | As Bob, change timezone + target in `/settings`, reload | New values persist | US3 |
| 16 | Change password with a wrong current password | Field error; with the correct one → success; the old password no longer works | FR-009 |
| 17 | Close and reopen the browser | Still signed in | US2-1, SC-002 |
| 18 | In devtools, delete the `sf_at` cookie and reload | Silently refreshed, still signed in | R3 |
| 19 | Delete the `sf_rt` cookie and reload | Redirected to `/sign-in` (simulates 30-day inactivity) | FR-005 |
| 20 | Enter a wrong password 6+ times for `bob` | Generic error, then the lockout message; the correct password is refused while locked | FR-008 |
| 21 | `pnpm admin -- reset-password bob`, sign in with the new temp password | Forced to `/sign-in/new-password` | FR-004b |
| 22 | Add a user who never signs in | Not shown on `/people` | Edge case |

## 4. Cleanup

```sh
pnpm cdk destroy --all -c stage=dev   # dev data is not retained
```
