# Implementation Plan: Public Landing Page

**Branch**: `009-public-landing-page` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

`/` becomes a public, static landing page (navbar, hero, tabbed phone preview, three MCP cards, pulse strip, invite form). The proxy decides who sees it: no session → landing page; a session → redirect to `/workouts/gym` before any HTML is sent (no flash). The old `(app)/page.tsx` redirect page is removed. Two new unauthenticated API routes: `GET /public/pulse` (two counts) and `POST /public/waitlist` (honeypot, rate limit, one row per email). The web calls both from the Next server only, as for every other API call. Constitution VI gets a MINOR amendment naming exactly the two public counts.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 24

**Primary Dependencies**: Next.js 16 (App Router, Cache Components), Tailwind 4, zod, AWS SDK v3. No new packages.

**Storage**: Existing single DynamoDB table: new items `WAITLIST`, `WAITLISTEMAIL#<email>`, `PUBRATE#...` (TTL). See [data-model.md](data-model.md).

**Testing**: Vitest (handler tests with in-memory fakes), CDK assertions for the two new routes.

**Target Platform**: AWS Amplify Hosting (web), API Gateway HTTP API + Lambda arm64 (API).

**Project Type**: Web app + serverless API (existing monorepo).

**Performance Goals**: The landing page is part of the prerendered static shell; only the pulse strip streams in. Pulse costs 1 GSI query + 1 query per member.

**Constraints**: No horizontal overflow at 375 px; no client-side calls to AWS; no PII in logs.

**Scale/Scope**: About 3 members; waitlist expected in the tens.

## Constitution Check

| Principle | Status |
|---|---|
| I. Spec-Driven | ✅ spec + owner clarifications recorded |
| II. Types | ✅ `PulseResponseSchema`, `WaitlistRequestSchema`, `WaitlistResponseSchema` in `packages/shared/src/contracts/public.ts`, parsed in the handlers and the web |
| III. Lean tests | ✅ handler tests: pulse (counts + no extra fields), waitlist (stored, dedupe, honeypot, rate limit). No new pure domain math (pulse reuses `localDate`/`addDays`). CDK: the two routes are `NONE`-auth and the waitlist function's grants |
| IV. IaC | ✅ routes in `api-stack.ts`; table already has `ttl` |
| V. Server-authoritative / timezones | ✅ "last 7 days" uses each member's own timezone for their entries |
| VI. Members-only visibility | ⚠️ needs amendment → **resolved**: MINOR bump 2.1.0 → 2.2.0 permits exactly the lifter count and 7-day workout count to anonymous visitors. Waitlist data is not member data; operator-only |
| VII. Simplicity | ✅ no CAPTCHA, no email sending, no new service. Per-address + global hourly caps instead of a WAF |

Post-design re-check: unchanged, all ✅ once the amendment lands (task T001).

## Project Structure

### Documentation (this feature)

```text
specs/009-public-landing-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/public-api.md
└── tasks.md
```

### Source Code

```text
.specify/memory/constitution.md               # VI amendment, 2.2.0
packages/shared/src/contracts/public.ts       # new: pulse + waitlist schemas, goal labels
packages/shared/src/index.ts                  # export
services/api/src/lib/waitlist-repo.ts         # new: add (dedupe), hit (rate counter), list
services/api/src/lib/deps.ts                  # + waitlist
services/api/src/handlers/public-pulse-get.ts # new
services/api/src/handlers/public-waitlist-post.ts # new
services/api/test/fakes.ts                    # + InMemoryWaitlistRepo
services/api/test/public-pulse.test.ts        # new
services/api/test/public-waitlist.test.ts     # new
infra/lib/api-stack.ts                        # 2 routes, auth: false
infra/test/stacks.test.ts                     # route list + NONE auth list
infra/scripts/admin.ts                        # `waitlist list`
apps/web/src/proxy.ts                         # "/" public; session on "/" → /workouts/gym
apps/web/src/app/(app)/page.tsx               # deleted
apps/web/src/app/page.tsx                     # new landing page (server component)
apps/web/src/app/_landing/*.tsx               # private folder: preview tabs, invite form, pulse strip
apps/web/src/server/public-api.ts             # new: tokenless fetch for /public/*
apps/web/src/server/actions/waitlist.ts       # new Server Action
apps/web/src/app/(app)/layout.tsx, server/session.ts, server/actions/profile.ts  # "/" → "/workouts/gym"
CLAUDE.md                                     # feature 009 notes
```

**Structure Decision**: The existing monorepo layout. Landing components live in `apps/web/src/app/_landing/` (private folder, not a route) because nothing else uses them.

## Complexity Tracking

None.
