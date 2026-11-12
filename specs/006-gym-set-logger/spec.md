# Feature Specification: Gym Set Logger

**Feature Branch**: `006-gym-set-logger`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Mobile-first gym exercise & set/rep/weight logger (bottom drawer UI). Used almost exclusively on phones in the gym between sets; optimize for one-handed thumb use. Tapping an exercise opens a slide-up bottom sheet (rounded top, max 85vh, backdrop, drag handle, sticky footer), not a centered modal. Stepper buttons at least 44×44px; numeric inputs large enough to avoid iOS zoom; decimal keyboard for weight, numeric for reps. Sticky horizontally scrollable muscle-group pill bar: Chest, Back, Legs, Shoulders, Arms, Core, Cardio. Preset library (listed below), search, and '+ Custom Exercise'. Drawer: Sets stepper (default 3; adding clones the previous set), Default Reps stepper (default 10; updates unedited rows), per-set weight ±2.5 kg and reps ±1 with tap-to-type, per-set completed checkmark. Progressive-overload pre-fill from the last logged entry for that exercise ('Last: 80kg × 8'). Sticky footer: total volume = sum(reps × weightKg), est. duration ~2.5 min/set, burn ~6 kcal/min, feeding daily minutes, calorie burn and the leaderboard. Saved as { type: WORKOUT, exerciseName, muscleGroup, sets[{ setNumber, reps, weightKg, completed }], totalVolumeKg, durationMins, calories }. Integrates with feature 002's day view, edit window and server-authoritative math."

## Clarifications

### Session 2026-11-12

- Q: Should a gym exercise's minutes and calories count every set or only completed sets? → A: Every set counts; the completed checkmark only tracks progress.
- Q: Where should the Gym screen live in the app? → A: As a "Gym" tab inside Workouts (an "Activities | Gym" switch on the Workouts screen), sharing its day navigation and totals; no new top-level navigation item.
- Q: Should an unsaved drawer survive the phone locking or the page reloading? → A: Yes. Unsaved drawer values are kept as a draft on the member's device per exercise and day, restored on reopen until saved or discarded; nothing is sent to the server until Save.
- Q: Should the member's AI coach see gym sets, reps and weights? → A: Yes. The coach's history tool includes each gym entry's exercise, muscle group, sets (reps, weight, completed) and volume, for that member only.
- Q (2026-11-12, after implementation): Which Workouts tab opens by default? → A: Gym. The app home and the Workouts nav link open the Gym tab; the switch reads "Gym | Activities".
- Q: How to handle a day with both the generic "Strength training" activity and gym entries? → A: Allow both and count both; on a day with gym entries the Strength training card shows a hint with the gym minutes already logged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log an exercise's sets from a bottom drawer (Priority: P1)

Between sets at the gym, a member opens the Gym screen on their phone, taps the muscle group
(for example **Chest**), taps **Bench Press**, and a drawer slides up from the bottom of the
screen. It shows three set rows pre-filled with 10 reps each. With their thumb they bump the
weight on set #1 to 60 kg, tick each set as they finish it, and tap **Save**. The exercise is
recorded on today's workouts with its sets, and the day's minutes and calories burned go up.

**Why this priority**: This is the whole point of the feature; everything else refines it.

**Independent Test**: On a phone-sized screen, sign in, open Gym, open Bench Press, set the
three sets to 60 kg × 10, save, reload, and confirm Bench Press appears in today's workouts
with 3 sets, 1,800 kg volume, 8 minutes and 45 kcal, and today's totals include them.

**Acceptance Scenarios**:

1. **Given** a signed-in member with a completed profile, **When** they tap an exercise, **Then** a drawer slides up from the bottom over a dimmed backdrop, with a drag handle at the top, the exercise name in the header, the set controls in a scrollable middle, and a footer that stays visible while the middle scrolls.
2. **Given** an exercise with no history, **When** the drawer opens, **Then** it shows 3 sets, 10 reps each and 0 kg each.
3. **Given** an open drawer, **When** the member taps **Save**, **Then** the exercise is recorded for the day being viewed, the drawer closes, and the day's total minutes and calories burned include the exercise's estimated minutes and calories.
4. **Given** an open drawer, **When** the member taps the backdrop, swipes the drawer down, or taps close, **Then** the drawer closes without saving to their account; if they had changed anything, their values are kept as a draft on the device, and the exercise is marked "Draft" in the list.
7. **Given** a draft exists for an exercise and day (including after the phone locked or the page reloaded), **When** the member opens that exercise, **Then** the drawer restores the draft's sets, reps, weights and ticks, and offers **Discard draft** to go back to the saved or pre-filled values.
5. **Given** an exercise already logged for that day, **When** the member taps it again, **Then** the drawer opens with the saved sets so they can change them; saving replaces the earlier record, and the drawer offers **Remove** to delete it.
6. **Given** the day being viewed is outside the edit window (feature 002: today and the previous 2 days), **When** the member opens a logged exercise, **Then** the drawer is read-only and offers no Save or Remove.

---

### User Story 2 - Adjust sets, reps and weight one-handed (Priority: P1)

Inside the drawer, the member changes the plan with large thumb-sized buttons: a **Sets**
stepper adds or removes rows, a **Default Reps** stepper changes the reps of rows they haven't
touched, and each row has its own weight and reps steppers plus a checkmark. They can also tap
a number to type it.

**Why this priority**: Logging is only fast in the gym if these controls are quick and hard to
mis-tap. Story 1 is not usable without them.

**Independent Test**: Open a new exercise, set row #3 to 80 kg × 8, tap Sets **+** and confirm
row #4 appears as 80 kg × 8; change Default Reps to 12 and confirm rows #1 and #2 change to 12
while rows #3 and #4 keep 8 (#4 was copied from an edited row, so it counts as edited).

**Acceptance Scenarios**:

1. **Given** an open drawer, **When** the member taps Sets **+**, **Then** a new row is added at the bottom with the same weight and reps as the current last row, not completed.
2. **Given** an open drawer with more than one set, **When** the member taps Sets **−**, **Then** the last row is removed. Sets cannot go below 1 or above 20.
3. **Given** rows where the member has changed the reps of row #2 only, **When** they change Default Reps from 10 to 12, **Then** rows other than #2 show 12 reps and row #2 keeps its value.
4. **Given** a row, **When** the member taps weight **+** or **−**, **Then** the weight changes by 2.5 kg and never goes below 0 kg.
5. **Given** a row, **When** the member taps reps **+** or **−**, **Then** the reps change by 1 and never go below 1.
6. **Given** a row, **When** the member taps the weight value and types 62.5, **Then** the row shows 62.5 kg; a typed weight is accepted in 0.5 kg steps; any other value is rejected with a message and the previous value is kept.
7. **Given** a row, **When** the member taps its checkmark, **Then** the row is shown as completed; tapping again clears it. The completed state is saved with the entry.
8. **Given** any of these changes, **When** it happens, **Then** the footer's total volume, estimated minutes and estimated calories update immediately.

---

### User Story 3 - Find exercises by muscle group or search (Priority: P1)

At the top of the Gym screen a pill bar of muscle groups (Chest, Back, Legs, Shoulders, Arms,
Core, Cardio) stays in view as the list scrolls and can be swiped sideways. A small search box
finds an exercise by name across all groups.

**Why this priority**: The member has to reach the exercise in a couple of taps to log it at
all.

**Independent Test**: Tap **Legs** and confirm the six leg exercises are listed; type "curl"
and confirm Barbell Curl, Hammer Curl and Hamstring Curl appear regardless of the selected group.

**Acceptance Scenarios**:

1. **Given** the Gym screen, **When** the member taps a muscle-group pill, **Then** only exercises in that group are listed and the pill is highlighted.
2. **Given** the list is scrolled, **When** the member looks at the top of the screen, **Then** the pill bar is still visible.
3. **Given** a narrow phone screen, **When** not all pills fit, **Then** the bar can be swiped sideways without the page itself scrolling sideways and without a visible scrollbar.
4. **Given** the member types in the search box, **When** the text matches part of an exercise name (ignoring capitalisation), **Then** matching exercises from every group are listed with their group shown; clearing the search returns to the selected group.
5. **Given** an exercise already logged for the day being viewed, **When** it appears in the list, **Then** it is marked as logged with its set count (for example "3 sets · 1,800 kg").

---

### User Story 4 - Start from last time (progressive overload) (Priority: P2)

When the member opens an exercise they have done before, the drawer starts from what they did
last time, and the header shows "Last: 80kg × 8" so they know what to beat.

**Why this priority**: It saves most of the tapping and is what makes a lifting log useful
week to week, but Story 1 works without it.

**Independent Test**: Log Barbell Squat on one day as 3 × 8 at 80 kg, then open Barbell Squat
on a later day and confirm the drawer starts with 3 sets of 80 kg × 8, none completed, and the
header shows "Last: 80kg × 8".

**Acceptance Scenarios**:

1. **Given** the member logged an exercise on an earlier day, **When** they open it on a day where it is not yet logged, **Then** the drawer starts with the same number of sets and each set's weight and reps from the most recent earlier entry, all marked not completed.
2. **Given** that earlier entry, **When** the drawer opens, **Then** the header shows "Last: {weight}kg × {reps}" using the heaviest set of that entry (ties go to the higher reps, then the earlier set).
3. **Given** the pre-filled drawer, **When** the member changes Default Reps, **Then** all pre-filled rows count as not yet edited and follow the new value.
4. **Given** the member has never logged the exercise, **When** they open it, **Then** no "Last" line is shown and the defaults from Story 1 apply.

---

### User Story 5 - Add an own exercise (Priority: P3)

A member whose gym has a machine that isn't in the library taps **+ Custom Exercise**, enters a
name and picks a muscle group, and can then log it like any preset.

**Why this priority**: Useful but the preset library covers the common lifts.

**Independent Test**: Add "Hip Thrust" under Legs, confirm it appears in the Legs list and in
search, log 3 sets of it, and confirm another member cannot see it.

**Acceptance Scenarios**:

1. **Given** the Gym screen, **When** the member adds a custom exercise with a name and muscle group, **Then** it appears in that group's list and in search, marked as their own.
2. **Given** a name that matches a preset or one of their own exercises (ignoring capitalisation and surrounding spaces), **When** they try to add it, **Then** it is refused with a message. Cardio is not offered as a group, and a 51st own exercise is refused with a message.
3. **Given** a custom exercise, **When** the member renames, moves or removes it, **Then** only future logging is affected; past entries keep the name and group they were saved with.

---

### Edge Cases

- A bodyweight exercise (Pull-Ups, Chest Dips, Hanging Leg Raises) logged at 0 kg: allowed, shown as "BW"; it adds sets, minutes and calories but 0 kg volume. A "Last" line for it reads "Last: BW × 12".
- Cardio exercises (Incline Treadmill Walk, Stairmaster) do not have sets, reps or weight: tapping one opens the drawer with a minutes stepper (±5, tap-to-type) instead of set rows, and calories follow the feature 002 rule for that activity's calories per minute (see FR-016).
- The member saves with no sets ticked as completed: allowed. Completion is a progress aid and does not change totals (see FR-013).
- The member opens the drawer, the local date rolls over at midnight, then they save: the entry goes to the day the drawer was opened for if that day is still editable; otherwise the save is refused with a message and nothing is recorded.
- The member also ticks the generic "Strength training" activity on a day with gym entries: both are allowed and both count; the Strength training card shows a hint such as "Logged in Gym: 24 min" so the member can avoid counting the session twice (FR-025).
- The same exercise logged twice in one day (two separate sessions): there is one entry per exercise per day; the member adds the extra sets to the existing entry.
- The member is offline or the save fails: the drawer stays open with their values and shows an error with a retry; the values stay as a draft (FR-023), so nothing is lost even if they close the drawer.
- A draft exists and the saved entry was changed from another device: opening the exercise shows the draft with a note that a saved version also exists; Save replaces the saved version, **Discard draft** shows it.
- The phone's on-screen keyboard is open while typing a weight: the row being edited and the Save button stay reachable.
- 20 sets of an exercise: the middle of the drawer scrolls; the header and footer stay put and the drawer never exceeds 85% of the screen height.
- A typed reps value of 0, a negative number, a decimal, or a weight over 500 kg: refused with a message; the previous value is kept.

## Requirements *(mandatory)*

### Functional Requirements

**Exercise library**

- **FR-001**: The system MUST provide this built-in exercise library, grouped by muscle group:
  - **Chest**: Bench Press, Incline Dumbbell Press, Cable Flyes, Chest Dips, Machine Chest Press
  - **Back**: Deadlift, Lat Pulldown, Barbell Row, Seated Cable Row, Pull-Ups
  - **Legs**: Barbell Squat, Leg Press, Romanian Deadlift, Leg Extension, Hamstring Curl, Calf Raises
  - **Shoulders**: Overhead Press, Lateral Raises, Face Pulls, Rear Delt Flyes
  - **Arms**: Barbell Curl, Hammer Curl, Tricep Pushdown, Skullcrushers
  - **Core**: Hanging Leg Raises, Cable Crunch
  - **Cardio**: Incline Treadmill Walk, Stairmaster
- **FR-002**: Built-in exercises MUST NOT be editable or removable by members.
- **FR-003**: The Gym screen MUST show a muscle-group selector with Chest, Back, Legs, Shoulders, Arms, Core and Cardio, which stays visible while the exercise list scrolls and scrolls sideways on its own when it does not fit.
- **FR-004**: The Gym screen MUST offer a search that matches any part of an exercise name, ignoring capitalisation, across all groups including the member's own exercises.
- **FR-005**: Members MUST be able to add their own exercises with a name (1–40 characters) and one muscle group other than Cardio (own exercises are always logged as sets; a custom cardio activity uses feature 002's own workouts), unique within their own list and not duplicating a built-in name (ignoring capitalisation and surrounding spaces), and MUST be able to rename, regroup and remove them. A member can have at most 50 own exercises at once (removed ones don't count); adding a 51st is refused with a message. Removing hides the exercise from the list but keeps past entries. A member's own exercises MUST be visible only to that member.

**Drawer and controls**

- **FR-006**: Opening an exercise MUST show a drawer that slides up from the bottom edge, is no taller than 85% of the screen, has rounded top corners, a drag handle, a dimmed backdrop, a fixed header (exercise name, group, "Last" line), a scrollable middle and a fixed footer (totals and Save). It MUST be dismissable by backdrop tap, a downward swipe starting on the drag handle or header, and a close button; dismissing keeps unsaved changes as a draft (FR-023).
- **FR-007**: Every stepper button and the per-set checkmark MUST have a tap area of at least 44 × 44 points and MUST respond on the first tap without a double-tap zoom or delay.
- **FR-008**: Typed number fields MUST NOT cause the page to zoom when focused on iOS Safari, MUST open a decimal keypad for weight and a whole-number keypad for reps and minutes.
- **FR-009**: The drawer MUST provide a Sets stepper (1–20, default 3). Adding a set MUST append a row copying the weight and reps of the last row, not completed. Removing a set MUST remove the last row.
- **FR-010**: The drawer MUST provide a Default Reps stepper (1–100, default 10). Changing it MUST set the reps of every row whose reps the member has not changed by hand in this drawer session. Pre-filled rows count as unedited; a row added by the Sets stepper inherits the edited/unedited state of the row it copied.
- **FR-011**: Each set row MUST show its number (#1, #2, …), a weight control (0–500 kg; ±2.5 kg per tap, floor 0; typed values in 0.5 kg steps), a reps control (1–100; ±1 per tap; whole numbers when typed) and a completed toggle.
- **FR-012**: When the drawer opens for an exercise not yet logged on that day, it MUST pre-fill set count, weights and reps from the member's most recent entry for the same exercise on an earlier day, with all sets not completed, and show "Last: {weight}kg × {reps}" for that entry's heaviest set (ties: higher reps, then lower set number; "BW" for 0 kg). With no earlier entry it MUST use 3 sets × 10 reps × 0 kg and no "Last" line.

**Totals (server-authoritative)**

- **FR-013**: For a strength exercise, the footer and the saved entry MUST compute, over all sets regardless of completed state:
  - **Total volume (kg)** = sum over sets of reps × weight, rounded to one decimal.
  - **Estimated minutes** = sets × 2.5, rounded half up to a whole minute.
  - **Estimated calories** = sets × 15 (2.5 minutes per set × 6 kcal per minute), a whole number.
  Worked examples: 3 sets of 80 kg × 8 → 1,920 kg, 8 min, 45 kcal. 5 sets of 60 kg × 5 → 1,500 kg, 13 min, 75 kcal. 1 set → 3 min, 15 kcal. 4 sets of BW × 12 → 0 kg, 10 min, 60 kcal.
- **FR-014**: The server MUST recompute volume, minutes and calories from the submitted sets and MUST ignore any totals sent by the client; what the footer shows MUST match what the server stores for the same sets.
- **FR-015**: A saved gym entry MUST count toward the day's workout totals (total minutes and total calories burned from feature 002) and therefore toward the calories burned in the food ledger (feature 003) and any later leaderboard that reads those totals. It MUST NOT be counted twice.
- **FR-016**: A cardio exercise MUST be logged as minutes (1–600, default 20, ±5 per tap, tap-to-type) with calories = minutes × that exercise's calories per minute, using the feature 002 duration rules; volume does not apply. The cardio rates are set during planning.

**Saving, editing, days**

- **FR-017**: A member MUST have at most one entry per exercise per day. Saving an exercise already logged that day MUST replace its sets and totals.
- **FR-018**: Each saved entry MUST record the exercise name and muscle group as they were at save time, and for strength exercises each set's number, reps, weight and completed state, plus total volume, estimated minutes and estimated calories. Later changes to a custom exercise MUST NOT change past entries; re-saving an entry on an editable day stores the exercise's current name and group (or keeps the stored ones if the exercise was removed).
- **FR-019**: Members MUST be able to remove a logged gym entry, which removes its minutes and calories from that day's totals.
- **FR-020**: Logging, changing and removing gym entries MUST follow feature 002's day rules: "today" in the member's own timezone, edits allowed only for today and the previous 2 days, older days viewable read-only, all decided by the server.
- **FR-021**: The Gym screen MUST be a "Gym" tab of the Workouts screen (an "Activities | Gym" switch), not a separate top-level navigation item. It MUST show the same day being viewed as the Activities tab (with the same previous/next day navigation and daily totals), and logged gym entries MUST also appear among that day's logged workouts on the Workouts screen, showing name, set count and volume; tapping one there opens its drawer.
- **FR-023**: Unsaved drawer changes MUST be kept as a draft on the member's device, one per exercise and day, surviving the drawer closing, the screen locking and the page reloading. A draft MUST be restored when that exercise is opened for that day, MUST be cleared on successful Save, Remove or **Discard draft**, MUST NOT be sent to the server or count toward any total, and MUST be dropped once its day is outside the edit window. Drafts are not shared across devices.
- **FR-025**: On a day with at least one gym entry, the Activities tab's "Strength training" activity MUST show a hint with that day's total gym minutes. Logging both MUST remain allowed and both MUST count; the server MUST NOT block or merge them.

**Privacy**

- **FR-022**: A member's gym entries, sets, weights and own exercises MUST be visible only to that member. Any later shared figure (such as minutes or calories on a leaderboard) is decided by that feature.
- **FR-024**: The member's AI coach history (feature 004) MUST include each gym entry in the requested range with its exercise name, muscle group, minutes, calories, and for strength exercises its sets (set number, reps, weight, completed) and total volume, and MUST still list other workouts as before. It MUST only ever return the key holder's own entries, and set data MUST NOT be written to logs.

### Key Entities

- **Exercise**: Something a member can log at the gym. Has a name, one muscle group (Chest, Back, Legs, Shoulders, Arms, Core, Cardio), a kind (strength or cardio), and is either built-in or one member's own (own exercises can be removed/hidden). Cardio exercises have a calories-per-minute rate.
- **Gym Entry**: One member did one exercise on one calendar day. A kind of workout entry from feature 002, so it counts in that day's totals. Holds a snapshot of the exercise name and muscle group, and either an ordered list of sets (strength) or minutes (cardio), plus total volume, estimated minutes and estimated calories. At most one per member, exercise and day.
- **Set**: One row in a strength gym entry: set number (1..n, in order), reps, weight in kg (0 = bodyweight), completed yes/no.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can open an exercise they have logged before, tick all its sets and save in under 15 seconds using one thumb.
- **SC-002**: A member can find any built-in exercise and open its drawer in 3 taps or fewer from the Gym screen.
- **SC-003**: In 100% of tested cases the footer's volume, minutes and calories equal the values stored for the same sets and the worked examples in FR-013.
- **SC-004**: In 100% of tested cases a saved gym entry changes that day's total minutes and calories burned (Workouts screen and food ledger) by exactly its own minutes and calories, and removing it reverses that.
- **SC-005**: On a 375-point-wide phone screen, no control in the drawer needs pinch-zoom, the page never scrolls sideways, and focusing a number field never zooms the page.
- **SC-006**: Saving shows the result on screen in under 1 second on a normal connection.
- **SC-007**: A member's gym data is never visible to another member; access checks pass in 100% of tested cases.

## Assumptions

- The input's "Core & Cardio" group is split into the two pills the input also lists: Hanging Leg Raises and Cable Crunch under Core, Incline Treadmill Walk and Stairmaster under Cardio.
- The 2.5 min/set and 6 kcal/min figures are rough estimates (no body weight, rest time or intensity is collected), consistent with feature 002's estimate approach. They count every set, completed or not: the checkmark is a progress aid during the session (confirmed in Clarifications).
- Weights are in kilograms only; pounds are out of scope.
- Per-set rest timers, supersets, plate calculators, personal-record badges, charts and notes are out of scope.
- The leaderboard and scoring formula (PRD §5) do not exist yet; this feature only makes gym work part of the daily workout totals that the leaderboard will read.
- The AI coach's history output gains gym detail (FR-024); no new AI tools are added (for example, the coach cannot log or edit gym entries).
- The app is a web app used in a phone browser; offline logging remains out of scope (feature 002).
- The drawer's "save" is explicit: values are not saved to the account per tap. A half-finished drawer is kept only as an on-device draft (FR-023), which is lost if the browser's site data is cleared.
