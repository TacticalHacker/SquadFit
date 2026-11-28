# Data Model: Reaction Notifications (022)

All items live in the single table, on the **owner's** partition (the member whose item was reacted to).

## Reaction notification

| Attribute | Value |
|---|---|
| `pk` | `USER#<ownerSub>` |
| `sk` | `NOTIF#<eventId>#<reactorSub>` (event ids contain `#`; reactor subs never do, so split on the last `#`) |
| `eventId` | the feed event id (`day#<date>`, `pr#<exerciseId>#<date>`, `wk#<weekStart>`, `badge#<club>`, `first`, `protein7#<date>`, `steps7#<date>`) |
| `reactorId` | reactor sub |
| `types` | String Set ⊆ {fire, muscle, crown}; removed by DynamoDB when it becomes empty |
| `firstAt` | ISO time of the first reaction (kept) |
| `latestAt` | ISO time of the latest added reaction |
| `ttl` | epoch seconds, `latestAt` + 30 days |

- Add: `ADD types :t SET reactorId, eventId, latestAt = :now, firstAt = if_not_exists(firstAt, :now), ttl`.
- Remove: `DELETE types :t` returning `ALL_NEW`; if `types` is absent, delete the item conditional on `attribute_not_exists(types)`.
- Deleted with the feed item: `deleteFeed(owner, eventId)` also queries and deletes `NOTIF#<eventId>#`.
- Never written for the owner's own reactions (the toggle forbids them).

## Seen marker

| Attribute | Value |
|---|---|
| `pk` | `USER#<ownerSub>` |
| `sk` | `NOTIFSEEN` |
| `seenAt` | ISO time; only moves forward |

`begins_with(sk, "NOTIF")` returns the marker and every notification in one query.

## Derived (not stored)

- **Unread**: notification with `latestAt > seenAt` (or no marker) and not expired.
- **Notification view**: notification + feed item (kind, date, payload) + reactor profile (named only if visible to the owner).
- **Reactor list**: `RX#<eventId>#<type>#<reactor>` items (`createdAt`) grouped by type; viewer first, then by `createdAt`; hidden reactors counted in `others`.

## Read model types (`packages/shared/src/domain/notifications.ts`)

```ts
type StoredNotification = { eventId: string; reactorId: string; types: ReactionType[]; latestAt: string; ttl: number };
unreadCount(items, seenAt: string | null, nowSec: number): number
pickNotifications(items, nowSec, limit = 50): StoredNotification[]   // not expired, newest first
groupReactors(rx: { type; reactorId; createdAt }[], viewerId, isNamed: (id) => boolean): Record<ReactionType, { ids: string[]; others: number }>
```
