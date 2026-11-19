# Quickstart: Squad v2

## Automated

```sh
pnpm check   # typecheck + lint + tests
```

Must include (lean, constitution III):

- `packages/shared/test/boards.test.ts`: entries on 30 Nov and 1 Dec → on 1 Dec `workouts`/`volume` count December only, `streak` unchanged; PR jump compares to earlier months only, a lift first logged this month gives none, % ranking can differ from kg; Big 3 member missing deadlift is unranked with `missing: ["Deadlift"]`.
- `packages/shared/test/squad.test.ts` (extend): badge earned once with the crossing date; rebuild twice → same events; edit below threshold → badge gone.
- `services/api/test/squad-reactions.test.ts`: toggle 🔥 on/off, counts, own item refused, `day#` lazily created; migration converts 3 high-fives to 💪 3 and a second run changes nothing.
- `services/api/test/squad-boards.test.ts`: hidden member absent; unconfirmed member absent from `protein`; another member's day card has `calorieTarget: null` until confirmed.

## Deploy (dev)

```sh
AWS_PROFILE=macmini-raj pnpm deploy:dev
AWS_PROFILE=macmini-raj pnpm admin squad migrate-reactions --stage dev   # right after deploy (old high-fives show 0 until then)
AWS_PROFILE=macmini-raj pnpm admin squad backfill --stage dev            # months, month bests, badges; no feed items
AWS_PROFILE=macmini-raj pnpm admin squad timezone Asia/Kolkata --stage dev   # optional; this is the default
```

## Manual check (`pnpm dev`, phone width 390 px and desktop 1280 px)

1. `/squad`: title, one-time cards, 5 feed lines + "See all" + "See today's workouts →", one segmented control, board cards. No date picker, period row, tab row or paragraph.
2. Each card: ≤ 3 rows + "You · #N · …" when you are 4th or lower; (i) opens one sentence; tap → `/squad/boards/<id>`; tap a name → profile.
3. PR jump list: "kg | %" switch re-ranks; Current strength list: "Big 3 | Big 4" switch; missing members muted at the bottom.
4. Hall of Fame: every record shows holder, value with unit, date or month, or "No record yet".
5. Reactions on a feed item and on a day card toggle and count.
6. As an unconfirmed member: prompt on Squad and Food; another member sees your totals with no goals; confirm → goals appear and you can rank on Protein days.
7. Search the rendered pages for "e1RM", "adj." and "0-week": none.
8. Screenshots of `/squad` before (taken on the 012 build) and after, mobile and desktop.
