# Tasks: Reaction Notifications and "Who Reacted"

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [research.md](research.md)
**Tests**: domain logic is test-first (constitution III, lean); one handler test file per story.

## Phase 1: Setup

- [X] T001 `GET /me` returns the caller's `userId` (`packages/shared/src/contracts/me.ts`, `services/api/src/handlers/me-*.ts`, `services/api/test/me-get.test.ts`) — done before the spec (US3)

## Phase 2: Foundational

- [X] T002 [P] Write failing tests for `unreadCount`, `pickNotifications` (not expired, newest first, cap 50) and `groupReactors` (viewer first, then by `createdAt`; unnamed reactors → `others`) in `packages/shared/src/domain/notifications.test.ts`
- [X] T003 Implement `packages/shared/src/domain/notifications.ts` (types per data-model.md: `types` ⊆ {fire, muscle, crown}, `ttl` = latestAt + 30 days) and export from `packages/shared/src/index.ts`
- [X] T004 [P] Add strict schemas `NotificationSchema`, `NotificationsSchema` (`items` max 50), `NotificationsSeenInputSchema` (`{ upTo: iso }`), `ReactorsSchema` in `packages/shared/src/contracts/notifications.ts`; export; add `unreadNotifications: z.number().int().min(0).default(0)` to `MeResponseSchema`
- [X] T005 Extend `SquadRepo` in `services/api/src/lib/squad-repo.ts`: `notify(owner, eventId, reactor, type, nowIso)`, `unnotify(owner, eventId, reactor, type)`, `listNotifications(owner) → { items, seenAt }` (one `begins_with(sk,"NOTIF")` query), `markNotificationsSeen(owner, upTo)` (only forward), `listReactors(key) → {type, reactorId, createdAt}[]`, `batchGetFeed(keys)`; `deleteFeed` also deletes `NOTIF#<eventId>#`
- [X] T006 Mirror T005 in `InMemorySquadRepo` in `services/api/test/fakes.ts` (reactions keep `createdAt`)

## Phase 3: User Story 1 — notifications (P1)

**Independent test**: B reacts to A's item → A's `GET /me` has `unreadNotifications: 1`; `GET /me/notifications` lists it; seen clears it; removing the reaction removes it.

- [X] T007 [US1] `services/api/src/lib/notifications.ts`: `safeNotify(deps, owner, eventId, reactor, type, on)` (swallows errors, logs only `err.name`) and `notificationsView(caller, deps)` (feed items batch-read, missing dropped; reactor named only if `visibleTo(reactor, owner)`)
- [X] T008 [US1] Call `safeNotify` after a successful add/remove in `services/api/src/lib/reaction.ts`
- [X] T009 [P] [US1] Handlers `services/api/src/handlers/me-notifications-get.ts` and `me-notifications-seen-put.ts`; `me-get.ts` computes `unreadNotifications` in parallel with the profile read and its `handler` dispatches on `routeKey`
- [X] T010 [US1] Routes `GET /me/notifications`, `PUT /me/notifications/seen` on the `me-get` function (now `write: true`) in `infra/lib/api-stack.ts`
- [X] T011 [US1] Test `services/api/test/notifications.test.ts`: add → unread 1 with types; second type merges; remove all → gone; seen → 0; feed item deleted → gone; hidden reactor → `reactor: null`
- [X] T012 [P] [US1] Wording `NOTIFY_COPY`, `notificationLine`, `notificationHref` (`workout_day` → `/squad/<owner>#day-<date>`, else `/squad/feed`), `timeAgo` in `apps/web/src/lib/plain.ts`
- [X] T013 [US1] Server Action `markNotificationsSeen(upTo)` in `apps/web/src/server/actions/notifications.ts` (`refresh()` after)
- [X] T014 [US1] Page `apps/web/src/app/(app)/notifications/page.tsx` + `components/notification-list.tsx` (rows: avatar or neutral icon, line, time, unread dot; client `MarkSeen` effect)
- [X] T015 [US1] Bell link with unread badge ("9+") in `apps/web/src/app/(app)/layout.tsx` (both header variants); `id="day-<date>"` on day cards in `apps/web/src/components/day-card.tsx`

## Phase 4: User Story 2 — who reacted (P1)

**Independent test**: two members react to a third's day → any member's `GET /squad/feed/{id}/reactions` lists them per type; hidden reactor → `others`.

- [X] T016 [US2] Handler `services/api/src/handlers/squad-reactors-get.ts`; `squad-feed-get.ts` `handler` dispatches on `routeKey`
- [X] T017 [US2] Route `GET /squad/feed/{id}/reactions` on the `squad-feed-get` function in `infra/lib/api-stack.ts`
- [X] T018 [US2] Tests in `services/api/test/notifications.test.ts` (reactors: order, "You" first, hidden → others, hidden author → 404)
- [X] T019 [US2] Server Action `loadReactors(id)` in `apps/web/src/server/actions/squad.ts`; `components/reactors-sheet.tsx` (`BottomSheet`, per type: emoji, members as profile links, "+N others")
- [X] T020 [US2] `components/reactions.tsx`: a "See who reacted" button (Users icon) when any count > 0; on own items the counts themselves open the sheet

## Phase 5: User Story 3 — header avatar → own profile (P2)

- [X] T021 [US3] Header avatar links to `/squad/<userId>` in `apps/web/src/app/(app)/layout.tsx` (done)

## Phase 6: Polish

- [X] T022 Update `CLAUDE.md` with a "Reaction notifications (feature 022)" section; note the new resource count
- [X] T023 `pnpm check` and `pnpm synth` (resource count < 500)

## Dependencies

T002 → T003; T003, T004, T005, T006 block US1/US2. US1 and US2 are independent after Phase 2. US3 is done.

## Parallel examples

- T002 ∥ T004; T009 ∥ T012; T016 can run alongside T012–T015.

## Strategy

MVP = Phase 2 + US1 (the missing notification is the core complaint), then US2, then polish.
