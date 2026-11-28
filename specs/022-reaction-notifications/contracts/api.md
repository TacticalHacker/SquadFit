# API contracts: Reaction Notifications (022)

All routes require a Cognito token. Schemas in `packages/shared/src/contracts/notifications.ts` (strict).

## GET /me (changed)

Adds `unreadNotifications: number` (int ≥ 0; `.default(0)` so an older API parses). Only `GET /me` computes it;
other handlers returning `MeResponse` send 0.

## GET /me/notifications

Served by the `me-get` function. Lists the caller's notifications (no side effects).

```ts
NotificationsSchema = strictObject({
  items: array(NotificationSchema).max(50),
  unreadCount: int ≥ 0,
  /** newest latestAt in items; pass to PUT /me/notifications/seen */
  latestAt: iso datetime | null,
})
NotificationSchema = strictObject({
  id: string,                            // "<eventId>~<reactorId>"
  reactor: SquadMemberSchema.nullable(), // null = hidden or gone → "Someone"
  types: array(ReactionTypeSchema).min(1),
  item: strictObject({
    id: string,                          // "<owner>~<eventId>" (feed id)
    ownerId: string,                     // for the link to the owner's profile
    kind: SquadFeedItem kind enum,
    date: DateSchema,
    exerciseName: string | null,         // pr only
    week: int | null,                    // streak_week only
    club: ClubSchema | null,             // badge only
  }),
  at: iso datetime,                      // latestAt
  unread: boolean,
})
```

Errors: 409 `PROFILE_REQUIRED`.

## PUT /me/notifications/seen

Served by the `me-get` function. Body `strictObject({ upTo: iso datetime })`. Sets the marker to `upTo` if later
than the current one; `upTo` later than now is clamped to now. Returns `{ unreadCount }`. 400 `VALIDATION_FAILED`.

## GET /squad/feed/{id}/reactions

Served by the `squad-feed-get` function. `id` = `<author>~<eventId>` URL-encoded (same as the toggle routes).

```ts
ReactorsSchema = strictObject({
  fire:   strictObject({ members: array(SquadMemberSchema), others: int ≥ 0 }),
  muscle: …same,
  crown:  …same,
})
```

- Members in each type: the viewer first (`isYou`), then in reaction order. Hidden reactors (not the viewer) only add to `others`.
- 404 `NOT_FOUND` when the author is missing, hidden from the caller or the id is malformed. A day with no target item yet returns all-empty lists.

## Logging

None of these handlers log ids, names, types or bodies; errors log only `err.name`.
