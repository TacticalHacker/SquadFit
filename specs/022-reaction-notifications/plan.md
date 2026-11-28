# Implementation Plan: Reaction Notifications and "Who Reacted"

**Branch**: `022-reaction-notifications` | **Date**: 2026-11-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/022-reaction-notifications/spec.md`

## Summary

Owners get one notification per (item, reactor), written next to the reaction in the same toggle request
(best effort, never fails the reaction). A bell in the header shows the unread count, which `GET /me` returns
(one extra query, run in parallel with the profile read). `/notifications` lists them with the item described
on read from the feed item; opening it marks everything up to the newest shown as seen. Anyone who can see an
item can open "who reacted" (a bottom sheet) from the reaction counts, served by a new route on the existing
feed function. Hidden reactors are never named. The header avatar links to the member's own profile (already
done on this branch: `GET /me` returns `userId`).

## Technical Context

**Language/Version**: TypeScript 5 (ESM), Node.js Lambda runtime
**Primary Dependencies**: Next.js 16 App Router + Tailwind 4 (web), zod (contracts), AWS SDK v3 DynamoDB document client, CDK
**Storage**: DynamoDB single table (`pk`/`sk`, `ttl` attribute already enabled for rate counters)
**Testing**: vitest (shared domain, API handlers with in-memory fakes, web lib)
**Target Platform**: AWS Lambda behind HTTP API (ap-south-1), Amplify-hosted Next server
**Project Type**: web app (Next.js) + serverless API + shared package
**Performance Goals**: header unread count adds no extra round trip from the web (it rides on `GET /me`)
**Constraints**: Api stack at 476/500 CloudFormation resources: no new functions; new routes join `me-get` and `squad-feed-get`. Never log names, reactions or notification contents.
**Scale/Scope**: one small squad (tens of members); per member at most a few hundred notifications live (30-day TTL)

## Constitution Check

| Principle | Status |
|---|---|
| I. Spec-driven | Pass: spec → plan → tasks via Spec Kit. |
| II. End-to-end types | Pass: new strict zod schemas in `contracts/notifications.ts`, parsed in handlers and `apiFetch`. |
| III. Test-first domain logic | Pass: pure `domain/notifications.ts` (unread count, ordering/cap, reactor grouping with hidden rule) is written test-first; handler tests use fakes. Lean tests. |
| IV. IaC, serverless | Pass: routes added in `api-stack.ts` on existing functions; no new functions. |
| V. Server-authoritative | Pass: notifications written and read state kept on the server; the client only renders. |
| VI. Members-only visibility | Pass: names/avatars of reactors are community data shown only to signed-in members; hidden members never named (same rule as the raid "Others"); responses carry only `SquadMemberSchema` fields; nothing logged. No constitution amendment needed. |
| VII. Simplicity | Pass: no stored item descriptions (described on read from the feed item), no push, no per-row read state, one seen marker. |

Post-design re-check: still passes (see data-model and contracts).

## Project Structure

### Documentation (this feature)

```text
specs/022-reaction-notifications/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── contracts/notifications.ts      # NotificationsSchema, ReactorsSchema, SeenInputSchema
├── contracts/me.ts                 # MeResponse gains unreadNotifications
└── domain/notifications.ts         # unreadCount, pickNotifications, groupReactors (+ test)

services/api/src/
├── lib/squad-repo.ts               # notify / unnotify / listNotifications / markNotificationsSeen / listReactors / batchGetFeed; deleteFeed also removes NOTIF#
├── lib/reaction.ts                 # calls safeNotify after add/remove
├── lib/notifications.ts            # safeNotify, notificationsView (read model)
├── handlers/me-get.ts              # dispatcher: GET /me (+unread), GET /me/notifications, PUT /me/notifications/seen
├── handlers/me-notifications-get.ts, me-notifications-seen-put.ts
├── handlers/squad-feed-get.ts      # dispatcher: GET /squad/feed, GET /squad/feed/{id}/reactions
└── handlers/squad-reactors-get.ts

infra/lib/api-stack.ts              # 3 routes on existing functions; me-get gets write

apps/web/src/
├── app/(app)/layout.tsx            # bell link with badge
├── app/(app)/notifications/page.tsx
├── components/notification-list.tsx, reactors-sheet.tsx, reactions.tsx (opens sheet)
├── components/day-card.tsx         # id="day-<date>" anchor
├── server/actions/notifications.ts, squad.ts (loadReactors)
└── lib/plain.ts                    # NOTIFY_COPY, notificationLine
```

**Structure Decision**: existing monorepo layout; one dispatcher per reused function, as in feature 021 (`squad-raids.ts`).

## Complexity Tracking

No constitution violations.
