# Quickstart: validating the Workout Tracker

Proves feature 002 end to end against a deployed `dev` stage. Contracts: [api.md](contracts/api.md), [web.md](contracts/web.md). Data: [data-model.md](data-model.md).

## Prerequisites

- Feature 001 deployed and a signed-in user with a completed profile (`pnpm admin create-user <name>`, then complete setup in the browser).
- AWS credentials (`AWS_PROFILE`, `CDK_DEFAULT_REGION=ap-south-1`), `pnpm install`.

## 1. Automated checks

```sh
pnpm check          # shared domain, API handler, CDK assertion and web helper tests
pnpm synth          # the Api stack now has 7 more routes, all JWT-protected
```

Expected: all green. The shared tests include `localDate` across at least five timezones and a daylight-saving day, and the edit-window edges.

## 2. Deploy

```sh
export AWS_PROFILE=...  CDK_DEFAULT_REGION=ap-south-1
pnpm deploy:dev
pnpm --filter @calci/web dev     # http://localhost:3000
```

## 3. Scenarios (browser unless noted)

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Signed out, open `/workouts` | Redirected to sign-in | FR-003 |
| 2 | `curl $API_URL/workouts` with no token | `401` | FR-024 |
| 3 | Open `/workouts` as a new user | 12 standard workouts with default minutes and calories, none ticked; totals 0 min / 0 kcal | US1-1, US2-1 |
| 4 | Tick **Running** | Ticks instantly, shows 30 min and 300 kcal; totals 30 / 300 | US1-2, SC-001 |
| 5 | Reload; open on a second device | Same tick and values | US1-4 |
| 6 | Tick **Yoga** | Totals 60 min / 390 kcal | US2-2 |
| 7 | Change Running to 45 min | 450 kcal; totals 75 / 540 | US3-1 |
| 8 | Enter 0, 601, 12.5, and empty in the minutes field | Each rejected with "Minutes must be a whole number from 1 to 600"; previous value kept | US3-2, FR-007 |
| 9 | Untick Running, tick it again | Back to 30 min / 300 kcal | US3-3 |
| 10 | Untick everything | Totals 0 / 0 | US1-3 |
| 11 | Stop the network (offline in devtools) and tick a workout | Message "Couldn't save. Try again."; the box ends unticked | Edge: network failure |
| 12 | Go to the previous day via ◀ | That day's entries/totals (or empty state); ▶ returns; no ▶ on today | US4-1/2/3 |
| 13 | Log something yesterday and two days ago | Both editable and update totals | US4-4, FR-017 |
| 14 | Open `?date=` three days ago | Read-only banner, controls disabled | US4-5 |
| 15 | `curl -X PUT` a tick for a date 3 days ago with a valid token | `409 DAY_LOCKED` even though the UI blocked it | FR-017 |
| 16 | `curl -X PUT` a tick for tomorrow | `400` | Edge: future days |
| 17 | Open `/workouts?date=2999-01-01` | Redirected to today | FR-016 |
| 18 | Add custom workout "Badminton, 60 min, 400 kcal" in `/workouts/mine` | Appears on the checklist after the standard ones; tickable like any other | US5-1, SC-007 |
| 19 | Add "badminton " (different case/space) | Rejected: "You already have a workout with that name". Also try "running" | US5-4 |
| 20 | Tick Badminton today, then change its calories to 800 | Today's entry still 400 kcal; a new tick tomorrow would use 800 | US5-2, FR-010 |
| 21 | Remove Badminton | Gone from the checklist; today's entry still shown, tagged "removed", and untickable | US5-3, FR-021 |
| 22 | Sign in as a second user | Does not see the first user's workouts or entries | US5-5, FR-023, SC-005 |
| 23 | `curl PUT /workouts/custom/std-running` and `DELETE` it | `404`; standard workouts can't be changed | US5-6, FR-022 |
| 24 | Change timezone in Settings to one where the date differs, reload | Today follows the new timezone; entries already logged stay on their dates | FR-015 |
| 25 | Leave `/workouts` open across local midnight (or set the system clock) | Within about a minute the screen moves to the new day | FR-018 |
| 26 | `GET /workouts/summary` for the last 30 days | One response, under 1 s | SC-006 |

## 4. Cleanup

```sh
pnpm cdk destroy --all -c stage=dev   # dev data is not retained
```

## Validation log (2026-11-11, dev stage, ap-south-1)

Automated: `pnpm check` green (shared 85, API 69, web 48, infra 12 tests), `pnpm synth` and `pnpm --filter @calci/web build` green.

Live API with a throwaway user (deleted afterwards): scenarios 2 (401 without token), 3 (12 rows), 4/7 (tick, then 45 min), 10 (untick), 15 (`409 DAY_LOCKED`), 16 (`400` future), 19 (`409 DUPLICATE_NAME` for "running"), 18 (custom add), 23 (`404` for a standard id), 26 (summary range) behaved as specified.

**Not yet run (needs a person in a browser):** scenarios 1, 5, 8, 9, 11-14, 17, 18-22, 24, 25; the accessibility pass (T063); SC-001/SC-002/SC-007 timings (T064). Tasks T029, T063 and T064 stay open for that.
