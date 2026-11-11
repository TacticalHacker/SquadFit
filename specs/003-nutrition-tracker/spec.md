# Feature Specification: Nutrition Tracker

**Feature Branch**: `003-nutrition-tracker`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Nutrition tracker (PRD §3.2): a signed-in user logs food eaten each day and sees total calories eaten against their daily calorie target (from their profile), alongside calories burned from the workout tracker (feature 002) so they can see their net calories. "Today" is computed in the user's own timezone, same as workouts. Users can add, edit and remove food entries for a day, view previous days, and reuse foods they logged before. Food data is private to the user until the leaderboard feature publishes derived totals. Builds on 001-user-accounts (profile: timezone, daily calorie target) and 002-workout-tracker (day boundaries, edit window, calories burned). Out of scope: leaderboard/scoring, streaks, nudges, barcode scanning, photo logging, external food databases."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log what I ate today (Priority: P1)

A signed-in user opens the Food screen and adds the things they ate today by typing a name and a
calorie amount (for example "Chicken biryani, 650"). Each item appears in today's list. They can
correct an item's name or calories, or remove it.

**Why this priority**: Logging food is the core daily action of this feature, and every total and
later score is built from these entries.

**Independent Test**: Sign in, open Food, add "Oats, 300" and "Banana, 100", reload and confirm both
are still listed with the same values, edit the banana to 90, then remove the oats.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a completed profile and nothing logged today, **When** they open Food, **Then** they see an empty list for today and a clear way to add the first item.
2. **Given** the add form, **When** the user enters a name and a calorie amount and submits, **Then** the item is saved for today and appears in the list straight away.
3. **Given** a logged item, **When** the user changes its name or calories and saves, **Then** the list and totals show the new values.
4. **Given** a logged item, **When** the user removes it, **Then** it disappears from today's list and totals.
5. **Given** the user adds the same food twice in a day, **When** they look at the list, **Then** both entries are listed separately (eating the same thing twice is valid).
6. **Given** a name that is empty or a calorie amount that is not a whole number within the allowed range, **When** the user submits, **Then** nothing is saved and a message states what is allowed.
7. **Given** a user who has not completed profile setup, **When** they open Food, **Then** they are sent to profile setup first (feature 001).

---

### User Story 2 - See my day: eaten, burned and net (Priority: P1)

Above the list the user sees their day at a glance: calories eaten, calories burned (from their
workouts that day), net calories (eaten minus burned), and how that compares to their daily
calorie target. The numbers update as soon as they add, change or remove a food item.

**Why this priority**: The combined ledger is the reason this feature exists next to the workout
tracker: "what I ate against what I burned".

**Independent Test**: Log 500 kcal of food and a workout burning 300 kcal; confirm eaten 500,
burned 300, net 200, and the remaining-versus-target figure; add 100 kcal more food and confirm the
numbers change immediately.

**Acceptance Scenarios**:

1. **Given** nothing logged, **When** the user opens Food, **Then** eaten, burned and net all show 0 and the target is shown with its full amount remaining.
2. **Given** food items totalling 1,800 kcal and workouts burning 400 kcal, **When** the user looks at the ledger, **Then** eaten is 1,800, burned is 400 and net is 1,400.
3. **Given** a daily calorie target of 2,200 and a net of 1,400, **When** the user looks at the ledger, **Then** it shows 800 kcal remaining under the target.
4. **Given** a net above the target, **When** the user looks at the ledger, **Then** it shows by how much they are over, clearly worded and not alarming.
5. **Given** the user changes the workouts for the same day, **When** they next see the ledger, **Then** the burned figure matches the workout totals for that day.
6. **Given** two users in different timezones logging at the same instant, **When** each opens Food, **Then** each sees the item under their own local "today".

---

### User Story 3 - Look at and fix recent days (Priority: P2)

The user can move to previous days, see what they ate and the ledger for that day, and fix
forgotten or wrong entries for today and the two days before it. Older days are view-only.

**Why this priority**: People forget to log; a short catch-up window keeps totals honest, and it
matches how workouts already behave.

**Independent Test**: Go to yesterday, add an item, confirm yesterday's totals change; go four days
back and confirm the day is view-only.

**Acceptance Scenarios**:

1. **Given** a user on today's Food screen, **When** they choose the previous day, **Then** they see that day's items and ledger (or an empty state), and can return to today.
2. **Given** today or either of the two days before it, **When** the user adds, edits or removes an item, **Then** it is saved and the totals update.
3. **Given** a day more than two days before today, **When** the user opens it, **Then** items and totals are shown but cannot be changed, with a short explanation, and the system refuses changes to it even if attempted outside the screen.
4. **Given** a future date, **When** the user tries to open or log to it, **Then** they are taken back to today.
5. **Given** a screen left open past local midnight, **When** the day changes, **Then** the screen moves to the new day instead of logging to the old one.

---

### User Story 4 - Re-log foods I eat often (Priority: P2)

Under the add form the user sees a short list of foods they have logged recently (most recent
first, each with the calories last used). Tapping one adds it to the day being viewed with those
calories, which they can then adjust.

**Why this priority**: Most people eat the same things repeatedly; typing every time is the main
reason people stop logging.

**Independent Test**: Log "Oats, 300" on one day; on another day see "Oats, 300" under recent foods,
tap it, and confirm a new Oats entry for that day.

**Acceptance Scenarios**:

1. **Given** the user has logged foods before, **When** they open Food, **Then** they see up to 20 distinct recent foods, most recently logged first, each with the calories of its latest entry.
2. **Given** a recent food, **When** the user taps it, **Then** an entry with that name and calories is added to the viewed day and the totals update.
3. **Given** the same food logged with different calories on different days, **When** recent foods are shown, **Then** it appears once, with its most recent calories (names compared ignoring capitalisation and extra spaces).
4. **Given** a brand-new user, **When** they open Food, **Then** no recent-foods list is shown.
5. **Given** a read-only day, **When** the user views it, **Then** recent foods are not offered for adding to it.

---

### Edge Cases

- A very large single item (for example a calorie typo of 99999): rejected with the allowed range rather than saved.
- Two entries with identical names and calories logged on purpose: both are kept.
- Calorie target changed in Settings after logging: past entries are unchanged; the remaining-versus-target figure uses the target as it is now.
- A day with no profile target (should not occur once setup is complete): the ledger still shows eaten, burned and net, without a target line.
- Removing or editing an entry that was already deleted on another device: the screen refreshes to the true state with a short notice instead of failing silently.
- Changing timezone in Settings: entries already logged stay on the dates they were logged under.
- Offline or failed save: the item is not shown as saved; the user sees a short message and can retry.
- Very long names: limited to a maximum length, with a message when exceeded.

## Requirements *(mandatory)*

### Functional Requirements

**Access**
- **FR-001**: The Food screen MUST be available only to signed-in users with a completed profile.

**Logging**
- **FR-002**: Users MUST be able to add a food entry to a day with a name (1-60 characters after trimming) and calories (a whole number from 1 to 5,000).
- **FR-003**: Users MUST be able to change an entry's name and calories, and remove an entry.
- **FR-004**: A user MUST be able to log the same food more than once on a day; each entry is independent.
- **FR-005**: Invalid input MUST be rejected with a message that states the allowed values; nothing is saved.
- **FR-006**: Entries MUST be listed for the day in the order they were added.

**Daily ledger**
- **FR-007**: For any day the screen MUST show calories eaten (sum of that day's food entries), calories burned (the day's total from the workout tracker), and net calories (eaten minus burned).
- **FR-008**: The screen MUST show the user's daily calorie target and how many calories remain under it (target minus net) or by how many they are over it.
- **FR-009**: The ledger MUST update immediately when an entry is added, changed or removed.
- **FR-010**: A day with no entries MUST show 0 eaten; burned is 0 when there are no workouts that day.
- **FR-011**: The ledger is for information only in this feature; it does not produce scores, rankings or streaks.

**Days and timezones**
- **FR-012**: "Today" and every day boundary MUST be determined in the user's own timezone from their profile, never in server time.
- **FR-013**: Entries MUST be stored against the calendar date they were logged for and MUST stay on that date if the user later changes timezone.
- **FR-014**: Users MUST be able to view any earlier day's entries and ledger, but not days after today.
- **FR-015**: Users MUST be able to add, change and remove entries for today and the two days before it (three calendar days in total, counted in the user's timezone). Earlier days MUST be read-only, and the system MUST refuse changes to them even if the screen would not allow them.
- **FR-016**: When the user's local date changes while the Food screen is open, the screen MUST move to the new day and MUST NOT record into the old day without the user having chosen it.

**Reusing foods**
- **FR-017**: The screen MUST offer up to 20 distinct recently logged foods, most recent first, each with the calories of its latest entry; names are compared ignoring capitalisation and extra spaces.
- **FR-018**: Choosing a recent food MUST add an entry with that name and calories to the viewed day, which the user can then change.
- **FR-019**: Recent foods MUST be built only from the user's own entries.

**Privacy**
- **FR-020**: A user's food entries, recent foods and ledger MUST be visible only to that user in this feature. Sharing derived totals with others is decided by the leaderboard feature.

### Key Entities

- **Food entry**: One thing a user ate on one day: name, calories, the calendar date it belongs to, and when it was added. Belongs to exactly one user. Not shared between users.
- **Recent food**: A suggestion built from the user's own earlier entries: a name and the calories of its latest entry. Not stored as its own record; changes as the user logs.
- **Day ledger**: The summary of one day for one user: calories eaten, calories burned (from workouts), net, the daily calorie target and the remaining or over amount. Derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a food item and see it, with updated totals, in under 1 second from submitting it.
- **SC-002**: A user can log a typical day of four items in under 1 minute, and under 20 seconds when the items are in their recent foods.
- **SC-003**: In 100% of tested cases the day's eaten total equals the sum of the entries shown and net equals eaten minus burned.
- **SC-004**: In 100% of tested cases across at least five timezones (including one that changes clocks for daylight saving), an entry added at a given moment appears under the correct local date.
- **SC-005**: A user's food data is never visible to other users; access checks pass in 100% of tested cases.
- **SC-006**: A past day, or a month of days, loads in under 1 second for a user with a year of history.
- **SC-007**: In 100% of tested cases the burned figure on the Food screen equals the workout total shown for the same day on the Workouts screen.

## Assumptions

- Users are signed in with a completed profile (features 001), including timezone and daily calorie target.
- A food entry is a free-text name plus calories typed by the user; there is no built-in food list, no portion maths and no macro (protein, carb, fat) tracking in this feature.
- Calories are entered as a whole number from 1 to 5,000 per entry; names are 1-60 characters.
- The editable window (today and the two days before) and the "no future days" rule are the same as for workouts, so users have one rule to remember.
- Net calories are eaten minus burned. Remaining under target is target minus net. These are display figures only; scoring rules belong to the leaderboard feature (PRD §5.1).
- Recent foods are drawn from the user's last 90 days of entries.
- Meal slots (breakfast, lunch, dinner, snack) are out of scope; entries are a single list per day in the order added.
- Out of scope: leaderboard and scoring, streaks, nudges, barcode scanning, photo logging, external food databases, macros, and editing entries older than the window.
- Depends on feature 002 for the burned figure and for day and edit-window behaviour.
