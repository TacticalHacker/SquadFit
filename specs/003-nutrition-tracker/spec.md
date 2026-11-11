# Feature Specification: Nutrition Tracker

**Feature Branch**: `003-nutrition-tracker`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Nutrition tracker (PRD §3.2): a signed-in user logs food eaten each day and sees total calories eaten against their daily calorie target (from their profile), alongside calories burned from the workout tracker (feature 002) so they can see their net calories. "Today" is computed in the user's own timezone, same as workouts. Users can add, edit and remove food entries for a day, view previous days, and reuse foods they logged before. Food data is private to the user until the leaderboard feature publishes derived totals. Builds on 001-user-accounts (profile: timezone, daily calorie target) and 002-workout-tracker (day boundaries, edit window, calories burned). Out of scope: leaderboard/scoring, streaks, nudges, barcode scanning, photo logging, external food databases."

**Amendment (2026-11-11, before planning)**: the owner asked for food lists too: a built-in list of common foods, the user's own saved foods, servings, and meal slots (breakfast, lunch, dinner, snacks).

## Clarifications

### Session 2026-11-11

- Q: Should each food also record protein, carbs and fat, or only calories? → A: Calories plus protein, carbs and fat per serving, shown on each food and as daily totals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log what I ate (Priority: P1)

A signed-in user opens the Food screen and adds what they ate in a meal (breakfast, lunch, dinner
or snacks). They can type a food name with its calories (for example "Chicken biryani, 650"), or
pick a food from a list (User Story 4) and say how many servings. Each item appears under its meal
with its calories and macros (protein, carbs, fat). They can correct an item or remove it.

**Why this priority**: Logging food is the core daily action; every total and later score is built
from these entries.

**Independent Test**: Sign in, open Food, add "Oats, 300" to Breakfast and "Banana, 100" to Snacks,
reload and confirm both are listed under the right meals with the same values, edit the banana to
90, then remove the oats.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a completed profile and nothing logged today, **When** they open Food, **Then** they see four empty meals (Breakfast, Lunch, Dinner, Snacks) for today and a clear way to add to each.
2. **Given** the add form for a meal, **When** the user enters a name and a calorie amount and submits, **Then** the item is saved to that meal for today and appears straight away.
3. **Given** a logged item, **When** the user changes its name, calories, meal or servings and saves, **Then** the list and totals show the new values.
4. **Given** a logged item, **When** the user removes it, **Then** it disappears from the list and totals.
5. **Given** the user adds the same food twice in a day, **When** they look at the list, **Then** both entries are listed separately.
6. **Given** a name that is empty or calories that are not a whole number in the allowed range, **When** the user submits, **Then** nothing is saved and a message states what is allowed.
7. **Given** a user who has not completed profile setup, **When** they open Food, **Then** they are sent to profile setup first (feature 001).
8. **Given** several meals with items, **When** the user looks at the screen, **Then** each meal shows its own calorie subtotal.
9. **Given** the add form, **When** the user optionally enters protein, carbs and fat in grams for a typed item, **Then** they are saved with the entry; leaving them blank saves the entry with no macro values.

---

### User Story 2 - See my day: eaten, burned and net (Priority: P1)

Above the meals the user sees their day at a glance: calories eaten, calories burned (from that
day's workouts), net calories (eaten minus burned), and how that compares to their daily calorie
target, plus the day's total protein, carbs and fat. The numbers update as soon as they add, change or remove an item.

**Why this priority**: The combined ledger is why this feature sits next to the workout tracker.

**Independent Test**: Log 500 kcal of food and a workout burning 300 kcal; confirm eaten 500,
burned 300, net 200 and the remaining-versus-target figure; add 100 kcal more and confirm the
numbers change immediately.

**Acceptance Scenarios**:

1. **Given** nothing logged, **When** the user opens Food, **Then** eaten, burned and net all show 0 and the target is shown with its full amount remaining.
2. **Given** food totalling 1,800 kcal and workouts burning 400 kcal, **When** the user looks at the ledger, **Then** eaten is 1,800, burned is 400 and net is 1,400.
3. **Given** a daily calorie target of 2,200 and a net of 1,400, **When** the user looks, **Then** it shows 800 kcal remaining under the target.
4. **Given** a net above the target, **When** the user looks, **Then** it shows by how much they are over, worded clearly and not alarmingly.
5. **Given** the user changes that day's workouts, **When** they next see the ledger, **Then** the burned figure matches the workout totals for that day.
6. **Given** two users in different timezones logging at the same instant, **When** each opens Food, **Then** each sees the item under their own local "today".
7. **Given** entries with protein, carbs and fat, **When** the user looks at the ledger, **Then** it shows total grams of each, summed over the entries that have macro values, and says when some entries have none.

---

### User Story 3 - Look at and fix recent days (Priority: P2)

The user can move to previous days, see what they ate and the ledger for that day, and fix
forgotten or wrong entries for today and the two days before it. Older days are view-only.

**Why this priority**: People forget to log; a short catch-up window keeps totals honest and
matches how workouts already behave.

**Independent Test**: Go to yesterday, add an item, confirm yesterday's totals change; go four days
back and confirm the day is view-only.

**Acceptance Scenarios**:

1. **Given** today's Food screen, **When** the user chooses the previous day, **Then** they see that day's meals and ledger (or an empty state) and can return to today.
2. **Given** today or either of the two days before it, **When** the user adds, edits or removes an item, **Then** it is saved and the totals update.
3. **Given** a day more than two days before today, **When** the user opens it, **Then** items and totals are shown but cannot be changed, with a short explanation, and the system refuses changes to it even if attempted outside the screen.
4. **Given** a future date, **When** the user tries to open or log to it, **Then** they are taken back to today.
5. **Given** a screen left open past local midnight, **When** the day changes, **Then** the screen moves to the new day instead of logging to the old one.

---

### User Story 4 - Pick from food lists (Priority: P2)

When adding to a meal the user can search and pick from food lists instead of typing: a built-in
list of common foods (each with a standard serving, its calories and its protein, carbs and fat, including popular Indian and
international foods), their own saved foods, and a short list of foods they logged recently.
Picking a food asks how many servings and adds it with the calories and macros scaled to that amount. The
user can also save their own foods (name, serving description, calories per serving, and optionally protein, carbs and fat per serving), edit them
and remove them.

**Why this priority**: Most people eat the same things repeatedly; typing every time is the main
reason people stop logging. Lists make logging a few taps.

**Independent Test**: Search "dal", pick it, choose 2 servings and confirm the entry and calories;
save "Mom's paratha, 1 piece, 180 kcal", then add it from "My foods"; log it once, then see it
under recent foods on another day.

**Acceptance Scenarios**:

1. **Given** the add form, **When** the user types in the search box, **Then** matching foods from the built-in list and from their own foods are shown, built-in and own clearly distinguished.
2. **Given** a food from a list, **When** the user picks it and sets servings, **Then** an entry is added to the chosen meal with its calories, protein, carbs and fat each equal to the per-serving value times the servings (calories rounded to a whole number, grams to one decimal place).
3. **Given** the user creates their own food with a name, a serving description and calories per serving, **When** they save it, **Then** it appears in "My foods" and in search, visible only to them.
4. **Given** one of their own foods, **When** the user edits or removes it, **Then** future picks use the new values or no longer offer it, and entries already logged keep the values they were logged with.
5. **Given** the user has logged foods before, **When** they open the add form, **Then** they see up to 20 distinct recent foods, most recent first, each with its latest calories, and tapping one adds it to the chosen meal.
6. **Given** a brand-new user, **When** they open the add form, **Then** the built-in list is available and no recent foods are shown.
7. **Given** a read-only day, **When** the user views it, **Then** lists are not offered for adding to it.
8. **Given** another user's saved foods, **When** this user searches, **Then** those foods are never shown.

---

### Edge Cases

- A food with calories but no macro values (typed entry, or own food saved without them): allowed; it adds to calories but not to macro totals, and the ledger says some entries have no macros.
- A very large single item (calorie typo such as 99999): rejected with the allowed range.
- The same food logged with different calories on different days: appears once in recent foods with its latest value.
- Calorie target changed in Settings after logging: past entries are unchanged; the remaining-versus-target figure uses the current target.
- A day with no target (should not happen after setup): the ledger shows eaten, burned and net without a target line.
- A saved food removed after being logged: past entries are unchanged and still shown.
- A saved food name that matches a built-in food: allowed (they are separate lists), shown with a label.
- Changing timezone in Settings: entries already logged stay on their original dates.
- Offline or failed save: the item is not shown as saved; a short message lets the user retry.
- Removing or editing an entry already deleted on another device: the screen refreshes to the true state with a short notice.
- Very long names: limited to a maximum length with a message.

## Requirements *(mandatory)*

### Functional Requirements

**Access**
- **FR-001**: The Food screen MUST be available only to signed-in users with a completed profile.

**Logging**
- **FR-002**: Users MUST be able to add a food entry to a meal (Breakfast, Lunch, Dinner or Snacks) on a day, with a name (1-60 characters after trimming) and calories (a whole number from 1 to 5,000), and optionally protein, carbs and fat in grams (each a number from 0 to 500 with at most one decimal place), either typed directly or from a food list.
- **FR-003**: An entry added from a list MUST have calories equal to the food's calories per serving times the number of servings, rounded to the nearest whole number, and protein, carbs and fat equal to the per-serving grams times the servings, rounded to one decimal place; servings are allowed from 0.5 to 20 in steps of 0.5, and the result MUST still fall within 1 to 5,000.
- **FR-004**: Users MUST be able to change an entry's name, calories, macros, meal and servings, and remove an entry.
- **FR-005**: A user MUST be able to log the same food more than once on a day; each entry is independent.
- **FR-006**: Invalid input MUST be rejected with a message that states the allowed values; nothing is saved.
- **FR-007**: Within each meal, entries MUST be listed in the order they were added.
- **FR-008**: An entry MUST keep the name, servings, calories and macros it was logged with, so later edits or removal of a saved food never change past days.

**Daily ledger**
- **FR-009**: For any day the screen MUST show calories eaten (sum of that day's entries) with a subtotal per meal, calories burned (the day's total from the workout tracker), and net calories (eaten minus burned).
- **FR-010**: The screen MUST show the user's daily calorie target and how many calories remain under it (target minus net) or by how many they are over it.
- **FR-011**: The ledger MUST update immediately when an entry is added, changed or removed.
- **FR-012**: A day with no entries MUST show 0 eaten; burned is 0 when there are no workouts that day.
- **FR-025**: For any day the screen MUST show total protein, carbs and fat in grams, summed over the entries that have values, and indicate when some entries have none.
- **FR-013**: The ledger is for information only in this feature; it does not produce scores, rankings or streaks.

**Days and timezones**
- **FR-014**: "Today" and every day boundary MUST be determined in the user's own timezone from their profile, never in server time.
- **FR-015**: Entries MUST be stored against the calendar date they were logged for and MUST stay on that date if the user later changes timezone.
- **FR-016**: Users MUST be able to view any earlier day's entries and ledger, but not days after today.
- **FR-017**: Users MUST be able to add, change and remove entries for today and the two days before it (three calendar days in total, counted in the user's timezone). Earlier days MUST be read-only, and the system MUST refuse changes to them even if the screen would not allow them.
- **FR-018**: When the user's local date changes while the Food screen is open, the screen MUST move to the new day and MUST NOT record into the old day without the user having chosen it.

**Food lists**
- **FR-019**: The system MUST provide one built-in list of common foods, about 40, each with a name, a standard serving description, calories per serving and protein, carbs and fat per serving, identical for every user and not editable by users.
- **FR-020**: Users MUST be able to search the built-in list and their own foods together by name, ignoring capitalisation.
- **FR-021**: Users MUST be able to create their own foods (name 1-60 characters, serving description 1-40 characters, calories per serving a whole number from 1 to 5,000, and optionally protein, carbs and fat per serving as in FR-002), edit them and remove them. Own food names MUST be unique within the user's own list, ignoring capitalisation and extra spaces.
- **FR-022**: The screen MUST offer up to 20 distinct recently logged foods from the last 90 days, most recent first, each with the calories of its latest entry; names are compared ignoring capitalisation and extra spaces. Choosing one adds an entry with that name and calories to the chosen meal.
- **FR-023**: Recent foods and own foods MUST be built only from, and visible only to, the user who owns them.

**Privacy**
- **FR-024**: A user's food entries, own foods, recent foods and ledger MUST be visible only to that user in this feature. Sharing derived totals with others is decided by the leaderboard feature.

### Key Entities

- **Standard food**: A common food in the built-in list: name, standard serving description, calories per serving, protein, carbs and fat per serving. Same for everyone; not editable.
- **Own food**: A food a user saved: name, serving description, calories per serving, optional protein, carbs and fat per serving. Belongs to one user; visible only to them.
- **Food entry**: One thing a user ate in one meal on one day: name, servings, calories, optional protein, carbs and fat, meal, the calendar date, and when it was added. Keeps its own copy of the values it was logged with. Belongs to exactly one user.
- **Recent food**: A suggestion built from the user's own earlier entries (name and latest calories). Not a stored record.
- **Day ledger**: The summary of one day for one user: eaten (with per-meal subtotals), burned (from workouts), net, the daily calorie target, the remaining or over amount, and total protein, carbs and fat. Derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a food item and see it, with updated totals, in under 1 second from submitting it.
- **SC-002**: A user can log a typical day of four items in under 1 minute, and under 20 seconds when the items are in a food list or their recent foods.
- **SC-003**: In 100% of tested cases the day's eaten total equals the sum of the entries shown, each meal subtotal equals its entries, and net equals eaten minus burned.
- **SC-004**: In 100% of tested cases across at least five timezones (including one that changes clocks for daylight saving), an entry added at a given moment appears under the correct local date.
- **SC-005**: A user's food data (entries, own foods, recent foods) is never visible to other users; access checks pass in 100% of tested cases.
- **SC-006**: A past day, or a month of days, loads in under 1 second for a user with a year of history.
- **SC-007**: In 100% of tested cases the burned figure on the Food screen equals the workout total shown for the same day on the Workouts screen.
- **SC-008**: A user can find and add a common food from the built-in list in under 15 seconds.
- **SC-009**: In 100% of tested cases each day's macro totals equal the sum of the macro values of the entries shown (scaled by servings).

## Assumptions

- Users are signed in with a completed profile (feature 001), including timezone and daily calorie target.
- The built-in list holds about 40 common foods chosen to suit the friend group (Indian and international), with typical calories and macros per standard serving; calorie and macro values are estimates, not nutrition advice.
- Meals are fixed: Breakfast, Lunch, Dinner, Snacks. A user cannot add or rename meals.
- Typed entries (no list) are a name plus total calories, with servings fixed at 1. Macros are optional on typed entries and own foods; every built-in food has them.
- The editable window (today and the two days before) and the "no future days" rule are the same as for workouts.
- Net calories are eaten minus burned; remaining under target is target minus net. These are display figures only; scoring rules belong to the leaderboard feature (PRD section 5.1).
- Out of scope: leaderboard and scoring, streaks, nudges, barcode scanning, photo logging, external food databases, micronutrients, macro goals or targets, and editing entries older than the window.
- Depends on feature 002 for the burned figure and for day and edit-window behaviour.
