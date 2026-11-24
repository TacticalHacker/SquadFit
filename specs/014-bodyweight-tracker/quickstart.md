# Quickstart: Bodyweight Tracker (014)

## Automated

```sh
pnpm check   # includes bodyweight.test.ts (domain) and weight handler tests
pnpm synth   # new routes: weight-get, weight-post, weight-delete
```

Expected domain coverage (lean, constitution III): `buildWeightView` matches the worked example in [data-model.md](data-model.md); 6M/Y bucket boundaries; `trend` uses the lead-in days; `weightAxis` gives 3–4 lines; `latestEntry` orders by date, then time (backfill case).
Handler coverage: create syncs the profile; a backfill doesn't replace today's weight; `DAY_LOCKED`; `DAY_FULL`; delete of the latest entry re-syncs.

## Manual (dev)

1. `pnpm deploy:dev && pnpm dev`, sign in, open `/food`.
2. **Log (US1)**: the Bodyweight card shows "No weigh-ins yet". Tap **Log weight**. The sheet pre-fills your Settings body weight (or 75.0). Tap +0.1 ×2 and −0.1 ×1, then Save. The card shows the latest value and the M chart shows one dot. Settings → body weight shows the same value.
3. **Backfill**: open the sheet, pick yesterday, enter a weight 1 kg heavier and save. The latest weight and the Settings value stay at today's entry.
4. **Multi-entry day**: log a second weight today. In M, today becomes a capsule from low to high, and the sheet lists both entries with times.
5. **Delete (US3)**: in the sheet, delete the newer entry. The capsule turns back into a dot, and the latest value and Settings follow the remaining entry.
6. **Chart (US2)**: switch W/M/6M/Y and check 7/30/26/12 slots, AVERAGE vs RANGE in the header and the date span. Drag across the chart: the crosshair snaps to data slots and the header updates. Release, and the summary returns. On a phone, a vertical swipe on the chart still scrolls the page.
7. **Trend**: turn on "7-day trend" in M. A grey line appears, and the setting survives a reload.
8. **Privacy**: open your squad profile and another member's profile; neither shows weight entries. `GET /squad/*` responses contain no `weight` fields.
