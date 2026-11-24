# Tasks: Bodyweight Tracker (014)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md)

**Tests**: Lean (constitution III).
- Domain tests are written first and must fail before they're implemented.
- Handler tests cover only: edit window, the daily limit, owner-only delete, and the latest-entry profile sync (including a backfill).
- No UI, copy or schema-limit tests.

## Phase 1: Setup

- [X] T001 Add `WEIGHT_ID_PATTERN = /^\d{8}T\d{9}Z-[0-9a-z]{6}$/`, `newWeightEntryId(now: Date)` (`yyyyMMddTHHmmssSSSZ` UTC + "-" + 6 random base36) and constants `WEIGHT_MAX_PER_DAY = 10`, `WEIGHT_STEP_KG = 0.1`, `WEIGHT_TREND_DAYS = 7` in packages/shared/src/domain/bodyweight.ts (file created here; functions land in T003)

## Phase 2: Foundational (blocks all stories)

- [X] T002 [P] Write failing tests in packages/shared/test/bodyweight.test.ts, covering:
  - `rangeWindow`: W = 7 daily slots `today−6..today`; M = 30; 6M = 26 Mon–Sun weeks with the first = `weekStart(today)` − 25 weeks and the last `end` = today; Y = 12 calendar months, last `end` = today; `fetchFrom` = start − 6 for W/M.
  - `buildWeightView`: the worked example in data-model.md gives summary average **78.2**, min 77.9, max 78.6; slot 11‑20 min 78.0 / max 78.6 / avg 78.3 / count 2; trend on 11‑24 = **78.2**; an empty window gives `summary: null`.
  - A 6M slot whose average is the mean of day averages, not of raw entries.
  - `weightAxis(76.2, 79.8)` → lo ≤ 75.2, hi ≥ 80.8, 3–4 gridlines; `weightAxis(78, 78)` → [77, 79], 3 lines.
  - `latestEntry`: a backfill for yesterday saved after today's entry is not latest.
  - `nearestSlot` skips empty slots.
  - `stepWeightKg(78.4, +1)` = 78.5, clamped to 20–400.
- [X] T003 Implement `rangeWindow`, `buildWeightView`, `weightAxis` (steps `[0.5, 1, 2, 5, 10, 20, 50]`; snap lo/hi outward per step, first with ≤ 3 intervals after snapping), `nearestSlot`, `latestEntry`, `stepWeightKg`, `round1` in packages/shared/src/domain/bodyweight.ts.
  - Day avg = mean of entries; slot avg = mean of day averages; min/max over raw entries; trend = mean of day averages of data days in `[d−6, d]`, W/M only.
  - Round to 1 decimal only in the output.
  - Use `addDays`, `weekStart` and `DEFAULT_BODY_WEIGHT_KG`.
- [X] T004 [P] Add zod schemas in packages/shared/src/contracts/weight.ts and export them plus the domain module from packages/shared/src/index.ts:
  - `WeightRangeSchema` (`"W"|"M"|"6M"|"Y"`, default `"M"`).
  - `WeightEntrySchema` `{ id, date, recordedAt, weightKg }`.
  - `WeightSlotSchema` `{ start, end, count, min, max, average, trend }` (numbers nullable).
  - `WeightViewSchema` `{ range, start, end, summary|null, slots, latest|null, profileWeightKg|null, editableDays: { date, entries }[] }`.
  - `WeightLogInputSchema` `{ weightKg: BodyWeightSchema /* 20–400, 1 decimal */, date?: DateSchema }`.
  - All object schemas `.strict()`.
- [X] T005 [P] Implement `WeightRepo` / `DynamoWeightRepo` in services/api/src/lib/weight-repo.ts, keys `pk = USER#<sub>`, `sk = WEIGHT#<date>#<entryId>`:
  - `create` (Put with `attribute_not_exists(sk)`).
  - `delete` (idempotent).
  - `listRange(from, to)` (paged Query `BETWEEN WEIGHT#<from> AND WEIGHT#<to>#~`).
  - `latest()` (`begins_with WEIGHT#`, `ScanIndexForward=false`, `Limit=1`).
  - `countDay(date)` (`Select=COUNT`).
- [X] T006 Add `setBodyWeight(userId, kg, nowIso)` (`SET bodyWeightKg, updatedAt`) to services/api/src/lib/profile-repo.ts. Wire `weights: WeightRepo` into services/api/src/lib/deps.ts and add the in-memory `weights` repo + `setBodyWeight` to services/api/test/fakes.ts.
- [X] T007 Implement services/api/src/lib/weight-write.ts:
  - `loadWeightView(userId, ctx, range, deps)`: `rangeWindow` → `listRange(fetchFrom, today)` + `latest()` + profile weight → `buildWeightView`, with `editableDays` = today, −1, −2, entries newest first.
  - `syncProfileWeight(userId, deps)`: `latest()` → `setBodyWeight`; if none, leave the profile. Best effort, logs the error name only.
  - `logWeight(caller, input, range, deps)`: `loadDayContext` → `resolveWriteDate(date ?? today)` → `countDay ≥ 10` → 409 `DAY_FULL` "You can log up to 10 weigh-ins a day" → `create({ entryId: newWeightEntryId(now), date, weightKg, recordedAt })` → sync → view.
  - `deleteWeight(caller, date, entryId, range, deps)`: `resolveWriteDate` (409 `DAY_LOCKED`) → delete only if `WEIGHT_ID_PATTERN` matches → sync → view.
  - Never log values.

## Phase 3: US1 Log today's weight (P1) 🎯 MVP

**Independent test**: open the sheet, change the pre-filled value, save, reopen. It pre-fills the saved value and the card's latest changed.

- [X] T008 [US1] Write tests in services/api/test/weight.test.ts:
  - POST stores an entry for today in the member's timezone and sets the profile `bodyWeightKg`.
  - A second POST the same day keeps both entries.
  - A backfill for yesterday (saved later) leaves the profile at today's weight.
  - A date older than today − 2 → 409 `DAY_LOCKED`.
  - The 11th entry in a day → 409 `DAY_FULL`.
- [X] T009 [US1] Implement `POST /me/weight?range=` (parse `WeightLogInputSchema` and `WeightRangeSchema`, call `logWeight`, return `WeightView`) in services/api/src/handlers/weight-post.ts and `GET /me/weight?range=` in services/api/src/handlers/weight-get.ts, both thin `handle(event, deps)` + `handler`.
- [X] T010 [US1] Add routes in infra/lib/api-stack.ts and assert them in infra/test/stacks.test.ts:
  - `route("weight-get", HttpMethod.GET, "/me/weight")`
  - `route("weight-post", HttpMethod.POST, "/me/weight", { write: true })`
- [X] T011 [US1] Change services/api/src/handlers/me-profile-put.ts:
  - Read the stored profile first.
  - If the submitted `bodyWeightKg` is a number different from the stored one, upsert without it, then `logWeight` for today; when the member has entries, ignore `null`.
  - If that entry is refused with `DAY_FULL`, keep the profile save and return 409 `DAY_FULL` (the form shows the daily-limit message).
  - Add one test to services/api/test/weight.test.ts: a changed Settings weight creates an entry, and an unchanged one creates none. Update the changed assertion in services/api/test/me-profile-put.test.ts if it breaks.
- [X] T012 [P] [US1] Add weight wording to apps/web/src/lib/plain.ts:
  - Labels: "Bodyweight", "Log weight", "No weigh-ins yet", "No weigh-ins in this period", "AVERAGE", "RANGE", "WEIGHT", "7-day trend".
  - Formatters: `formatKg(78.4)` → "78.4 kg", `formatKgRange`, `formatWeightSpan(start, end, range)`.
- [X] T013 [US1] Add Server Actions `loadWeightView(range)`, `logWeight(range, { weightKg, date })` and `deleteWeight(range, date, entryId)` in apps/web/src/server/actions/weight.ts:
  - Call `apiFetch` with `WeightViewSchema`.
  - Return `{ ok: true, view } | { ok: false, message }`; map 409 `DAY_FULL`/`DAY_LOCKED` and 400 to plain messages.
  - Accept "78,6" by replacing the comma.
- [X] T014 [US1] Build apps/web/src/components/weight-sheet.tsx:
  - `BottomSheet` + `SheetClose` header "Log weight".
  - Day chips (`chipClass`) for `view.editableDays`: Today, Yesterday, weekday.
  - Minus/Plus `iconButtonClass` steppers via `stepWeightKg`.
  - Input `inputMode="decimal"` with `inputClass`, pre-filled with `latest.weightKg ?? profileWeightKg ?? 75`, shown with 1 decimal.
  - One `buttonClass` Save (accent fill); errors with `noticeWarnClass`.
- [X] T015 [US1] Build apps/web/src/components/bodyweight-card.tsx (client, `cardClass`):
  - Heading "Bodyweight", latest value + date (or "No weigh-ins yet") and a "Log weight" `secondaryButtonClass` button that opens the sheet.
  - Holds `view` state and replaces it with the view returned by save/delete.
  - Render it in its own `<Suspense>` right below the ledger (new `afterLedger` slot on `FoodScreen`, analysis F1) in apps/web/src/app/(app)/food/page.tsx, seeded by `apiFetch("/me/weight?range=M", { schema: WeightViewSchema })`.

## Phase 4: US2 Apple Health-style chart (P1)

**Independent test**: seed a year of logs. Each range shows 7/30/26/12 slots, the header figures match the hand calculation, and scrubbing snaps to data slots.

- [X] T016 [P] [US2] Add apps/web/src/lib/weight-trend-pref.ts:
  - `sf:weighttrend:v1` read/write wrapped in try/catch.
  - `useWeightTrend()` via `useSyncExternalStore`, default false (pattern of `lib/gym-draft.ts`).
- [X] T017 [US2] Build apps/web/src/components/weight-chart.tsx (client):
  - **Controls and header**:
    - W|M|6M|Y `segmentClass` control (`aria-pressed`), switching via `loadWeightView` in `useTransition`, keeping the old chart while it loads.
    - Header in an `aria-live="polite"` region: label (AVERAGE for W/M, RANGE for 6M/Y; while scrubbing, WEIGHT for a single entry, AVERAGE for a multi-entry day, RANGE for a week/month) and value in `text-ink`, date span in `text-muted`.
  - **Plot**:
    - Inline SVG sized by `ResizeObserver`, using `weightAxis` for 3–4 dashed gridlines (`stroke-line`, `stroke-dasharray="2 3"`) and right-aligned `fill-faint` labels.
    - W/M: `fill-accent` dots r 3.5 for count 1, a subtle `stroke-ink-2` 40% polyline between consecutive data days, capsules for count > 1, and the trend polyline `stroke-ink-2` when toggled.
    - 6M/Y: capsule `<rect rx=w/2>` in `fill-accent` from min to max, or a dot when min = max.
  - **Scrubbing**: `onPointerDown/Move/Up` with `setPointerCapture`, `touch-action: pan-y`, `nearestSlot` → `stroke-ink` crosshair, active mark full opacity, others 40%.
  - **States and accessibility**: empty state "No weigh-ins in this period"; `role="img"` + `aria-label` summary; trend chip (`chipClass`) only in W/M.
  - Mount it inside bodyweight-card.tsx.

## Phase 5: US3 Fix a mistaken entry (P2)

**Independent test**: log two entries, delete one. The chart, header and latest reflect only the remaining one.

- [X] T018 [US3] Add to services/api/test/weight.test.ts:
  - Deleting the latest entry re-syncs the profile to the next latest; deleting the last remaining entry leaves the profile unchanged.
  - Deleting another member's entry id does nothing to it (owner `pk` only).
  - Delete outside the window → 409 `DAY_LOCKED`.
- [X] T019 [US3] Implement `DELETE /me/weight/{date}/{entryId}?range=` in services/api/src/handlers/weight-delete.ts and add `route("weight-delete", HttpMethod.DELETE, "/me/weight/{date}/{entryId}", { write: true })` in infra/lib/api-stack.ts (+ assertion in infra/test/stacks.test.ts).
- [X] T020 [US3] In apps/web/src/components/weight-sheet.tsx, list the selected day's entries (time in the member's timezone + `formatKg`, newest first) with a `Trash2` `iconButtonClass` button per row (`aria-label="Delete 78.4 kg at 07:10"`) calling `deleteWeight`, and update the card's view.

## Phase 6: Polish

- [X] T021 [P] Add a "Bodyweight (feature 014)" section to CLAUDE.md:
  - Routes and keys; latest = date then save time.
  - Profile `bodyWeightKg` follows the latest entry; Settings change → entry for today.
  - `domain/bodyweight.ts` is the only chart math.
  - Never log weights; never in squad/public/MCP/share views.
- [X] T022 Privacy check: confirm by grep that no file under services/api/src/handlers/squad-*, public-*, me-share-get.ts or lib/mcp reads `weights` / `WEIGHT#`, and that `WeightView` is only returned by the three weight handlers.
- [ ] T023 Run `pnpm check` and `pnpm synth`; walk through quickstart.md steps 2–8 on dev.

## Dependencies

- T001 → T002 → T003. T004, T005 can run in parallel with T002/T003. T006 depends on T005; T007 depends on T003, T004 and T006.
- US1 (T008–T015) depends on Phase 2. US2 (T016–T017) depends on T015 (card host) and T013 (`loadWeightView`). US3 (T018–T020) depends on T007 and T014.
- Polish last.

## Parallel examples

- Phase 2: T002 (domain tests) ‖ T004 (contracts) ‖ T005 (repo).
- US1: T012 (wording) ‖ T009/T010 (API + route) once T008 is written.
- US2: T016 (pref hook) ‖ start of T017.

## Implementation strategy

MVP = Phases 1–3: logging with a latest-weight card, no chart. US2 then adds the chart (the main visual value), and US3 adds deletion in the sheet. Every phase ends with `pnpm check` green.
