# Research: Bodyweight Tracker (014)

No `NEEDS CLARIFICATION` remained after the spec's clarification session. These are the design decisions.

## R1. Entry key: date first, then save time

- **Decision**: One item per entry, `pk = USER#<sub>`, `sk = WEIGHT#<date>#<entryId>`, where `entryId = <recordedAt compact UTC, yyyyMMddTHHmmssSSSZ>-<6 random base36>` (e.g. `20261124T071012345Z-k3x9qa`). Matching regex `WEIGHT_ID_PATTERN = /^\d{8}T\d{9}Z-[0-9a-z]{6}$/`.
- **Rationale**: Lexical `sk` order = local date, then save time. The latest entry (clarification 2) is then one `Query` with `begins_with(sk, "WEIGHT#")`, `ScanIndexForward: false`, `Limit: 1`. Insertion order never decides: a backfill for yesterday saved after today's entry sorts *before* today's. A range is one `BETWEEN WEIGHT#<from> AND WEIGHT#<to>#~` query. The id carries the time, so `DELETE /me/weight/{date}/{entryId}` addresses the item directly.
- **Alternatives**: `sk = WEIGHT#<recordedAt>` (sorts by insertion, so it breaks clarification 2); one item per day with an entries list (needs read-modify-write and conditional updates for a 10-item list; no gain); a GSI (not needed, the base table covers every read).

## R2. Profile body weight follows the latest entry

- **Decision**: `lib/weight-write.ts` is the one write path. After every create or delete it reads the latest entry (R1 query) and, if there is one, calls the new `ProfileRepo.setBodyWeight(userId, kg, nowIso)` (`SET bodyWeightKg, updatedAt`). If no entries remain, the profile is left alone (spec US3 #2). It's best effort: a failed sync is logged by error name only and retried on the next write. Because the sync re-reads instead of writing "this" value, two concurrent writes converge on the true latest.
- **Settings / setup** (`PUT /me/profile`): read the profile first. If the submitted `bodyWeightKg` is a number that differs from the stored one, record an entry for today through `weight-write` (which then sets the profile). The profile `upsert` no longer writes `bodyWeightKg` itself when the member has entries. A `null` (cleared field) is ignored when entries exist, otherwise it clears as before (feature 007). Saving the form unchanged creates no entry.
- **Alternatives**: deriving the body weight on every read (touches gym, MCP and squad-ratio paths; a much bigger change); a DynamoDB stream (new infra for one attribute).

## R3. One pure module for all chart math

- **Decision**: `packages/shared/src/domain/bodyweight.ts` holds `rangeWindow`, `buildWeightView`, `movingAverage`, `weightAxis` and `latestEntry`, all test-first (constitution III). The server builds the whole `WeightView`; the client only renders it and runs `weightAxis` / `nearestSlot` for drawing and scrubbing.
- **Rules**:
  - Day average = mean of that day's entries. Slot average = mean of the day averages inside the slot. Slot min/max are taken over the raw entries.
  - Ranges end on `today` (the member's timezone): `W` = days `today−6..today` (7 slots); `M` = `today−29..today` (30 slots); `6M` = 26 Mon–Sun weeks, the last one holding today (`weekStart` from `week.ts`), with the last slot's `end` clamped to today; `Y` = 12 calendar months ending in the current month, last slot clamped to today.
  - Summary: `average` = mean of all day averages in the window; `min`/`max` over its entries; `start`/`end` = window bounds. It is null when the window is empty.
  - Moving average (W, M only): for each visible day, the mean of the day averages on days in `[d−6, d]` that have data, or null if there are none. The read fetches 6 extra days before the window.
  - Rounding: figures are kept at full precision and rounded to 1 decimal only in the output.
- **Axis**: `lo = floor(min − 1)`, `hi = ceil(max + 1)`. Pick the smallest step in `[0.5, 1, 2, 5, 10, 20, 50]` with `ceil((hi − lo)/step) ≤ 3`, then snap `lo`/`hi` outward to that step. Gridlines run from `lo` to `hi` in steps, which gives 3–4 lines, labelled on the right.
- **Alternatives**: sending raw entries and bucketing in the browser (two places would compute averages; FR-007); a charting library (constitution VII; the chart is small, hand-written SVG).

## R4. Quick-log sheet and day entries in one response

- **Decision**: `WeightView` carries `editableDays` (today, −1, −2), each with its entries `{ id, date, recordedAt, weightKg }`, newest first. The sheet (clarification 1) lists the entries for its selected day from there, so it needs no extra request. Those dates are inside every range, so the view always holds them.
- **Pre-fill**: `latest.weightKg`, else `profileWeightKg`, else `DEFAULT_BODY_WEIGHT_KG` (75). Steppers ±0.1 round to 1 decimal and clamp to 20–400.
- **Writes return the view**: `POST /me/weight?range=` and `DELETE …?range=` return the fresh `WeightView` for the chart's current range, so the card updates with no second fetch and the numbers come from the server (FR-007). Range switching calls a Server Action `loadWeightView(range)`. The browser never calls the API (feature 001).

## R5. Chart rendering and scrubbing

- **Decision**: a client component `weight-chart.tsx` draws inline SVG with `viewBox` widths from `ResizeObserver`.
  - **Scrubbing**: `onPointerDown/Move/Up` with `setPointerCapture`, and `touch-action: pan-y` on the plot so vertical page scrolls still work while horizontal drags scrub. `nearestSlot(slots, x)` (pure, in `bodyweight.ts`) returns the closest slot *with data*.
  - **Marks**: dots `r=3.5` (`fill-accent`), connecting polyline `stroke-ink-2` at 1.25 px / 40% opacity between consecutive data days, and the trend polyline `stroke-ink-2` 1.75 px. Capsules are `<rect rx = w/2>` in `fill-accent`, widths `min(8, slotWidth*0.5)`. The active slot gets a `stroke-ink` 1 px crosshair, and the other marks are dimmed to 40%.
  - **Grid and labels**: dashed gridlines use `stroke-line` (`stroke-dasharray="2 3"`), and labels are `fill-faint`, `text-anchor="end"`.
- **Token mapping**: the request names `--text-primary`, `--text-secondary` and `--border-subtle`, which don't exist here. They map to `ink`, `ink-2` and `line`; `--accent`, `--accent-fill`, `--muted` and `--faint` exist as named.
- **Trend toggle**: a `chipClass` chip "7-day trend", stored per device at `sf:weighttrend:v1` and read via `useSyncExternalStore` (pattern from `gym-draft.ts`), wrapped in try/catch. The default is off.
- **Accessibility**: the header is real text in an `aria-live="polite"` region, and the SVG has `role="img"` plus an `aria-label` summary ("Average 78.3 kg, 25 Oct – 23 Nov 2026"). The segmented control is `segmentClass` buttons with `aria-pressed`.

## R6. Limits and validation

- `weightKg`: `BodyWeightSchema` (20–400, 1 decimal, existing). `date`: optional, default today; `resolveWriteDate` gives 400 for a bad or future date and 409 `DAY_LOCKED` outside the window. That's the same rule for delete.
- 10 entries per day: count with a `Query` on `WEIGHT#<date>#` before the put, then 409 `DAY_FULL` with "You can log up to 10 weigh-ins a day". The check isn't atomic, so a race could store 11. That's harmless; there's no money-like math behind it.
- `range`: enum `W|M|6M|Y`, default `M`.

## R7. Privacy

- Entries live only under the owner's `pk`. No squad, public, feed, share or MCP code reads `WEIGHT#`. `WeightView` is served only by `/me/weight` for the caller. The handler and write path log only error names.
