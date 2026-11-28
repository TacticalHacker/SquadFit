# Research: Reaction Notifications (022)

## R1. Where notifications are written

- **Decision**: In `toggleReaction` (`lib/reaction.ts`), right after `addReaction` / `removeReaction` succeeds, call `safeNotify` which updates the owner's `NOTIF#<eventId>#<reactor>` item. Best effort: errors are swallowed and only the error name is logged.
- **Rationale**: one write path for reactions already exists (feed items and workout days). Putting it inside the reaction transaction would make the reaction fail if the notification write fails, for no user benefit.
- **Alternatives**: DynamoDB Streams → Lambda (new function + resources; stack is near the limit); computing notifications on read from `RX#` items (would need a query per owned feed item, and no "seen" bookkeeping per reactor).

## R2. One item per (item, reactor) with a string set of types

- **Decision**: `ADD types :t SET latestAt, firstAt = if_not_exists(...), ttl` on add; `DELETE types :t` on remove, then a conditional delete when `attribute_not_exists(types)` (DynamoDB drops an empty set).
- **Rationale**: matches FR-001/FR-002 and the "Asha reacted 🔥💪" row; idempotent under retries.

## R3. Unread count on every page

- **Decision**: `GET /me` returns `unreadNotifications`. The read marker is its own item `USER#<sub>/NOTIFSEEN`, so one `begins_with(sk, "NOTIF")` query returns both the notifications and the marker. It runs in parallel with the profile read. Projection keeps it small.
- **Rationale**: the header already calls `getMe()` (memoised per request), so no extra web → API round trip. Squad is small, so items per member are few.
- **Alternatives**: a stored counter (drifts under toggles and deletes); a separate endpoint (extra round trip on every page).

## R4. Marking as read

- **Decision**: `/notifications` is a Server Component that loads the list; a tiny client component calls a Server Action `markNotificationsSeen(upTo)` on mount with the newest `latestAt` shown, then `refresh()`es so the badge clears. The API sets `seenAt = :t` only if larger (`attribute_not_exists(seenAt) OR seenAt < :t`).
- **Rationale**: GET stays side-effect free (prefetch-safe); a notification arriving after the list was loaded stays unread.

## R5. Describing the item

- **Decision**: Described on read: `listNotifications` batch-gets the referenced feed items; missing items are dropped (FR-003 also deletes `NOTIF#<eventId>#` in `deleteFeed`). The view carries `kind`, `date`, and `exerciseName` / `week` / `club` like the feed; wording lives in `plain.ts`.
- **Rationale**: no duplicated payload to keep in sync (PR figures change when the feed diff updates them).

## R6. Opening the item

- **Decision**: `workout_day` → `/squad/<owner>#day-<date>` (day cards get `id="day-<date>"`); every other kind → `/squad/feed`.
- **Rationale**: most reacted days are recent and on the first timeline page; a dedicated single-day page is not needed for a small squad. If the day is older, the profile still opens.

## R7. Who reacted

- **Decision**: `GET /squad/feed/{id}/reactions` (same `<author>~<eventId>` id as the toggle routes) on the `squad-feed-get` function. Author must be visible to the caller (else 404, like the toggle). Reactors come from a query on `RX#<eventId>#`; grouping, ordering and the hidden rule are the pure `groupReactors`.
- **Hidden rule**: a reactor is named only if `visibleTo(reactorProfile, viewer)` (i.e. not hidden, or the viewer themself); otherwise counted in `others`. Same rule names the reactor in notifications (`reactor: null` → "Someone").

## R8. Resource budget

- **Decision**: three routes on existing functions (`me-get`: 2, `squad-feed-get`: 1) sharing one `HttpLambdaIntegration` per function. `me-get` becomes `write: true` (for the seen marker). Synth check: stays below 500.

## R9. Retention

- **Decision**: `ttl` = latestAt + 30 days on each notification; list filters expired items (TTL deletes lazily) and shows the newest 50.
