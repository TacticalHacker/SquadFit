# Implementation Plan: Squad Member Profiles and Shared Nutrition

**Branch**: `011-squad-profiles-nutrition` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-squad-profiles-nutrition/spec.md`

## Summary

Add member profiles (`/squad/[memberId]`), expandable leaderboard rows with a "Today's workouts" view, per-day high-fives, opt-in nutrition sharing at three levels, and a Nutrition board ranked only on each member's own protein target. No new table or index: profile attributes, lazily created high-five targets under the author's partition, and everything else computed on read from existing workout and food entries (so a sharing change applies to past days instantly). The privacy core is one pure function in `packages/shared` that turns a member's own day data plus a sharing level into one of three strict zod shapes (`off` → no nutrition keys, `totals`, `meals`); handlers only ever serialise through those schemas.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22 Lambdas, Next.js 16 App Router, Tailwind 4

**Primary Dependencies**: zod, AWS SDK v3 (DynamoDB doc client, S3 presigner), `lucide-react`, existing Spec Kit toolchain

**Storage**: Existing DynamoDB single table (`pk`/`sk`, `gsi1pk`/`gsi1sk`); existing private S3 bucket for photos

**Testing**: Vitest (domain in `packages/shared/test`, handlers with fakes in `services/api/test`), lean per constitution III

**Target Platform**: AWS Lambda + API Gateway HTTP API (Cognito JWT), Amplify-hosted Next.js

**Project Type**: Web application, monorepo (`apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: profile + first timeline page < 2 s; row expansion < 1 s (spec SC-002)

**Constraints**: server-enforced sharing; no logging of food, photos, sets or names; days in each member's timezone

**Scale/Scope**: a friend squad (tens of members); the Nutrition board reads ≤ 30 days of food per sharing member

## Constitution Check

| Principle | Status |
|---|---|
| I–IV (spec first, shared contracts, lean tests, serverless AWS) | Pass: Spec Kit flow, zod contracts in `packages/shared`, pure domain test-first, no new service |
| V Server-authoritative, local day | Pass: all day math server-side from each member's timezone; ranking never uses calories |
| VI Members-only visibility | **Needs amendment 2.4.0** (MINOR): nutrition opt-in fields enumerated per level (task T001). Anonymous access unchanged. Food, targets, photos only through level-gated shapes |
| VII Simplicity | Pass: no new table/GSI; day high-fives reuse the existing high-five item; Complexity Tracking empty |

Re-check after design: still pass; the only constitution change is the VI amendment.

## Project Structure

### Documentation (this feature)

```text
specs/011-squad-profiles-nutrition/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── web.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/
│   ├── member-profile.ts     # NEW: day cards, sessions, heatmap levels, timeline paging (pure)
│   ├── nutrition-share.ts    # NEW: level → shape, protein-hit days, ranking (pure)
│   └── squad.ts              # reuse e1rm / PR rules; no change except exports
└── contracts/
    ├── squad-profile.ts      # NEW: profile, timeline, day log, today, nutrition shapes
    └── squad.ts              # CHANGED: settings + leaderboard (nutrition board/rows), feed kinds
services/api/src/
├── handlers/
│   ├── squad-member-get.ts, squad-member-timeline-get.ts, squad-member-day-get.ts   # NEW
│   ├── squad-today-get.ts                                                            # NEW
│   ├── squad-leaderboard-get.ts, squad-feed-get.ts, me-squad-put.ts                  # CHANGED
│   └── squad-hi5-put.ts / squad-hi5-delete.ts                                        # CHANGED: day# targets
└── lib/
    ├── member-access.ts      # NEW: one gate: loads profile, hidden → MEMBER_PRIVATE, resolves level
    ├── member-view.ts        # NEW: loads entries/food and builds views via the pure domain
    ├── protein-events.ts     # NEW: reconciles protein7# feed items after food writes
    ├── squad-repo.ts         # CHANGED: unlisted feed items, workout-entry range desc paging
    └── profile-repo.ts       # CHANGED: nutritionSharing, nutritionPromptSeen
apps/web/src/
├── app/(app)/squad/[memberId]/page.tsx     # NEW
├── components/
│   ├── member-profile.tsx, heatmap.tsx, day-card.tsx, timeline.tsx                 # NEW
│   ├── board-row.tsx, squad-boards.tsx, squad-feed.tsx, squad-settings-form.tsx    # CHANGED
│   └── nutrition-card.tsx, nutrition-row.tsx, today-workouts.tsx                   # NEW
└── server/actions/squad.ts                                                         # CHANGED
infra/lib/api-stack.ts   # new routes; S3 photo read for the member endpoints
```

**Structure Decision**: Same monorepo layout as features 002–010. All rules are pure functions in `packages/shared/src/domain` (test-first); handlers stay thin and go through `member-access` so no endpoint can forget the visibility or sharing check.

## Complexity Tracking

No constitution violations to justify.
