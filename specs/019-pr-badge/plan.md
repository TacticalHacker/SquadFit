# Implementation Plan: Live PR Badge

**Branch**: `019-pr-badge` | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-pr-badge/spec.md`

## Summary

One PR definition (weight > reps > estimate, estimate for 1–10 reps, existing jump hold, 0 kg never counts) lives in a new pure module `packages/shared/src/domain/pr.ts`. The server's PR walk (`squad.ts` `walkLift`) and the drawer's preview both call it. The walk also stores compact "bests before" snapshots (`SQUADSTATS.lifts[id].prBase`) for each exercise's latest 3 entry dates; `GET /workouts/gym` already reads that item and passes `bests` per exercise, so the drawer checks every change locally with no request. PR records extend the existing `prDays` (rebuilt from full history on every write), Rep PRs flow into the feed, the save response gains `prs` and `streakWeeks` for a new 3-second toast. Rollout ends with `pnpm admin squad backfill`.

## Technical Context

**Language/Version**: TypeScript 5 (ESM), Node 22 Lambdas, React 19 / Next.js 16 App Router

**Primary Dependencies**: zod (contracts), lucide-react (Star icon), Tailwind 4 tokens; nothing new

**Storage**: DynamoDB single table: `USER#<sub>/SQUADSTATS` (fields added), `FEED#pr#…` payload (fields added). No new items. See [data-model.md](data-model.md)

**Testing**: vitest: `packages/shared/test` (domain, test-first), `services/api/test` (handlers with `fakes.ts`)

**Target Platform**: AWS Lambda + HTTP API (ap-south-1); mobile Safari (iOS 18+ for the tick) and Android Chrome

**Project Type**: web app (monorepo: `apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: badge within 100 ms of a change (pure function over ≤ 20 sets and a ≤ ~15-point frontier); `GET /workouts/gym` gains no reads

**Constraints**: no new taps, popups or buttons; no scale animation; never log sets, weights, names or PRs; `SQUADSTATS` stays well under 400 KB (~30 KB added worst case)

**Scale/Scope**: private beta, one squad; ~60 lifts per member worst case

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|---|---|
| I. Spec-driven | ✅ spec + clarifications (Q1–Q3) done |
| II. Type safety | ✅ all new fields in zod contracts with defaults |
| III. Test-first domain | ✅ `pr.ts` and `walkLift` changes written test-first; lean tests from the acceptance table |
| IV. IaC / serverless | ✅ no infra change, no new grants |
| V. Server-authoritative | ✅ records, feed PRs and the toast count come from the server; the badge is a preview using the same shared rules |
| VI. Members-only visibility | ✅ `bests` only on the owner's gym view; squad sees PRs only where it already does (feed, profile PR board, share) |
| VII. Simplicity | ✅ no new items or routes; records reuse `prDays` |

Post-design re-check: unchanged, all pass. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/019-pr-badge/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/domain/pr.ts              # NEW: classifySet, pickTopPr, isBigJump, addToBests, bestsBefore, previewPr
packages/shared/src/domain/squad.ts           # walkLift uses pr.ts; prDays.records/type/gainReps; prBase; feed payload type/gainReps
packages/shared/src/contracts/gym.ts          # PrBestsSchema; GymExercise.bests; GymSaveResult.prs/streakWeeks
packages/shared/src/contracts/squad.ts        # feed pr.type, pr.gainReps
packages/shared/test/pr.test.ts               # NEW
packages/shared/test/squad.test.ts            # Rep PR, held jump, edit-removes-later-PR, prBase
services/api/src/lib/gym-view-loader.ts       # bests from the stats read it already does; prs + streakWeeks in the save result
services/api/src/handlers/squad-feed-get.ts   # pass type/gainReps
services/api/test/…                           # gym-entry-put / gym-get assertions
apps/web/src/components/gym-drawer.tsx        # preview in dispatch, badge footer, row star, haptic, live region
apps/web/src/components/pr-badge.tsx          # NEW: pill / baseline / normal line, typo hint
apps/web/src/lib/haptics.ts                   # NEW: vibrate or iOS switch tick, silent no-op
apps/web/src/components/toast.tsx             # NEW: 3 s status toast
apps/web/src/components/gym-screen.tsx        # shows the toast from onSaved
apps/web/src/lib/plain.ts                     # PR wording (badge, baseline, hint, announce, toast, feed Rep PR)
CLAUDE.md                                     # "PR badge (feature 019)" section
```

**Structure Decision**: existing monorepo layout; one new shared domain module and three small web files.

## Rollout

1. Deploy (API then web; new fields default, so order doesn't break parsing).
2. `AWS_PROFILE=macmini-raj pnpm admin squad backfill`: rebuilds `prBase`/`prDays` with the new rules; historical Rep PRs are seeded, so none post.
3. Hand check haptics on one iPhone and one Android phone (SC-006).
