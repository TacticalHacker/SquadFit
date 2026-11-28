# Quickstart: Reaction Notifications (022)

## Automated

```sh
pnpm check        # typecheck + lint + tests (domain/notifications, handlers, stack resource count)
pnpm synth        # Api stack must stay under 500 resources
```

## Manual (dev, two accounts A and B)

1. Deploy: `pnpm deploy:dev`, then `pnpm dev`.
2. As **A**: tap the header avatar → your own profile opens.
3. As **B**: on `/squad/feed` (or A's profile), react 💪 and 🔥 to one of A's items.
4. As **A**: reload any page → bell shows **1**. Open it → one row "B reacted 🔥💪 to your …", marked unread. Reload → badge gone, row no longer marked.
5. Tap the row → workout day opens A's profile at that day; other kinds open the squad feed.
6. As **B**: remove both reactions. As **A**: the row is gone.
7. As anyone: tap the reaction counts on an item → sheet lists names per reaction; your own reaction shows as "You" first; on your own item the counts open the sheet too.
8. As **B**: Settings → hide from the leaderboard, react to A again (react on an item still visible to B). As **A**: row shows "Someone", and the sheet shows "+1 other" instead of B.
