# Quickstart: validating the Nutrition Tracker

Proves feature 003 end to end against a deployed `dev` stage. Contracts: [api.md](contracts/api.md), [web.md](contracts/web.md). Data: [data-model.md](data-model.md).

## Prerequisites

- Features 001 and 002 deployed; a signed-in user with a completed profile (daily calorie target set).
- AWS credentials (`AWS_PROFILE`, `CDK_DEFAULT_REGION=ap-south-1`), `pnpm install`.

## 1. Automated checks

```sh
pnpm check          # shared domain, API handler, CDK assertion and web helper tests
pnpm synth          # the Api stack has 9 more routes, all JWT-protected
```

Expected: all green. The shared tests include servings rounding, the catalog invariants, `localDate` across five timezones (from 002) and the ledger rules.

## 2. Deploy

```sh
export AWS_PROFILE=...  CDK_DEFAULT_REGION=ap-south-1
pnpm --filter @calci/infra exec cdk deploy --all -c stage=dev --require-approval never
pnpm --filter @calci/web dev     # http://localhost:3000
```

## 3. Scenarios (browser unless noted)

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Signed out, open `/food` | Redirected to sign-in | FR-001 |
| 2 | `curl $API_URL/food` with no token | `401` | FR-024 |
| 3 | Open `/food` as a new user | Four empty meals; eaten 0, burned 0, net 0; remaining equals the target | US1-1, US2-1 |
| 4 | Time-of-day default: open the Add panel for today | Meal preselected by local hour (check at different hours or in a test timezone) | Q4 |
| 5 | Quick entry "Banana, 100" in Snacks | Appears at once; eaten 100 | US1-2, SC-001 |
| 6 | Add "Oats with milk", 1.5 servings, from Find into Breakfast | Shows 375 kcal, 15 / 57 / 9 g; eaten 475 | US4-2, FR-003 |
| 7 | Change the oats to 2 servings | 500 kcal, 20 / 76 / 12 g | US1-10 |
| 8 | Try to edit the oats' calories | Not possible in the UI; `PUT` with `calories` returns `400` | Q2 |
| 9 | Edit the banana to 90 and move it to Lunch | Totals and meal subtotals update | US1-3, US1-8 |
| 10 | Enter calories 0, 5001, 99.5 and empty; name empty | Each rejected with the allowed range; nothing saved | US1-6 |
| 11 | Log the same food twice | Two separate entries | US1-5 |
| 12 | Quick entry with only protein filled | Saved with carbs and fat as 0; macro totals include it | US1-9 |
| 13 | Quick entry with no macros | Saved; ledger notes some entries have no macros | US2-7 |
| 14 | Log a 300 kcal workout today; reload `/food` | Burned 300; net = eaten − 300; same number as on `/workouts` | US2-2, SC-007 |
| 15 | Target 2200, net 1400 | "800 kcal remaining" | US2-3 |
| 16 | Eat past the target | "X kcal over", plainly worded | US2-4 |
| 17 | Remove an entry | Gone; totals drop | US1-4 |
| 18 | Offline, add an item | "Couldn't save. Try again."; item not kept | Edge: failed save |
| 19 | Go to the previous day, then back | That day's meals and ledger; ▶ returns; no ▶ on today | US3-1 |
| 20 | Log on yesterday and two days ago | Both editable | US3-2 |
| 21 | Open a date 3 days back | Read-only banner; no add, edit or remove; lists not offered | US3-3, US4-7 |
| 22 | `curl -X POST` an entry for 3 days back, then for tomorrow | `409 DAY_LOCKED`, then `400` | FR-017 |
| 23 | Open `/food?date=2999-01-01` | Redirected to today | FR-016 |
| 24 | Leave `/food` open across local midnight | Within about a minute the screen moves to the new day | FR-018 |
| 25 | Search "dal" | Built-in "Dal" with its serving and calories, labelled Built-in | US4-1, SC-008 |
| 26 | Create own food "Mom's paratha", 1 piece, 180 kcal | In `/food/mine` and in search as Mine; invisible to another user | US4-3, FR-023 |
| 27 | Create "mom's  paratha" again | Rejected: duplicate name. Creating one named like a built-in food ("Dal") is allowed | FR-021 |
| 28 | Log it, then edit its calories to 300, then remove it | Today's entry still 180; new picks use 300; entry still shown after removal | US4-4, FR-008 |
| 29 | Log "Oats" on two days with different calories; open the Add panel | Oats appears once under Recent with the latest calories; tapping adds a typed entry (editable) | US4-3, US4-5, Q5 |
| 30 | A new user opens the Add panel | Built-in foods only; no Recent section | US4-6 |
| 31 | Sign in as a second user | Sees none of the first user's entries, own foods or recent foods | FR-024, SC-005 |
| 32 | Change timezone in Settings to one where the date differs, reload | Today follows the new timezone; entries already logged stay on their dates | FR-015 |
| 33 | `GET /food` for a day in the last month | One response, under 1 s | SC-006 |

## 4. Cleanup

```sh
pnpm cdk destroy --all -c stage=dev   # dev data is not retained
```
