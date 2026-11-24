# Feature Specification: Bodyweight Tracker

**Feature Branch**: `014-bodyweight-tracker`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Daily Bodyweight Tracker with an Apple Health-style chart. (1) Data model & API: store weight logs per user { date (member's local date), weightKg, timestamp }; support multiple entries per day; expose a query for the selected range (W = 7 days, M = 30 days, 6M = 26 weeks, Y = 12 months). (2) Quick-log bottom sheet opened from a 'Log Weight' button on a Bodyweight card; pre-fills with the member's most recent weight, −0.1/+0.1 steppers, decimal keyboard input, solid accent Save button. (3) Apple Health-style chart: W | M | 6M | Y control (default M); header with AVERAGE / RANGE and the date span, updating live while scrubbing; right-aligned Y-axis labels with 3–4 dashed gridlines scaled to min − 1 kg … max + 1 kg; W and M show dots with a subtle connecting line and an optional 7-day moving-average trend line; 6M and Y (and multi-entry days) show rounded range bars from min to max, a dot when min = max; pointer/touch scrubbing snaps a vertical crosshair to the nearest bucket and highlights it. This is the 'bodyweight log' part of reserved feature 014; it must respect the existing profile body weight (feature 007) and never expose body weight in public/squad views."

## Clarifications

### Session 2026-11-24

- Q: Where does a member delete a mistyped entry? → A: In the quick-log sheet: it lists the entries already logged for the selected day, each with a delete action.
- Q: Which entry sets the profile body weight? → A: The one with the latest date, then latest recorded time; never insertion order, so backfilling yesterday never replaces today's weight.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log today's weight in a few taps (Priority: P1)

A member steps on the scale in the morning, opens SquadFit, taps **Log weight** on their Bodyweight card, sees their last weight already filled in, nudges it with −0.1 / +0.1 (or types it with the decimal keypad) and taps **Save**. The card immediately shows the new latest weight.

**Why this priority**: Without quick, low-friction logging there is no data for anything else; it is also the smallest slice that delivers value (a weight history and an up-to-date body weight for calorie estimates).

**Independent Test**: Open the sheet, change the pre-filled value, save, reopen the sheet and confirm it now pre-fills with the saved value and that the card's "latest" figure changed.

**Acceptance Scenarios**:

1. **Given** a member whose most recent log is 78.4 kg, **When** they open the quick-log sheet, **Then** the input shows 78.4.
2. **Given** a member with no logs but a profile body weight of 80 kg, **When** they open the sheet, **Then** it shows 80.0; **given** neither, it shows 75.0 (the app's default body weight).
3. **Given** the sheet shows 78.4, **When** they tap +0.1 twice and −0.1 once, **Then** it shows 78.5.
4. **Given** they type "78,6" or "78.6", **When** they save, **Then** 78.6 kg is stored for today in their own timezone with the time of saving.
5. **Given** they already logged 78.6 this morning, **When** they log 79.1 in the evening, **Then** both entries are kept for that day and the latest weight becomes 79.1.
6. **Given** a value outside 20–400 kg or not a number, **When** they tap Save, **Then** it is refused with a plain message and nothing is stored.
7. **Given** the save succeeds and the new entry is the latest by date then time, **Then** the member's profile body weight (used for treadmill calorie estimates) becomes the newly logged value.
8. **Given** today's entry is 78.0, **When** the member backfills 79.5 for yesterday, **Then** the profile body weight stays 78.0.

---

### User Story 2 - See the trend on an Apple Health-style chart (Priority: P1)

On the Bodyweight card the member sees a chart of their weight with a **W | M | 6M | Y** control (M by default). Above the chart a header shows the average (or range) and the dates covered. The member can drag a finger or pointer across the chart; a vertical line snaps to the nearest day, week or month, highlights it, and the header shows that bucket's value and date.

**Why this priority**: Seeing the trend is the reason to log at all; this is the core of the request.

**Independent Test**: Seed logs across a year, open each range and check bucket count, header figures, axis scale and the scrubbing readout against hand-computed values.

**Acceptance Scenarios**:

1. **Given** range **W**, **Then** the chart shows 7 daily slots ending today (member's timezone); **M** shows 30 daily slots ending today; **6M** shows 26 weekly slots (Mon–Sun) ending with the current week; **Y** shows 12 monthly slots ending with the current month.
2. **Given** W or M, **Then** each day with exactly one entry is a dot, consecutive logged days are joined by a subtle line through each day's average (days without data are skipped, not drawn as zero), and a day with several entries is drawn as a range bar from its lowest to highest value.
3. **Given** 6M or Y, **Then** each week or month with data is a rounded range bar from its lowest to highest entry, and a dot where lowest equals highest.
4. **Given** no scrubbing, **Then** the header shows **AVERAGE** with the average of the range's daily averages (1 decimal, "kg") for W and M, and **RANGE** with "lowest–highest kg" for 6M and Y, plus the date span of the range (e.g. "25 Oct – 23 Nov 2026").
5. **Given** the member scrubs to a slot with data, **Then** the crosshair snaps to that slot, its dot or bar is highlighted, and the header shows that slot's value (single weight, or average for a day with several entries; range for a week or month) and its date or date span, labelled WEIGHT for a single weigh-in, AVERAGE for a day with several, RANGE for a week or month. Releasing returns the header to the range summary.
6. **Given** scrubbing over a slot with no data, **Then** the crosshair snaps to the nearest slot that has data.
7. **Given** the values in view span 76.2–79.8 kg, **Then** the vertical scale runs from at most 75.2 to at least 80.8 kg, with 3–4 dashed horizontal gridlines at round values labelled on the right.
8. **Given** W or M and the trend line switched on, **Then** a 7-day moving average line is drawn over the days in view (each point averages the daily averages of that day and up to 6 previous calendar days that have data, including days just before the visible range).
9. **Given** a range with no entries, **Then** the chart shows an empty state ("No weigh-ins in this period") and the header shows no figures.

---

### User Story 3 - Fix a mistaken entry (Priority: P2)

A member who mistyped (e.g. 87.4 instead of 78.4) opens the quick-log sheet, which lists the entries already logged for the selected day (time and weight), and deletes the wrong one.

**Why this priority**: A single typo distorts the scale and averages; deleting is the minimum correction tool. Lower priority than logging and viewing.

**Independent Test**: Log two entries, delete one, check the chart, header and latest weight reflect only the remaining entry.

**Acceptance Scenarios**:

1. **Given** the sheet is open on a day with entries at 07:10 (78.4) and 07:12 (87.4), **Then** both are listed with a delete action; **When** they delete 87.4, **Then** it disappears from the list, the chart, averages and ranges.
4. **Given** the selected day is older than the edit window (today + 2 previous days), **Then** its entries are not offered for deletion and the server refuses a delete for that date.
2. **Given** the deleted entry was the most recent, **Then** the latest weight and the profile body weight become the next most recent entry; if no entries remain, the profile body weight is left as it was.
3. **Given** an entry id that is not theirs (or no longer exists), **When** they try to delete it, **Then** nothing changes for any member and they get their own unchanged view back.

---

### Edge Cases

- A member who changes timezone: existing entries keep the date they were logged on; new entries use the new timezone.
- More than the daily limit (10 entries in one day): further logs that day are refused with a plain message.
- Logging for a past day: the sheet has today selected; the member may pick yesterday or the day before (the app's usual edit window); older or future dates are refused by the server.
- Only one entry in the whole range: average equals that value, the scale is that value ± 1 kg, and there is no connecting line.
- The 6M range starts mid-month and the Y range's first month may be partially before the member's first log: buckets only include entries inside the range.
- Body weight in Settings: changing it there also records an entry for today, so the chart and Settings never disagree about the latest weight. If today already has 10 entries, the rest of the profile is saved and the weight change is skipped with the daily-limit message.
- Very large gaps (months without logs) in W/M: no line is drawn across empty days beyond the visible slots; the trend line uses only days that have data.
- Scrubbing on touch must not scroll the page sideways while the finger is on the chart; vertical page scrolling still works when the gesture starts vertically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Members MUST be able to record a body weight entry consisting of a date (their local calendar date), a weight in kilograms (20–400, one decimal) and the time it was recorded.
- **FR-002**: The system MUST keep every entry, allowing several per day (at most 10 per day per member); entries are never merged or overwritten.
- **FR-003**: The date of a new entry MUST default to today in the member's own timezone and MAY be yesterday or the day before; any other date MUST be refused by the server.
- **FR-004**: The quick-log sheet MUST list the member's entries for the selected day (recorded time and weight) with a delete action each. Members MUST be able to delete their own entries within the edit window (today + 2 previous days); they MUST NOT be able to read or delete anyone else's.
- **FR-005**: The system MUST return, for a requested range (W, M, 6M, Y) ending today in the member's timezone, the ordered slots for that range, each with its date span and, when it has data, its lowest, highest and average weight and the number of entries; plus the range summary (average of daily averages, overall lowest and highest) and the member's latest entry.
- **FR-006**: For W and M the response MUST also include each visible day's 7-day moving average, computed from daily averages including up to 6 days before the visible range.
- **FR-007**: Range, bucketing, averages, moving average and axis scaling MUST follow one documented set of rules, so the figures shown right after saving are identical to those shown after a reload.
- **FR-008**: The member's profile body weight MUST be updated after every entry write to their most recent entry (a failed update is repaired by the next write), ordered by local date and then recorded time (never by insertion order), whenever at least one entry exists; saving a body weight in Settings MUST record an entry for today.
- **FR-009**: The Bodyweight card MUST show the latest weight with its date, a **Log weight** button and the chart; the quick-log sheet MUST open from that button with the value pre-filled per User Story 1, −0.1 / +0.1 steppers, a decimal keypad input and one primary **Save** button.
- **FR-010**: The chart MUST offer W | M | 6M | Y with M selected by default, a header that shows AVERAGE or RANGE and the date span and updates live while scrubbing, right-aligned axis labels with 3–4 dashed gridlines over a scale of [lowest − 1 kg, highest + 1 kg] rounded outward to whole kilograms, and pointer and touch scrubbing that snaps to the nearest slot with data.
- **FR-011**: W and M MUST draw single-entry days as dots joined by a subtle line and multi-entry days as range bars; 6M and Y MUST draw range bars, with a dot when lowest equals highest. A trend toggle MUST show or hide the 7-day moving average in W and M; it is off by default and the choice is remembered on the device.
- **FR-012**: Body weight entries MUST NOT appear in any squad, public, feed, leaderboard, share-card or other-member view, and MUST NOT be written to logs.
- **FR-013**: The chart MUST be readable with assistive technology: the header figures are text, and the chart exposes a text summary of the range.

### Key Entities

- **Weight entry**: one weigh-in by one member. Attributes: id, member, local date, weight (kg, one decimal), recorded-at time. Belongs only to its member.
- **Weight range view** (derived, not stored): the selected range, its slots (date span, lowest, highest, average, count), range summary, moving-average points (W/M) and latest entry.
- **Profile body weight** (existing, feature 007): now kept equal to the latest entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can log a weight that is within ±1 kg of their last one in under 10 seconds and 4 taps or fewer from opening the Food page.
- **SC-002**: For any seeded data set, the averages, ranges and moving averages shown match a hand calculation to one decimal place in 100% of test cases.
- **SC-003**: Switching between W, M, 6M and Y shows the new chart in under 1 second on a typical phone connection.
- **SC-004**: While scrubbing, the highlighted slot and header follow the finger with no visible lag on a mid-range phone.
- **SC-005**: No response served to another member or to an anonymous visitor contains any weight entry (verified by review of every squad and public response shape).

## Assumptions

- The Bodyweight card lives on the Food page (below the day's ledger), since body weight sits with nutrition; it is visible only to its owner. It shows the same data whichever day the Food page is on (ranges always end today).
- Weights are entered and shown in kilograms only, matching the rest of the app.
- Body weight sharing as a relative-strength ratio (the hidden switch from feature 010) and AI-agent access to the weight log are out of scope for this feature; the AI agent keeps seeing the profile body weight as today.
- "Average" for a range is the average of daily averages so one day with many weigh-ins does not dominate; a week or month slot's average works the same way.
- Weeks are Monday–Sunday and months are calendar months, matching the squad's week rule.
- No limit on history length; the Y range is the longest view.
- Existing profile body weights are not back-filled as entries; a member's first log starts their history.
