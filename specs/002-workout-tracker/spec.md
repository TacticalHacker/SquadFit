# Feature Specification: Workout Tracker

**Feature Branch**: `002-workout-tracker`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Workout tracker (PRD §3.1): a signed-in user sees a checklist of workouts from a catalog and checks off the ones they completed today. Checking a workout logs its duration in minutes (preset default per exercise, or a quick manual override) and shows estimated calories burned. Daily workout summary shows total minutes worked out and total calories burned for the day. "Today" is computed in the user's own timezone. Users can uncheck/edit a logged workout, view previous days, and customize the list by adding their own workouts. Workout data is private to the user until the leaderboard feature publishes derived totals. Builds on 001-user-accounts (profiles with timezone and daily calorie target). Out of scope: food logging, leaderboard/scoring, streaks, nudges."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check off today's workouts (Priority: P1)

A signed-in user opens the Workouts screen and sees a checklist of workouts. Next to each is its
usual duration and the calories it typically burns. They tick the ones they did today. Each tick
records the workout for today with its usual duration and shows the estimated calories burned.
Unticking removes it.

**Why this priority**: This is the core daily action of the whole product. Everything else
(summary, history, leaderboard, streaks) is built on these entries.

**Independent Test**: Sign in, open Workouts, tick "Running", confirm it shows as done with its
duration and calories, reload the page and confirm it is still ticked, then untick it and confirm
it disappears from today's entries.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a completed profile, **When** they open Workouts, **Then** they see the full list of available workouts, each with its default duration and default calories, and none ticked for a new day.
2. **Given** an unticked workout, **When** the user ticks it, **Then** it is recorded for today with its default duration and shows its estimated calories burned.
3. **Given** a ticked workout, **When** the user unticks it, **Then** today's entry for it is removed and totals update.
4. **Given** a user who ticked workouts earlier today, **When** they reload the page or return on another device, **Then** the same workouts are shown ticked with the same values.
5. **Given** a user who has not completed profile setup, **When** they try to open Workouts, **Then** they are sent to profile setup first (from feature 001).

---

### User Story 2 - See today's totals (Priority: P1)

Above the checklist, the user sees a daily summary: total minutes worked out and total calories
burned today. The summary updates immediately as they tick, untick, or change entries.

**Why this priority**: The totals are the "score" that later features (leaderboard, streaks)
will be built from. Users also need instant feedback that their log counted.

**Independent Test**: Tick two workouts and confirm the summary shows the sum of their minutes
and the sum of their calories; untick one and confirm both totals drop accordingly.

**Acceptance Scenarios**:

1. **Given** no workouts logged today, **When** the user opens Workouts, **Then** the summary shows 0 minutes and 0 calories burned.
2. **Given** several ticked workouts, **When** the user looks at the summary, **Then** total minutes equals the sum of those workouts' durations and total calories equals the sum of their calories.
3. **Given** the user changes anything in today's entries, **When** the change is saved, **Then** the summary reflects it without a manual refresh.
4. **Given** a user whose timezone is Asia/Kolkata and another whose timezone is America/Los_Angeles, **When** both log a workout at the same instant, **Then** each sees it under their own local "today".

---

### User Story 3 - Adjust the duration of a logged workout (Priority: P2)

A ticked workout shows its duration. The user can change the minutes (for example 45 instead
of the usual 30). The estimated calories burned for that entry are recalculated in proportion.

**Why this priority**: Real workouts rarely match presets, so accuracy needs this. The checklist
is still usable without it.

**Independent Test**: Tick a workout whose default is 30 min / 300 kcal, change its duration to
45, and confirm it shows 450 kcal and the summary adjusts.

**Acceptance Scenarios**:

1. **Given** a ticked workout, **When** the user changes its duration to a valid number of minutes, **Then** its calories are recalculated in proportion to its default (calories per minute stays constant) and the summary updates.
2. **Given** a ticked workout, **When** the user enters 0, a negative number, a non-whole number, or more than the allowed maximum, **Then** the change is rejected with a message giving the allowed range and the previous value stays.
3. **Given** a user who changed a duration, **When** they untick and tick the workout again, **Then** it returns to the workout's default duration.

---

### User Story 4 - Look at previous days (Priority: P2)

The user can move back to earlier days and see what they logged, with that day's totals.

**Why this priority**: History lets users see progress and fix a missed entry, but the product
works day to day without it.

**Independent Test**: Log workouts today, move to yesterday and see its entries and totals (empty
if none), then return to today.

**Acceptance Scenarios**:

1. **Given** a user with entries on earlier days, **When** they move to a previous day, **Then** they see that day's ticked workouts, durations, calories, and totals.
2. **Given** a day with no entries, **When** the user views it, **Then** it shows 0 minutes, 0 calories, and an empty state.
3. **Given** a user viewing a past day, **When** they try to move to a day after today (in their timezone), **Then** it is not allowed.
4. **Given** a past day that is inside the allowed editing window, **When** the user ticks, unticks, or edits a workout, **Then** that day's entries and totals update the same way as for today.
5. **Given** a past day outside the allowed editing window, **When** the user views it, **Then** entries are shown read-only.

---

### User Story 5 - Add my own workouts (Priority: P3)

A user can add workouts that aren't in the standard list (for example "Badminton"), giving a
name, a usual duration, and the calories that duration usually burns. Their own workouts appear
on their checklist alongside the standard ones, and they can rename, change, or remove them.

**Why this priority**: Makes the list fit each person, but the standard list is enough for a
first release.

**Independent Test**: Add "Badminton, 60 min, 400 kcal", confirm it appears on the checklist and
can be ticked like any other, then remove it and confirm it leaves the checklist but past entries
for it remain in history.

**Acceptance Scenarios**:

1. **Given** the Workouts screen, **When** the user adds a workout with a valid name, duration, and calories, **Then** it appears on their checklist and behaves like a standard workout.
2. **Given** a user's own workout, **When** they edit its name, default minutes, or default calories, **Then** the changes apply to future ticks; entries already logged keep the values they were logged with.
3. **Given** a user's own workout that has past entries, **When** they remove it, **Then** it disappears from the checklist but past days still show those entries.
4. **Given** a user adds a workout whose name matches an existing workout on their list (ignoring capitalisation), **When** they save, **Then** it is rejected with "You already have a workout with that name".
5. **Given** two users, **When** one adds a custom workout, **Then** the other never sees it.
6. **Given** the standard workouts, **When** any user looks for edit or remove options on them, **Then** none are offered.

---

### Edge Cases

- **Midnight while the page is open**: when the user's local day changes, the screen must switch to the new day (empty checklist, new totals) or clearly prompt the user to refresh; it must never keep recording into the old day by accident.
- **Timezone change** (profile setting from feature 001): entries already logged stay on the day they were logged. Only days from the change onward use the new timezone.
- **Daylight-saving days** (23- or 25-hour days): "today" is still the user's calendar date and totals are not affected.
- **Same workout twice in a day** (for example a morning and an evening run): a workout can be logged once per day. The user records the combined time by editing the duration.
- **Duration limits**: a duration must be a whole number of minutes from 1 to 600 (10 hours).
- **Calories rounding**: calories are shown as whole numbers, rounded to nearest, and the day's total is the sum of the rounded entry values so what's shown always adds up.
- **Two devices at once**: if the same workout is ticked on two devices at the same moment, only one entry exists for that day.
- **Network failure while ticking**: the user is told the change wasn't saved and the checkbox returns to its previous state; it must never show ticked when nothing was saved.
- **Standard list changes in future releases**: past entries keep the values they were logged with.
- **Future days**: logging for a day after today in the user's timezone is not possible.

## Requirements *(mandatory)*

### Functional Requirements

**Workout list**

- **FR-001**: The system MUST provide a standard list of common workouts, each with a name, a default duration in minutes, and the default calories burned over that duration. Every signed-in user MUST see the same standard list.
- **FR-002**: The Workouts screen MUST show the standard workouts plus the user's own workouts as a checklist, in a stable order (standard workouts first in a fixed order, then the user's own alphabetically).
- **FR-003**: Workouts MUST be available only to signed-in users with a completed profile.

**Logging**

- **FR-004**: Ticking a workout MUST record an entry for the chosen day for that user, using the workout's default duration and the calories calculated from it.
- **FR-005**: Unticking a workout MUST remove that day's entry for it.
- **FR-006**: A user MUST have at most one entry per workout per day.
- **FR-007**: An entry's duration MUST be a whole number of minutes from 1 to 600. Out-of-range or non-whole values MUST be rejected with a message stating the allowed range.
- **FR-008**: An entry's estimated calories burned MUST equal the workout's default calories × entry minutes ÷ the workout's default minutes, rounded to the nearest whole number.
- **FR-009**: Changing an entry's duration MUST recalculate its calories by FR-008.
- **FR-010**: An entry MUST keep the workout name, duration and calories it was logged with, so later edits to the workout, or removing it, never change past days.

**Daily summary**

- **FR-011**: For any day the screen MUST show total minutes (sum of entry durations) and total calories burned (sum of entry calories).
- **FR-012**: The summary MUST update immediately when any entry for that day is added, changed, or removed.
- **FR-013**: A day with no entries MUST show 0 minutes and 0 calories.

**Days and timezone**

- **FR-014**: "Today" and every day boundary MUST be determined in the user's own timezone from their profile, never in server time.
- **FR-015**: Entries MUST be stored against the calendar date (in the user's timezone at the time of logging) and MUST stay on that date if the user later changes their timezone.
- **FR-016**: Users MUST be able to view any earlier day's entries and totals, but not days after today.
- **FR-017**: Users MUST be able to add, change, and remove entries for [NEEDS CLARIFICATION: How far back can a user log or edit workouts — today only, the last 7 days, or any past day?]. Days outside that window MUST be read-only.
- **FR-018**: When the user's local date changes while a Workouts screen is open, the screen MUST move to the new day or prompt the user to refresh, and MUST NOT record into the old day without the user having chosen it.

**Custom workouts**

- **FR-019**: Users MUST be able to add their own workouts with a name (1–40 characters), a default duration (whole minutes, 1–600), and default calories (whole number, 1–5,000).
- **FR-020**: A user's own workout names MUST be unique within that user's list, ignoring capitalisation and surrounding spaces, and MUST NOT duplicate a standard workout name.
- **FR-021**: Users MUST be able to edit and remove their own workouts. Edits affect only future logging (FR-010). Removing hides the workout from the checklist but keeps past entries.
- **FR-022**: Standard workouts MUST NOT be editable or removable by users.
- **FR-023**: A user's own workouts MUST be visible only to that user.

**Privacy**

- **FR-024**: A user's workout entries, custom workouts, and daily totals MUST be visible only to that user in this feature. Sharing derived totals with others is decided by the leaderboard feature.

### Key Entities

- **Workout**: A kind of exercise that can be ticked. Has a name, default duration (minutes), default calories burned over that duration, and whether it is standard (shared by everyone) or a user's own. A user's own workout belongs to exactly one user and can be removed (hidden).
- **Workout Entry**: A record that one user did one workout on one calendar day. Has the user, the date, the workout it came from, and a snapshot of the workout name, minutes, and calories at the time of logging. At most one per user, workout, and day.
- **Daily Workout Summary**: For one user and one day, the total minutes and total calories burned across that day's entries. Always derived from entries, never entered by hand.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can tick a workout and see it recorded, with updated totals, in under 1 second from the tap on a normal connection.
- **SC-002**: A user can log a typical day of three workouts in under 30 seconds.
- **SC-003**: In 100% of tested cases the day's totals equal the sum of the entries shown for that day.
- **SC-004**: In 100% of tested cases across at least five timezones (including one that changes clocks for daylight saving), an entry logged at a given moment appears under the correct local date.
- **SC-005**: A user's workout data is never visible to other users; access checks pass in 100% of tested cases.
- **SC-006**: A past day, or a month's worth of days, loads in under 1 second for a user with a year of history.
- **SC-007**: Users can add their own workout and tick it in under 1 minute.

## Assumptions

- The standard list is a set of about a dozen common workouts (for example walking, running, cycling, swimming, yoga, strength training, HIIT, hiking, stretching). Their exact default minutes and calories are chosen during planning and can be revised later without changing past entries.
- Calories are estimated only from the workout's own default calories-per-minute. Body weight, age, and intensity are not collected, so values are rough estimates rather than medical measurements.
- Users enter custom workouts' calories themselves and are trusted to do so honestly. With a small circle of friends this is acceptable; the leaderboard feature will revisit whether any limits are needed.
- The user's profile (feature 001) supplies the timezone. The daily calorie target is not used in this feature; it is used when food logging and the leaderboard arrive.
- Only whole minutes and whole calories are recorded, and a workout is logged once per day (combine sessions by editing the minutes).
- Notifications, reminders and workout notes or photos are out of scope.
- Food logging, the calorie ledger, the leaderboard and scoring formula, streaks, and nudges are separate later features. Entries recorded here are what they will read.
- The product is a web app; offline logging is out of scope.
