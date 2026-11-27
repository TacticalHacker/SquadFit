# Implementation Plan: Squad Volume Raid

**Branch**: `021-squad-volume-raid` | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-squad-volume-raid/spec.md`

## Summary

Admins create time-boxed squad volume targets; every ticked strength set any member saves inside the raid's days counts automatically. Counting piggybacks on the existing per-member stats rebuild (`refreshSquadStats`), which already runs after every gym write path (app, AI agent, merge, jump confirm). Raid status is derived from the clock on read (no scheduler). Totals are summed from per-member contribution items in one partition query; the win is a single conditional write that also awards stickers. The Squad tab gets a raid card (one request), admins get a form, members a history page, and the existing save toast gains "+x kg to raid".

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Next.js 16 App Router + Tailwind 4 (web), AWS Lambda + API Gateway HTTP API, AWS SDK v3 DynamoDB document client, zod, lucide-react

**Storage**: existing DynamoDB single table (new item types only, see [data-model.md](data-model.md)); no new AWS resources

**Testing**: Vitest (domain tests first; handler tests with in-memory fakes)

**Target Platform**: AWS ap-south-1 (Lambda arm64), web on Amplify

**Project Type**: web app + serverless API monorepo

**Performance Goals**: Squad tab raid card in one API request; save adds one GSI query + one partition query + ≤ 2 small writes per counting raid

**Constraints**: constitution V (server-authoritative, member/squad time zones), VI (no other member's kg; hidden members never named), no new taps in logging

**Scale/Scope**: one squad of tens of members; ≤ 1 live + 3 scheduled raids; ~8 new handlers, 1 domain module, 1 contracts module, 4 web screens/components

## Constitution Check

| Principle | Check |
|---|---|
| I Spec-driven | Spec clarified (3 answers), no markers left ✅ |
| II Type safety | `contracts/raids.ts` zod, parsed both ends ✅ |
| III Test-first | `domain/raid.ts` (counting, cap, window, status, validation, suggestion, card pick) tests first; handler tests for admin auth, edit rules, win/sticker, privacy only (lean) ✅ |
| IV IaC/serverless | routes only via `route()`; no scheduler, no new resource (R1) ✅ |
| V Server-authoritative | totals, win, status computed on the server; raid days in squad tz, entry dates in member tz ✅ |
| VI Visibility | others only as name/avatar, hidden never; squad total includes hidden members' volume → constitution amended to **2.7.0** (MINOR, VI) ✅ |
| VII Simplicity | no job, no counters, totals derived (R4) ✅ |

Post-design re-check: unchanged, passes.

## Project Structure

### Documentation (this feature)

```text
specs/021-squad-volume-raid/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/raids.md
└── tasks.md
```

### Source Code

```text
packages/shared/src/
├── domain/raid.ts (+ raid.test.ts)          # status, counting, caps, validation, suggestion, card pick
├── domain/squad.ts                          # buildMemberStats also returns `held`
└── contracts/raids.ts, gym.ts, squad-profile.ts
services/api/src/
├── lib/raid-repo.ts, raid-refresh.ts, raid-view.ts
├── lib/squad-stats.ts, gym-save.ts, deps.ts
├── handlers/squad-raid-get.ts, squad-raids-get.ts, admin-raids-get.ts, admin-raid-suggest-get.ts,
│   admin-raid-post.ts, admin-raid-put.ts, admin-raid-cancel-post.ts, admin-raid-delete.ts
├── handlers/gym-entry-put.ts, squad-member-get.ts
└── test/raids.test.ts, fakes.ts
infra/lib/api-stack.ts, infra/scripts/admin.ts (StatsDeps gains raids)
apps/web/src/
├── components/raid-card.tsx, raid-form.tsx
├── app/(app)/squad/page.tsx, squad/raids/page.tsx, squad/raids/new/page.tsx, squad/raids/[raidId]/page.tsx
├── server/actions/raids.ts, lib/plain.ts, components/gym-screen.tsx (toast), member-profile.tsx
```

**Structure Decision**: existing monorepo layout; one handler per route, pure rules in `@calci/shared`.

## Complexity Tracking

None.
