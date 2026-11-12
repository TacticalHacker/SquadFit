# Quickstart: Gym Set Logger

Validation guide. Shapes are in [contracts/api.md](contracts/api.md) and [data-model.md](data-model.md).

## Prerequisites

- A signed-in member with a completed profile (feature 001), e.g. created with `pnpm admin create-user`.
- `pnpm install`; for the API: AWS creds and `pnpm deploy:dev`; web: `pnpm dev` with `API_URL` pointing at the dev stage.
- A phone on the same LAN (dev allows LAN origins) or browser devtools in iPhone SE (375 × 667) emulation. Real-device checks for zoom and keyboard need an actual iPhone in Safari.

## 1. Automated checks

```sh
pnpm check     # typecheck + lint + test
pnpm synth     # infra: 6 new routes synthesize; stack test asserts gsi1 read grant on gym-get
```

Must include tests for (constitution III): `gymTotals` worked examples (research R3), `topSet` (R6), `drawerReducer` bounds / clone-last-row / default-reps-only-unedited (R7), `buildDayView` splitting gym entries and summing both (R12), `parseWeight`/`parseReps`, draft schema + prune; handler tests with fakes for every route incl. DAY_LOCKED, 404 on `gx-` via 002 routes, extra keys rejected, and the AI history output (R13).

## 2. Log an exercise (US1, SC-003, SC-004)

1. `/workouts` → tap **Gym**. Pills show Chest…Cardio; Chest selected.
2. Tap **Bench Press** → drawer slides up: 3 rows × 10 reps × 0 kg, no "Last" line.
3. Set each row to 60 kg (tap row #1 weight, type `60`; `+`/`−` move by 2.5). Footer: **1,800 kg · ~8 min · ~45 kcal**.
4. Tick all three, **Save**. List shows `3 sets · 1,800 kg`. Day summary +8 min / +45 kcal.
5. `/workouts` → Bench Press in "Logged today"; Strength training card says `Logged in Gym: 8 min`.
6. `/food` → `burned` increased by 45.

## 3. Controls (US2)

New exercise; set row #3 to 80 × 8; Sets **+** → row #4 is 80 × 8; Default Reps → 12: rows #1, #2 = 12; #3, #4 stay 8. Sets **−** to 1 then **−** again: stays 1. Type `62.3` in weight → error, value reverts; `62,5` → 62.5.

## 4. Last time (US4)

Log Barbell Squat yesterday as 3 × 80 × 8. Today open it: rows pre-filled 80 × 8, none ticked, header `Last: 80kg × 8`.

## 5. Drafts (FR-023)

Open Deadlift, change a weight, tick a set, swipe the drawer down → list shows `Draft`. Lock the phone / reload → reopen Deadlift: values restored. **Discard draft** → back to pre-fill.

## 6. Search, custom, read-only

- Type `curl` → Barbell Curl, Hammer Curl, Hamstring Curl.
- **+ Custom Exercise** "Hip Thrust" / Legs → appears under Legs; adding "bench press" → "You already have an exercise with that name".
- Go back 3 days → drawer read-only, no Save/Remove.

## 7. Mobile ergonomics (SC-005)

On a 375 px-wide iPhone in Safari: focusing any number field does not zoom; the page never scrolls sideways; pills swipe without a scrollbar; with the keyboard open the Save button stays reachable; 20 sets → body scrolls, header/footer fixed, drawer ≤ 85% of height.

## 7b. Timed checks (SC-001, SC-002, SC-006)

- SC-001: with Barbell Squat pre-filled from yesterday, start a timer, open it, tick 3 sets, Save: < 15 s, one thumb.
- SC-002: from the Gym tab, any built-in exercise drawer opens in ≤ 3 taps (pill → exercise; or search → result).
- SC-006: Save shows the updated badge and totals in < 1 s (devtools network: PUT round trip).

## 8. AI history (FR-024)

```sh
curl -s -X POST "$API_URL/mcp" -H "authorization: Bearer $SFK" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_user_history","arguments":{"startDate":"<today>","endDate":"<today>"}}}'
```

Today's Bench Press item has `kind: "gym"`, `muscleGroup: "chest"`, 3 `sets`, `volumeKg: 1800`.
