# Implementation Plan: Bodyweight Tracker

**Branch**: `014-bodyweight-tracker` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-bodyweight-tracker/spec.md`

## Summary

Members log weigh-ins (several per day, kept separately) from a quick-log sheet on a new Bodyweight card on `/food`. The card also holds an Apple Health-style SVG chart (W | M | 6M | Y) with scrubbing.

- **Storage**: each entry is one DynamoDB item, `WEIGHT#<date>#<saveTimeId>`. Key order is date, then save time, so the latest entry is a single descending query. The profile `bodyWeightKg` is re-synced to that latest entry after every write, and backfills never override today.
- **Chart math**: all bucketing, averages, the 7-day moving average and axis scaling live in one test-first pure module (`domain/bodyweight.ts`). The server returns a fully built `WeightView`, and the client only draws it.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**:
- Next.js 16 App Router, React, Tailwind 4 and `lucide-react` (web)
- zod (shared contracts)
- AWS SDK v3 `lib-dynamodb` (API)
- AWS CDK v2 (infra)
- No new packages: the chart is hand-written SVG.

**Storage**: DynamoDB single table. New `WEIGHT#` items under `USER#<sub>`; the existing profile `bodyWeightKg` changes semantics (see [data-model.md](data-model.md)).

**Testing**: Vitest (domain + handlers with `services/api/test/fakes.ts`), `aws-cdk-lib/assertions` for the new routes

**Target Platform**: AWS Lambda (arm64) behind HTTP API with the Cognito authorizer; web on Amplify Hosting; mobile Safari/Chrome first

**Project Type**: web app + serverless API (pnpm monorepo)

**Performance Goals**: range switch < 1 s (SC-003); scrubbing at 60 fps (pure `nearestSlot`, no re-fetch while dragging)

**Constraints**:
- Today comes from the member's timezone (constitution V).
- The browser never calls the API directly.
- No weight in any squad/public/MCP/log output (VI).
- Token colours only.

**Scale/Scope**: ≤ 10 entries/day/member; the Y range reads ≤ ~3,700 items worst case (paged query), typically < 400

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|---|---|
| I. Spec-driven | ✅ Spec clarified (2026-11-24), no open markers. |
| II. Type safety | ✅ `contracts/weight.ts` zod schemas, parsed in the handlers and in the Server Actions (`WeightViewSchema`). |
| III. Test-first domain | ✅ `bodyweight.test.ts` written before `bodyweight.ts`. The handler tests cover only auth/edit-window/limit and the latest-entry sync. No UI tests (lean rule). |
| IV. IaC, serverless | ✅ 3 routes via `route()` in `api-stack.ts`, write grant only on post/delete. No new resources. Stack assertion for the routes. |
| V. Server-authoritative | ✅ Today, the edit window, the 10/day limit, averages and the profile weight sync are all on the server. The client renders `WeightView`. |
| VI. Members-only visibility | ✅ Body weight stays owner-only. No squad/public/feed/share/MCP reader of `WEIGHT#`. No values logged. The e1RM ratio rule is unchanged (it still reads profile `bodyWeightKg`). |
| VII. Simplicity | ✅ No chart library, no GSI, no stream. The view is returned from writes, so there's no extra fetch. |

**Post-design re-check**: still passing; no Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/014-bodyweight-tracker/
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
├── domain/bodyweight.ts          # NEW rangeWindow, buildWeightView, movingAverage(trend), weightAxis, nearestSlot, latestEntry, stepWeightKg
└── ../test/bodyweight.test.ts    # NEW (test-first)
├── contracts/weight.ts           # NEW zod schemas
└── index.ts                      # export both

services/api/src/
├── lib/weight-repo.ts            # NEW DynamoWeightRepo: create, delete, listRange, latest, countDay
├── lib/weight-write.ts           # NEW logWeight / deleteWeight / syncProfileWeight / loadWeightView
├── lib/profile-repo.ts           # + setBodyWeight
├── lib/deps.ts                   # + weights
├── handlers/weight-get.ts        # NEW GET /me/weight
├── handlers/weight-post.ts       # NEW POST /me/weight
├── handlers/weight-delete.ts     # NEW DELETE /me/weight/{date}/{entryId}
└── handlers/me-profile-put.ts    # changed: different weight → entry for today
services/api/test/
├── fakes.ts                      # + in-memory weights repo, setBodyWeight
└── weight.test.ts                # NEW

infra/lib/api-stack.ts            # + 3 routes; stack test asserts them

apps/web/src/
├── server/actions/weight.ts      # NEW loadWeightView, logWeight, deleteWeight
├── components/bodyweight-card.tsx   # NEW card: latest, Log weight, chart
├── components/weight-chart.tsx      # NEW SVG chart + segmented control + header + scrubbing
├── components/weight-sheet.tsx      # NEW BottomSheet: day chips, steppers, decimal input, Save, day entries + delete
├── lib/weight-trend-pref.ts         # NEW localStorage toggle via useSyncExternalStore
├── lib/plain.ts                     # + weight wording/formatters
└── app/(app)/food/page.tsx          # render <BodyweightCard> after FoodScreen (own Suspense)
```

**Structure Decision**: the existing monorepo layout. Domain math goes in `packages/shared`, thin handlers in `services/api`, and UI in `apps/web/src/components`, as in features 002–016.

## Key Design Notes

- **Write flow** (`lib/weight-write.ts`):
  1. `loadDayContext`, then `resolveWriteDate(date ?? today)`.
  2. `countDay` < 10, else 409 `DAY_FULL`.
  3. `weights.create`.
  4. `syncProfileWeight`: `latest()` → `profiles.setBodyWeight` (best effort, logs the error name only).
  5. `loadWeightView(range)`.
- **Read flow**:
  1. `rangeWindow(range, today)` → `{ start, end, fetchFrom }`, where `fetchFrom = start − 6` for W/M.
  2. `listRange(fetchFrom, today)` plus `latest()` (if the window is empty, the latest entry can be older).
  3. `buildWeightView`.
- **Profile save**: `me-profile-put` reads the stored profile. A changed numeric weight calls `logWeight` for today after the upsert, which strips `bodyWeightKg` from the upsert when entries exist. Setup (first save) with a weight also creates the first entry, which seeds the history.
- **UI**:
  - The card is a client component seeded with the server-fetched `WeightView` (M).
  - Segment taps call `loadWeightView` inside a transition and keep the old chart until the new one arrives.
  - The sheet uses `BottomSheet`, `SheetClose`, `inputClass`, `iconButtonClass` (Minus/Plus), `buttonClass` (Save, accent fill) and `chipClass` day chips ("Today", "Yesterday", "<weekday>").
  - Entries for the chosen day are listed under the form, each with a time and a `Trash2` icon button (`aria-label="Delete 78.4 kg at 07:10"`).
- **Wording** (`plain.ts`): "Bodyweight", "Log weight", "No weigh-ins yet", "No weigh-ins in this period", "AVERAGE", "RANGE", "WEIGHT", "7-day trend", "You can log up to 10 weigh-ins a day".

## Complexity Tracking

No violations.
