# Quickstart: Squad Leaderboard

Validation guide. Shapes are in [contracts/api.md](contracts/api.md) and [contracts/web.md](contracts/web.md); storage and derivation rules in [data-model.md](data-model.md); decisions in [research.md](research.md).

## Prerequisites

- At least two members with completed profiles (`pnpm admin create-user`), ideally in different timezones (e.g. Asia/Kolkata and Europe/London).
- `pnpm install`, `pnpm deploy:dev` (AWS creds), `pnpm dev` with `API_URL` pointing at dev.
- A phone or devtools at 320 × 640 for layout checks.

## 1. Automated checks

```sh
pnpm check
pnpm synth     # 6 new routes; all require the Cognito authorizer
```

Lean, failing-first tests (constitution III), one per behaviour:

| Test | File |
|---|---|
| Weekly streak across a timezone boundary (Sunday 23:30 UTC = Monday in Asia/Kolkata → new week) | `packages/shared/test/week.test.ts` |
| A missed ended week resets the current streak; best keeps the old run | `packages/shared/test/squad.test.ts` |
| An unfinished current week does not break the streak | `packages/shared/test/squad.test.ts` |
| First log of an exercise is a baseline, not a PR | `packages/shared/test/squad.test.ts` |
| e1RM only for 1–10 reps (11 reps → null, still counts for heaviest) | `packages/shared/test/squad.test.ts` |
| Jump rule: 80 → 125 flagged; 20 → 32.5 not; confirmed and trusted entries count | `packages/shared/test/squad.test.ts` |
| Ties share a rank (1, 1, 3) | `packages/shared/test/squad.test.ts` |
| Hidden member absent from another viewer's boards and feed; visible to themselves unranked | `services/api/test/squad-leaderboard.test.ts` |
| Leaderboard/feed routes reject callers without a profile; responses carry no body weight | `services/api/test/squad-leaderboard.test.ts` |
| `upsert_workout_log` via MCP refreshes stats (PR appears) | `services/api/test/mcp-upserts.test.ts` (one case added) |
| CDK: the 6 squad routes have the authorizer | `infra/test/stacks.test.ts` |

## 2. Backfill (FR-031, SC-005)

```sh
pnpm admin squad backfill     # prints "members: N, stats written: N, feed items: 0"
pnpm admin squad backfill     # second run: same counts, still no feed items
```

Open `/squad`: streaks and best lifts match a hand count of each member's history; the Activity feed is empty; no "Unusual jump" note appears on any old entry.

## 3. Streaks (Story 1)

With weekly target 3: log gym or activity entries on 3 different days this week (inside the edit window, so use today−2..today). The Streaks row shows "this week 3/3" and the current streak goes up by one; a "completed week N" feed item appears. Delete one of those entries: the count drops to 2/3, the streak goes back, the feed item disappears.

## 4. PRs and the jump rule (Stories 2–3)

1. A member logs a new exercise for the first time: no PR row, no feed item.
2. Next allowed day, a heavier completed set: PRs board "This week" shows 1, expanding lists the lift; feed shows "… hit a … PR".
3. Log a set more than 50% and more than 20 kg above the best: no PR; the gym drawer shows "Unusual jump" with **Looks right**. Tap it: the PR appears.
4. Log an unchecked (not completed) heavy set: ignored.

## 5. Privacy (Story 7, SC-004)

1. Member A turns off "Show me on the squad leaderboard". As B: A is on no board and none of A's feed items show. As A: page opens, the hidden notice shows, A's own rows are unranked.
2. Member A shares body weight; B does not. Lifts → Relative: A shows "1.xx×", B shows "—" below the ranked rows. Inspect the network/API response: no `bodyWeightKg` anywhere.
3. Signed out, open `/squad`: redirected to sign-in. `curl <api>/squad/leaderboard` without a token: 401.

## 6. Feed reactions (Story 4)

As B, high-five A's item: count 1, button pressed. Reload: still 1. Tap again: 0. Send the PUT twice via the API: count stays 1.

## 7. AI agent parity

Through MCP `upsert_workout_log`, log a heavier set for today: the PR shows on the board and feed exactly as if logged in the app. `get_full_context.streak` returns the weekly object.

## 8. Layout

At 320 px: no horizontal scroll on any tab; names truncate; figures stay right-aligned and readable. Own row highlighted. Workouts screen shows "N-week streak · d/t".
