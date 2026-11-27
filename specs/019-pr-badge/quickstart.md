# Quickstart: Live PR Badge (019)

## Automated

```sh
pnpm check   # typecheck + lint + test
```

Must cover (lean, per constitution III):

- `packages/shared/test/pr.test.ts`: the spec's acceptance table against bests `{ sessions: 1, bestWeight: 80×8, bestE1rm: 101.3, frontier: [80×8] }`: 82.5×5 → weight +2.5; 80×10 → reps +2; 77.5×12 → reps +4; 60×15 → null; 80×8 → null; 125×3 → weight +45 + big jump; 110×3 → weight +30, no big jump; `sessions: 0` → null; 0 kg × 12 → null; two PR sets → top one. Plus `bestsBefore` for today / a past day with no entry / a locked day (null), and the frontier merge.
- `packages/shared/test/squad.test.ts`: a Rep PR day posts a `pr` event with `type: "reps"`; a held big jump creates no record until `jumpConfirmedAt`; editing the earlier day heavier removes a later PR; `prBase.before[date]` excludes that day.
- `services/api` handler test: `PUT /workouts/gym/entries/...` returns `prs: 1` for 82.5×5 after an 80×8 day; `GET /workouts/gym` carries `bests` for that exercise and `null` for cardio.

## Manual (dev stack)

Prereqs: `pnpm deploy:dev`, then `AWS_PROFILE=macmini-raj pnpm admin squad backfill`, then `pnpm dev`. Sign in as a test member with Bench Press 80 kg × 8 logged two days ago.

1. Open Gym → Bench Press. Step a set to 82.5 × 5: the pill "★ New PR · 82.5 kg (+2.5 kg)" and a ★ on that row appear at once. In DevTools → Network, nothing fires.
2. Step back to 80 kg: the pill fades to the normal line.
3. Enter 125 × 3: badge + "Big jump — typo?". Save: the toast shows no PR. Reopen: "Unusual jump" + **Looks right**. Tap it: the feed shows the PR.
4. Change the set to 80 × 10, tick it, Save: the toast leads "★ 1 PR"; `/squad/feed` shows "Bench Press 80 kg × 10 (+2 reps)".
5. Open an exercise never logged: "Baseline set · … kg volume" in muted text.
6. Reduced motion on (OS setting): the pill only fades. VoiceOver/TalkBack: one announcement per new PR.
7. Phones: Android Chrome gives a double buzz; iPhone Safari (iOS 18+) one tick; older iOS nothing, no error.
