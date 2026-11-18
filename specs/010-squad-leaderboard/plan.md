# Implementation Plan: Squad Leaderboard

**Branch**: `010-squad-leaderboard` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-squad-leaderboard/spec.md`

## Summary

Give signed-in members a `/squad` page with four boards (weekly Streaks, PRs, Consistency, Lifts) and an activity feed with high-fives, plus Settings for weekly target, leaderboard visibility and opt-in body weight sharing.

Approach:
- **Domain first** (`packages/shared/src/domain/week.ts`, `squad.ts`, test-first): `weekStart`, `buildMemberStats(entries, prevStats, settings, today, opts)` (workout days, per-week counts with frozen targets, working sets, e1RM, PR days, jump flags, feed events with stable ids), read-time `streakFigures`, `consistency`, `buildBoards`, `rankRows` (competition ranking).
- **Compute on write** (research R1–R2): `refreshSquadStats(userId, deps)` rebuilds the member's `SQUADSTATS` item in full from their entries and diffs their feed items, called from `saveGymEntry` (HTTP + MCP), activity put/delete, gym delete, jump confirm and squad settings. Read-time pure functions handle anything that depends on "today", so a week ending without writes stays correct.
- **Storage** ([data-model.md](data-model.md)): profile gains `weeklyTarget`, `leaderboardVisible`, `shareBodyWeight`; entries gain `jumpConfirmedAt`; new items `SQUADSTATS`, `FEED#<eventId>` (squad feed via `gsi1pk = SQUADFEED#global`) and `HI5#<eventId>#<reactor>`. No new table or index.
- **API** ([contracts/api.md](contracts/api.md)): `GET /squad/leaderboard`, `GET /squad/feed`, `PUT|DELETE /squad/feed/{id}/high-five`, `PUT /me/squad`, `PUT /workouts/gym/entries/{date}/{exerciseId}/confirm`; `jumpFlag` on gym entries; `weeklyStreak` on `/workouts/summary`; weekly streak in MCP `get_full_context`.
- **Web** ([contracts/web.md](contracts/web.md)): Squad nav item and page, Settings section, "Unusual jump" note in the gym drawer, weekly streak in `DayNav`, landing "Coming soon" tag removed.
- **Backfill** (R12): `pnpm admin squad backfill` seeds stats, trusts history, creates no feed items, safe to re-run.
- **Constitution** amended to 2.3.0 (principle VI: leaderboard opt-out, opt-in body weight ratio), as approved by the owner.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing: Next.js 16 (App Router, Cache Components, Server Actions), React 19, Tailwind 4, zod 4, `lucide-react`, AWS SDK v3 `lib-dynamodb`, AWS CDK v2, `@modelcontextprotocol/sdk`. **No new dependencies.**

**Storage**: DynamoDB single table: new attributes on `PROFILE` and `ENTRY#…`; new item types `SQUADSTATS`, `FEED#…`, `HI5#…` under `USER#<sub>`; squad feed on the existing `gsi1`.

**Testing**: Vitest (shared domain tests in `packages/shared/test`; handler tests with `services/api/test/fakes.ts` extended with an in-memory `SquadRepo`), `aws-cdk-lib/assertions` for the new routes, manual [quickstart.md](quickstart.md).

**Target Platform**: Phone browsers first → Amplify-hosted Next.js → API Gateway HTTP API → Lambda arm64.

**Project Type**: Web application (monorepo: `apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: `/squad` server render ≤ 2 s on a phone (SC-001): two parallel API calls; leaderboard = 1 Query + 1 BatchGet; feed = 1–2 Queries + 1 BatchGet. A save adds one rebuild (1 Query of the member's entries + 1 Get + 1 Query of feed items + ≤ a few writes), well under 300 ms at current volumes.

**Constraints**: No horizontal scroll at 320 px; 44 px tap targets; no body weight, calories, food, timezone or username in any squad response; never log entries, sets, weights, names or feed text; all squad routes require Cognito.

**Scale/Scope**: ~3 members (PRD §5.2), up to tens; hundreds of entries per member; feed shows 20 items.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Spec-Driven | ✅ | Spec clarified (2 Qs + owner's 4 pre-spec answers), no markers. Plan adds nothing beyond FR-001..FR-032. |
| II. End-to-End Types | ✅ | New `contracts/squad.ts` (strict zod), changed `me.ts`, `gym.ts`, `workouts.ts`; the web parses every response. |
| III. Test-First Domain | ✅ | Week, streak, PR, e1RM, jump, consistency and ranking math are pure in `packages/shared/src/domain` with failing tests first, limited to the spec's 8 cases plus access checks (lean-tests rule). Handlers stay thin; CDK assertions for the routes. |
| IV. IaC, Serverless | ✅ | 6 `route()` additions in `api-stack.ts`; no new stateful resource, no stream or queue. |
| V. Server-Authoritative | ✅ | Streaks, PRs, ranks and flags are computed only on the server; "today" and weeks use each member's timezone. No scoring formula is introduced (PRD §5.1 stays open), so the overeating rule is unaffected. |
| VI. Members-Only Visibility | ✅ (after amendment 2.3.0) | All squad routes require auth; `SquadMemberSchema` is strict (name, avatar, id, isYou only); hidden members excluded server-side; body weight only as an opt-in ratio. The amendment to allow opt-out and the ratio was approved by the owner and is applied in `.specify/memory/constitution.md`. |
| VII. Simplicity | ✅ | Reuses the single table, `gsi1`, `listCommunity`, `saveGymEntry`, `Avatar`, `Stepper`, `segmentClass`. One extra item type per concern; rejected streams/Lambda recompute (R1). |

**Post-design re-check**: ✅ unchanged after research, data model and contracts.

## Project Structure

### Documentation (this feature)

```text
specs/010-squad-leaderboard/
├── plan.md              # This file
├── research.md          # Phase 0 (R1–R13)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── api.md           # HTTP + MCP changes
│   └── web.md           # pages, components, copy
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/week.ts               # NEW weekStart, weekOf, isWeekEnded
├── domain/squad.ts              # NEW buildMemberStats, streakFigures, consistency, buildBoards, rankRows, e1rm, jump rule
├── domain/streak.ts             # currentStreak removed (goalProgress stays)
├── contracts/squad.ts           # NEW leaderboard, feed, settings, confirm schemas
├── contracts/{me,gym,workouts}.ts  # squad settings, jumpFlag, weeklyStreak
└── index.ts                     # exports
packages/shared/test/{week,squad}.test.ts      # NEW

services/api/src/
├── lib/squad-repo.ts            # NEW SquadRepo: stats get/put(versioned)/batchGet, feed list/put/delete, hi5 add/remove/batchGet
├── lib/squad-stats.ts           # NEW refreshSquadStats(userId, deps, { seed? })
├── lib/deps.ts                  # + squad
├── lib/gym-save.ts              # + refresh after put
├── lib/profile-repo.ts          # + squad settings fields, setSquadSettings
├── lib/workout-repo.ts          # + confirmJump (conditional on updatedAt)
├── lib/mcp/tools.ts             # weekly streak in get_full_context
└── handlers/
    ├── squad-leaderboard-get.ts, squad-feed-get.ts, squad-hi5-put.ts, squad-hi5-delete.ts   # NEW
    ├── me-squad-put.ts, gym-entry-confirm-put.ts                                          # NEW
    ├── entry-put.ts, entry-delete.ts, gym-entry-delete.ts      # + refresh
    ├── gym-get.ts, workouts-summary-get.ts, me-get.ts          # + jumpFlag / weeklyStreak / squad settings
services/api/test/squad-leaderboard.test.ts, fakes.ts (+ InMemorySquadRepo), mcp-upserts.test.ts (+1 case)

infra/
├── lib/api-stack.ts             # 6 routes
├── scripts/admin.ts             # squad backfill
└── test/stacks.test.ts          # route assertions

apps/web/src/
├── app/(app)/squad/page.tsx     # NEW
├── components/squad-boards.tsx, squad-feed.tsx, board-row.tsx, squad-settings-form.tsx   # NEW
├── components/{nav-links,day-nav,gym-drawer}.tsx   # nav item, weekly streak, jump note
├── app/(app)/settings/page.tsx  # Squad section
├── app/(app)/workouts/page.tsx, workouts/gym/page.tsx   # weeklyStreak from summary
├── server/actions/squad.ts      # NEW toggleHighFive, saveSquadSettings, confirmJump
└── app/_landing/product-preview.tsx   # drop "Coming soon"

CLAUDE.md                        # feature 010 section
.specify/memory/constitution.md  # 2.3.0 (done during planning)
```

**Structure Decision**: Existing monorepo layout; one new domain module pair, one repo, one service, six thin handlers, one page with three client components.

## Complexity Tracking

No constitution violations to justify. The principle VI change is an approved amendment (2.3.0), not a deviation.
