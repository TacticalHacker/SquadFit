# Data Model: Bodyweight Tracker (014)

Single table (`pk`/`sk`). New item type plus one changed attribute rule.

## Weight entry (new)

| Attribute | Value |
|---|---|
| `pk` | `USER#<sub>` |
| `sk` | `WEIGHT#<date>#<entryId>` |
| `userId` | `<sub>` |
| `entryId` | `<yyyyMMddTHHmmssSSSZ>-<6 base36>` (save time, UTC, plus random suffix; `WEIGHT_ID_PATTERN`) |
| `date` | member's local date `YYYY-MM-DD` at save (or the chosen day in the edit window) |
| `weightKg` | number, 20–400, 1 decimal |
| `recordedAt` | ISO instant of the save (server clock) |

- No GSI. Never overwritten (put with `attribute_not_exists(sk)`), only created and deleted.
- Max 10 per `(userId, date)` (checked before put, not atomic; research R6).
- Ordering: `sk` ascending = date, then save time. **Latest entry** = `Query begins_with(sk,"WEIGHT#")`, descending, `Limit 1`.

### Access patterns

| Need | Operation |
|---|---|
| Range read (W/M with 6 days lead-in, 6M, Y) | `Query pk = USER#<sub> AND sk BETWEEN WEIGHT#<from> AND WEIGHT#<to>#~` (paged) |
| Latest entry | `Query pk, begins_with(sk, WEIGHT#)`, `ScanIndexForward=false`, `Limit=1` |
| Day count (limit) | `Query pk, begins_with(sk, WEIGHT#<date>#)`, `Select=COUNT` |
| Create | `Put` with `attribute_not_exists(sk)` |
| Delete | `Delete pk, WEIGHT#<date>#<entryId>` (idempotent) |

## Profile (`USER#<sub>` / `PROFILE`), changed rule

- `bodyWeightKg` (feature 007) now **follows the latest weight entry** whenever one exists. It's set by `ProfileRepo.setBodyWeight` after each weight create/delete (research R2).
- `PUT /me/profile` with a different number records an entry for today instead of writing the attribute directly. `null` is ignored when entries exist.
- Untouched readers (treadmill calories, MCP `get_full_context`, squad e1RM ratio) keep reading `bodyWeightKg`.

## Derived: `WeightView` (not stored)

Built by `buildWeightView({ range, today, entries, profileWeightKg })` in `domain/bodyweight.ts`.

```
WeightView {
  range: "W" | "M" | "6M" | "Y"
  start, end: date                          // window, end = today
  summary: { average, min, max } | null     // average of day averages; null when empty
  slots: Slot[]                             // 7 | 30 | 26 | 12, oldest first
  latest: { date, weightKg, recordedAt } | null   // over ALL history, not just the window
  profileWeightKg: number | null
  editableDays: { date, entries: Entry[] }[] // today, −1, −2; entries newest first
}
Slot { start, end, count, min|null, max|null, average|null, trend|null }  // trend only in W/M
Entry { id, date, recordedAt, weightKg }
```

### Rules (test-first)

- Day average = mean(entries of that day). Slot average = mean(day averages in slot). Slot min/max over raw entries.
- `W`: 7 daily slots `today−6..today`. `M`: 30 daily slots `today−29..today`.
- `6M`: 26 weekly slots; first = `weekStart(today) − 25 weeks`; last slot `end` = today.
- `Y`: 12 monthly slots; first = 1st of (current month − 11); last slot `end` = today.
- `trend` (W/M): mean of day averages for data days in `[slot.start − 6, slot.start]`; null if none.
- All outputs rounded to 1 decimal; internal math unrounded.

Worked example (`M`, today 2026-11-24): entries 11-20 78.0 & 78.6, 11-22 77.9, 11-24 78.3. Then day averages are 78.3, 77.9, 78.3; summary average = 78.17 → **78.2**; min 77.9, max 78.6. Slot 11-20 is a range bar 78.0–78.6 (avg 78.3). Trend on 11-24 = mean(78.3, 77.9, 78.3) = **78.2**. Axis: lo = floor(76.9) = 76, top = ceil(79.6) = 80; span 4; step 2 (4/1 = 4 > 3, 4/2 = 2 ≤ 3) → gridlines 76, 78, 80.
