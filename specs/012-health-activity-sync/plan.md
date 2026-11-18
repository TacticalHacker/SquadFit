# Implementation Plan: Health Activity Sync (Daily Steps)

**Branch**: `012-health-activity-sync` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-health-activity-sync/spec.md`

## Summary

Members save daily steps (plus optional active calories and distance) through two routes that call one service
(`lib/activity-write.ts`): two new MCP tools on the existing server, and a new anonymous-route Lambda
`POST /integrations/activity` that authenticates a separate, member-generated `sfh_` Health sync token. Each day is one
item `USER#<sub>/ACTIVITY#<date>` written with a plain put, so the latest write wins. Parsing that forgives Shortcut
quirks, Health Auto Export detection, validation, the steps board ranking and the 7-day goal run are pure functions in
`packages/shared/src/domain/activity.ts`. Visibility goes through one choke point (`stepsShared`). Steps reach the
profile, "Today's workouts", leaderboard rows, a new Steps board and a `step_streak` feed item. All of these are
computed on read, except the feed item, which is kept true on write the same way as feature 011's protein streak.

## Technical Context

**Language/Version**: TypeScript 6 (ESM, strict), Node.js 24 Lambdas (arm64), Next.js 16 App Router, Tailwind 4

**Primary Dependencies**: zod 4, AWS SDK v3 (DynamoDB document client), `@modelcontextprotocol/sdk` (existing), `lucide-react`

**Storage**: Existing DynamoDB single table (no new index); profile gains two optional attributes

**Testing**: Vitest. Domain tests in `packages/shared/test`, handler and tool tests with in-memory fakes in `services/api/test`; lean per constitution III

**Target Platform**: AWS API Gateway HTTP API + Lambda; Amplify-hosted Next.js

**Project Type**: Web application monorepo (`apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: A sync request (≤ 31 days) finishes in under 1 s. Board and profile reads add at most one Query per visible member (≤ 30 items each)

**Constraints**: Days are computed in each member's timezone. Sync tokens are never stored or logged in plain text. Values and bodies are never logged. Writes are all or nothing per request

**Scale/Scope**: A friend squad (tens of members), ≤ 31 days per write, a 30-day read window

## Constitution Check

| Principle | Status |
|---|---|
| I Spec-driven | Pass: spec 012, Spec Kit flow |
| II Type safety | Pass: every request/response shape in `packages/shared/src/contracts/activity.ts` (+ strict squad additions); the lenient body parser outputs a strict schema |
| III Test-first, lean | Pass: domain functions (parse, validate, rank, run) test-first; handler tests only for auth, the overwrite rule and privacy |
| IV IaC, serverless | Pass: five Lambdas through the existing `route()` helper, same table, least-privilege (only the integration and write routes get `write`) |
| V Server-authoritative, local day | Pass: "today", the 30-day window, goal hits, averages and runs are server-only and use the owner's timezone; nothing ranks by calories |
| VI Members-only visibility | **Needs amendment 2.5.0** (MINOR, task T001): steps, step goal, goal hits, step-run feed items and (profile only) active calories and distance may be shown when the owner is visible and shares steps; no ranking by active calories. Anonymous routes still return no member data (the sync route returns only the caller's own saved days) |
| VII Simplicity | Pass: no new table or GSI, no chart library; the sync token copies the existing key pattern. Complexity Tracking empty |

Re-check after design: still passes. The only constitution change is the VI amendment.

## Project Structure

### Documentation (this feature)

```text
specs/012-health-activity-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md        # HTTP routes (sync + member settings + squad additions)
│   └── mcp.md        # upsert_daily_activity, get_daily_activity
└── tasks.md          # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/activity.ts              # NEW parse/normalise/validate, goal hit, rank, 7-day run, chart days
├── domain/ai-credential.ts         # + sfh_ token generate/parse (server-only subpath)
├── contracts/activity.ts           # NEW day, sync body/response, status, step settings
├── contracts/squad.ts              # + feed kind step_streak
├── contracts/squad-profile.ts      # + steps on DayCard, restDays on Today, steps on profile, Steps board
├── contracts/me.ts                 # + OwnProfile.steps
└── index.ts                        # export activity

services/api/src/
├── lib/activity-repo.ts            # NEW ACTIVITY#<date> put/range
├── lib/health-token-repo.ts        # NEW HEALTHTOKEN/HEALTHCRED/HEALTHRATE
├── lib/activity-write.ts           # NEW shared save service (validate → put → refresh step events)
├── lib/step-events.ts              # NEW step_streak feed items (safeRefreshSteps)
├── lib/member-access.ts            # + stepsShared choke point
├── lib/mcp/activity.ts             # NEW the two tools
├── lib/deps.ts, profile-repo.ts    # + activity, healthTokens; profile dailyStepGoal/shareSteps
├── handlers/integrations-activity-post.ts   # NEW anonymous route, sync-token auth
├── handlers/me-health-sync-get.ts           # NEW status
├── handlers/me-health-token-post.ts         # NEW issue/regenerate
├── handlers/me-health-token-delete.ts       # NEW revoke
├── handlers/me-steps-put.ts                 # NEW goal + share toggle
└── handlers/squad-*.ts                      # leaderboard, today, member, timeline, feed: steps additions

infra/lib/api-stack.ts              # 5 routes
apps/web/src/
├── app/(app)/settings/page.tsx     # + Apple Health sync section
├── components/health-sync-section.tsx  # NEW (client: token reveal/copy, goal, toggle)
├── components/steps-chart.tsx      # NEW 30-day bars (CSS, tokens)
├── components/day-card.tsx, today-workouts.tsx, member-profile.tsx, squad-boards.tsx, squad-feed.tsx
└── server/actions/health.ts        # NEW Server Actions
```

**Structure Decision**: The existing monorepo layout. Every new route is one Lambda file plus one `route()` line.

## Complexity Tracking

None.
