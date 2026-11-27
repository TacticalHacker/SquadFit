# Quickstart: Squad Volume Raid (021)

## Automated

```sh
pnpm check   # domain tests (raid.test.ts) + API tests (raids.test.ts) + typecheck + lint
pnpm synth   # new routes synthesize
```

## By hand (dev stage, after `pnpm deploy:dev`)

1. Sign in as an admin (`pnpm admin admins add <you>`, sign in again). Squad tab shows "+ New raid".
2. Create "Leg Day Siege", **Start now**, end in 7 days, target 5,000 kg, Legs only. The card shows for a second member.
3. As the second member, save squats 80 kg × 8 × 3 (ticked). Toast: "+1,920 kg to raid". Card: 1,920 / 5,000 kg · 38%, "You: 1,920 kg (38%)".
4. Save bench: toast has no raid part; total unchanged.
5. Save squats 100 kg × 10 × 4 more: you hit the 2,000 kg cap → "· capped"; total counts 2,000 for you.
6. Edit the raid target to 1,000 kg below progress → inline refusal. Try changing the filter → locked.
7. Turn "Show me on the squad leaderboard" off for the second member: their avatar disappears from the first member's card; total unchanged.
8. Push the total past target with a third member: status won, stamp once (fade + haptic), sticker on profiles (`raidsCleared`).
9. Cancel a scheduled raid with a reason → "Raid cancelled · <reason>" for 1 day.

Expected outcomes are the spec's acceptance scenarios; see [contracts/raids.md](contracts/raids.md) and [data-model.md](data-model.md).
