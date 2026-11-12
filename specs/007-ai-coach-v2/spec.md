# Feature Specification: AI Coach v2 (full context, AI-adjusted workouts, Pulse Bar)

**Feature Branch**: `007-ai-coach-v2`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "AI Coach v2: expanded MCP tools, AI Pulse Bar on the home screen, AI gym calorie recalculation, body weight in profile, and removal of the built-in activity list. (1) MCP tools: get_full_context, update_workout_log, upsert_workout_log, upsert_food_log, update_workout_calories, post_overall_coach_note (headline ≤ 65 chars, status on_track | needs_attention | pr_alert, ≤ 3 highlights, ≤ 3 action items). (2) Profile bodyWeightKg (default 75), editable in Settings, returned to the AI with each workout log's id, exercise name, muscle group, sets, reps and weight. (3) UI: remove the Coach Note block from Food; add a compact AI Pulse Bar under the weekly date strip on the home screen that expands to a 3-metric strip (net calories, protein, gym volume), highlights and a tickable action checklist; show an 'AI adjusted' badge with one-line reasoning on workouts whose calories the AI changed. (4) Remove the default built-in activities (dancing, HIIT, jump rope and the rest); members' own activities stay."

## Clarifications

### Session 2026-11-12

- Q: Which days may the AI agent change (create, edit or recalculate logs)? → A: The same as the member: today and the 2 previous days.
- Q: When the member changes the sets of an AI-adjusted gym exercise, what happens? → A: The member's edit resets it: the app's own estimate returns and the AI badge disappears.
- Q: Does the structured coach note replace the markdown coach note? → A: Yes. The markdown tool is retired and old markdown notes are no longer shown.
- Q: Which screens show the AI Pulse Bar? → A: Both Workouts tabs (Gym and Activities), under the shared date strip.
- Q: Should `update_workout_log` and `update_workout_calories` be merged? → A: Yes. Only `update_workout_calories` (log id, calories, duration, reason) is offered.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the AI coach's verdict at a glance (Priority: P1)

A member opens the app (landing on the Workouts › Gym screen). Directly under the weekly date
strip, on both the Gym and Activities tabs, is a slim "AI Pulse Bar": a sparkle icon, a one-line headline from their AI coach (for
example "Chest PR today, protein 30 g short"), a colored edge that tells them at a glance whether
they are on track, need attention, or hit a personal record, and a "View" chevron. Tapping it
expands a compact card with three numbers for the day (net calories, protein eaten, gym volume),
up to three short highlights, and up to three action items they can tick off as they do them.
The big coach-note block that used to sit on the Food screen is gone.

**Why this priority**: This is the visible payoff of the AI coach and the main UI change; it
replaces the existing note display, so the old block can only be removed once this exists.

**Independent Test**: Post a structured note for today through the AI connection, open the home
screen, check the bar shows the headline and status color, expand it, tick an action item,
reload, and confirm the tick is still there.

**Acceptance Scenarios**:

1. **Given** the AI coach posted a note for the selected day with status "needs_attention", **When** the member opens the Gym or Activities tab for that day, **Then** a single-line bar under the date strip shows the headline (cut off with an ellipsis if it does not fit) with the "needs attention" accent and a "View" control.
2. **Given** the bar is collapsed, **When** the member taps it, **Then** it expands (an inline card on wide screens, a bottom sheet on phones) showing net calories, protein (g) and gym volume (kg) for that day, the highlights and the action items; tapping again or closing the sheet collapses it.
3. **Given** the expanded card shows an unticked action item, **When** the member ticks it, **Then** it shows as done immediately and is still done after a reload or on another device.
4. **Given** no note exists for the selected day, **When** the member opens the Gym screen, **Then** no Pulse Bar is shown and the layout does not shift or leave a gap.
5. **Given** the member logs more food or sets after the note was posted, **When** they expand the card, **Then** the three metrics reflect the current logged data, not the values at the time the note was written.
6. **Given** any day, **When** the member opens the Food screen, **Then** no coach-note block is shown there.

---

### User Story 2 - AI recalculates gym calories realistically (Priority: P1)

The app's built-in gym estimate is deliberately simple (a fixed amount per set). The member's AI
agent reads their body weight and the actual sets, reps and weights, works out a more realistic
calorie burn and duration for an exercise, and saves it with a one-line reason. On the logged
exercise the member sees the new calorie figure with a subtle "✨ AI adjusted" badge; tapping the
badge shows the reason (for example "6.0 MET compound lift + rest intervals @ 78 kg"). The day's
burned total, the week strip and the Food screen's "burned" figure all use the adjusted number.

**Why this priority**: It is the main reason the member wants richer AI access: more truthful
burned calories feed directly into their daily calorie balance.

**Independent Test**: Log a bench press with three sets, have the AI call the calorie update for
that log with new calories, duration and a reason, then check the exercise, the day total, the
week strip and the Food ledger all show the new numbers, and the badge shows the reason.

**Acceptance Scenarios**:

1. **Given** a logged gym exercise on an editable day, **When** the AI submits updated calories, duration and a reason for that log, **Then** the entry stores the new calories, duration and reason, and the day's burned total and the Food ledger's burned/remaining figures change accordingly.
2. **Given** an AI-adjusted entry, **When** the member views it, **Then** an "✨ AI adjusted" badge appears next to its calories, and tapping it reveals the one-line reason.
3. **Given** an AI-adjusted gym entry, **When** the member later changes its sets and saves, **Then** the app's own estimate replaces the AI figure and the badge disappears (the member's latest edit always wins).
4. **Given** a log id that does not exist, belongs to someone else, or is on a day outside the edit window, **When** the AI submits an update, **Then** it is rejected with a clear message and nothing changes.
5. **Given** calories or duration outside the allowed ranges, or a missing/overlong reason, **When** the AI submits, **Then** it is rejected with a message naming the problem.

---

### User Story 3 - AI reads the whole picture in one call (Priority: P2)

The member's AI agent asks for "full context" and receives, in one answer: the member's profile
figures (body weight, calorie target, protein target), every workout log in the requested window
(activities and gym exercises, each with its log id, name, muscle group, sets, reps, weight and
volume), every food log in the window, daily totals, and the current activity streak. The
existing history tool also gains body weight and log ids so older agent setups keep working.

**Why this priority**: The calorie recalculation and the structured note both depend on the
agent having body weight and log ids; one call also reduces agent round trips.

**Independent Test**: With a known set of logs, call full context for the last 7 days and check
every log appears with its id and details, body weight is present (75 if never set), and the
streak matches what the app shows.

**Acceptance Scenarios**:

1. **Given** a member who never set a body weight, **When** the AI requests full context, **Then** body weight is reported as 75 kg and marked as the default.
2. **Given** a window of up to 31 days ending today, **When** the AI requests full context, **Then** it receives profile figures, all workout and food logs in that window with their ids, daily totals and the current streak.
3. **Given** no window is given, **When** the AI requests full context, **Then** the last 7 days including today are returned.
4. **Given** any full-context response, **Then** it contains no data about other members except what other members may already see in the app (no calorie targets, body weight, timezones or usernames of others).

---

### User Story 4 - AI logs and corrects entries for the member (Priority: P2)

The member tells their AI agent "I did bench 3×8 at 60 kg and had two eggs for breakfast". The
agent creates (or updates) the gym exercise entry with its sets and the food entry for the right
meal and day, exactly as if the member had logged them in the app.

**Why this priority**: Useful hands-free logging, but members can already log manually.

**Independent Test**: Have the AI upsert a gym exercise with sets and a food entry for today, then
open the app and confirm both appear with the same totals the app would have computed; upsert the
same exercise again with changed sets and confirm it updated rather than duplicated.

**Acceptance Scenarios**:

1. **Given** today has no bench press entry, **When** the AI upserts bench press with three sets, **Then** a gym entry appears on today's Gym screen with those sets, and its calories, duration and volume are the app's own computed values.
2. **Given** today already has a bench press entry, **When** the AI upserts bench press again, **Then** the existing entry is replaced (one entry per exercise per day, as in the app) and any AI-adjusted calories on it are cleared.
3. **Given** a food name and servings from the built-in list or the member's own foods, **When** the AI upserts a food log, **Then** calories and macros follow servings × that food's rate, as in the app; **given** a free-form food, **Then** the AI-supplied calories (and all-or-none macros) are stored.
4. **Given** an existing food log id, **When** the AI upserts with that id, **Then** that entry is updated in place.
5. **Given** a day outside the edit window, an unknown exercise or food, or invalid numbers, **When** the AI writes, **Then** the write is rejected with a clear message.

---

### User Story 5 - Member sets their body weight (Priority: P2)

In Settings the member sees a "Body weight (kg)" field, prefilled with their saved value or
showing 75 kg as the default, and can change it.

**Why this priority**: Required for realistic AI calorie estimates; small and self-contained.

**Independent Test**: Change body weight in Settings, save, reload, and confirm both the field and
the AI's full context show the new value.

**Acceptance Scenarios**:

1. **Given** a member who never set a body weight, **When** they open Settings, **Then** the field shows 75 and indicates it is a default.
2. **Given** a valid weight (20–400 kg, up to one decimal), **When** they save, **Then** it is stored and shown on reload.
3. **Given** an invalid weight, **When** they save, **Then** a message explains the allowed range and nothing is stored.
4. **Given** any other member, **When** they view this member anywhere in the app, **Then** body weight is never shown.

---

### User Story 6 - Activities list without built-in activities (Priority: P3)

The Activities tab no longer offers the 12 built-in activities (walking, running, cycling,
swimming, yoga, strength training, HIIT, jump rope, hiking, stretching, dancing, team sport). It
shows only the member's own activities, with a clear way to create one when they have none.

**Why this priority**: Clean-up requested by the product owner; gym logging now covers strength
work, and members define the cardio they actually do.

**Independent Test**: Open Activities as a member with no own activities and confirm no built-in
items appear and an empty state links to creating one; confirm past days that had built-in
activities still show them and still count in totals.

**Acceptance Scenarios**:

1. **Given** any member, **When** they open the Activities tab, **Then** only their own activities are listed.
2. **Given** a member with no own activities, **When** they open the Activities tab, **Then** an empty state explains how to add one and links to the "My activities" screen.
3. **Given** a past day with a logged built-in activity (e.g. "Running"), **When** the member views that day, **Then** the entry is still shown with its saved name, minutes and calories and still counts in that day's totals, the week strip, the food ledger and AI history.
4. **Given** a past built-in activity entry still within the edit window, **When** the member un-ticks it, **Then** it is removed as before; it cannot be re-added from a list.
5. **Given** a member creating an own activity named like a former built-in (e.g. "Running"), **When** they save, **Then** it is accepted (former built-in names no longer block own names).

---

### Edge Cases

- AI posts a note for a past day: the Pulse Bar shows it when that day is selected in the date strip; each day has at most one note, and a new post replaces the old one and resets its ticks.
- AI posts a note whose headline is longer than 65 characters, more than 3 highlights or action items, empty strings, or an unknown status: rejected with a message naming the field.
- Headline fits in 65 characters but not on a narrow phone: shown on one line with an ellipsis; the full headline appears in the expanded card.
- Member ticks an action item while offline or the save fails: the tick is reverted and a short error is shown.
- Day has no food and no gym entries: metrics show 0 rather than blanks; net calories may be negative.
- AI adjusts calories on an activity entry (not gym): allowed; same badge and reason behavior. Member editing that activity's minutes clears the AI reason.
- AI and member edit the same entry at the same moment: the member's edit always applies; an AI write based on data read before the member's edit is rejected and told to re-read. Nothing is ever half-applied.
- Pending photo meals: still excluded from totals and from the Pulse metrics, as today.
- AI tries to act on another member's log id: treated as not found; it never learns that the id exists.
- Body weight is changed after an AI adjustment: existing adjusted entries keep their stored figures.
- AI write rate: all new tools share the existing per-member AI request limit.
- Old AI agents still calling the markdown note tool: they get a clear message to use the new structured note tool instead.

## Requirements *(mandatory)*

### Functional Requirements

**Profile**

- **FR-001**: The member profile MUST hold an optional body weight in kg (20–400, at most one decimal). When unset, every reader MUST treat it as 75 kg and indicate that it is the default.
- **FR-002**: Members MUST be able to view and change their body weight in Settings.
- **FR-003**: Body weight MUST never be included in any response about another member.

**AI read access**

- **FR-004**: The AI connection MUST offer a "get full context" tool that returns, for a window of at most 31 days ending no later than the member's today (default: the last 7 days including today): profile figures (body weight and whether it is the default, calorie target, protein target, timezone, today), every workout log with its log id, date, kind, name, minutes, calories, AI reason if any, and for gym lifts muscle group, each set's reps, weight and completion, and volume; every food log with its log id, date, meal, name, servings, calories, macros and photo status; daily totals (eaten, burned, net, protein, gym volume); and the member's current activity streak.
- **FR-005**: The existing history tool MUST additionally return body weight and each workout and food log's id, and keep its current behavior otherwise.
- **FR-006**: Leaderboard or squad standing data MUST NOT be returned until the scoring feature defines it; the response MUST say that it is not available.

**AI write access**

- **FR-007**: All AI write tools MUST act only on the key's own member, MUST only change days inside the member's edit window (today and the previous 2 days, in the member's timezone), and MUST validate input with the same rules the app uses.
- **FR-008**: An "update workout calories" tool MUST take a log id, new calories (1–5,000), new duration in minutes (1–600) and a reason (1–120 characters, one line); it MUST set the entry's calories and duration and store the reason as the entry's AI note. It is the only AI tool that adjusts an existing workout's calories or duration (no separate "update workout log" tool).
- **FR-009**: Gym volume MUST NOT be settable by the AI directly; it is always derived from the sets.
- **FR-010**: An "upsert workout log" tool MUST create or replace a gym exercise entry for a date (built-in or member's own exercise, identified by id or exact name) with its sets (reps, weight, completion) or, for cardio, its minutes; calories, duration and volume MUST be computed by the app's own gym rules, and any previous AI note on that entry MUST be cleared.
- **FR-011**: An "upsert food log" tool MUST create a food entry for a date and meal, or update one by log id; list foods (built-in or the member's own) follow servings × the food's rate, free-form foods take the given calories and all-or-none macros, exactly as in the app. Photo entries MUST NOT be changed by this tool (the existing photo estimate flow handles them).
- **FR-012**: Whenever a workout entry's calories change (by AI or member), the day's burned total, the week strip, the Food ledger's burned/net/remaining figures and AI history MUST reflect the new value on the next read; no separate stored totals may go stale.
- **FR-013**: Any member edit to a workout entry's sets, minutes or calories MUST replace AI-adjusted figures with the member's/app's values and clear the AI note.
- **FR-014**: Concurrent AI and member writes to the same entry MUST NOT both partly apply. Member writes always apply; an AI change to an existing entry MUST be rejected with a conflict message if the entry changed after the AI read it.

**Structured coach note**

- **FR-015**: A "post overall coach note" tool MUST save, for a date (today or up to 30 days ago), a note with a headline (1–65 characters), a status (on track | needs attention | PR alert), 1–3 highlights (each 1–120 characters) and 0–3 action items (each 1–80 characters). One note per day; posting again replaces it and resets all ticks.
- **FR-016**: The previous markdown note tool MUST be retired: calls return a message pointing to the new tool. Existing markdown notes are no longer displayed.
- **FR-017**: Members MUST be able to tick and un-tick each action item; the tick state MUST be saved for the member and survive reloads and other devices.

**Home screen and Food screen**

- **FR-018**: Both Workouts tabs (Gym, the app's landing screen, and Activities) MUST show the Pulse Bar directly under the weekly date strip when a note exists for the selected day, and nothing when none exists. The bar MUST be a single line 48–56 px tall with rounded corners, a subtle dark translucent background, an accent edge color per status, a sparkle icon, the headline truncated with an ellipsis, and a "View" chevron.
- **FR-019**: Tapping the bar MUST expand it in place (wide screens) or open a bottom sheet (phones), showing: a 3-metric strip of net calories, protein eaten (g) and gym volume (kg) for that day computed from current data; the highlights as short bullets; and the action items as a checklist. The expanded view MUST be keyboard and screen-reader accessible (button with expanded state, labelled checkboxes, sheet closable with Escape).
- **FR-020**: The Food screen MUST no longer show the coach-note block.
- **FR-021**: Workout entries with an AI note MUST show an "✨ AI adjusted" badge next to their calories on both the Gym and Activities screens; activating the badge MUST reveal the one-line reason.

**Activities**

- **FR-022**: The Activities checklist MUST list only the member's own activities; the 12 built-in activities MUST no longer be offered anywhere for new logging.
- **FR-023**: Past entries of former built-in activities MUST keep their saved name, minutes and calories, keep counting everywhere they counted before, and remain removable inside the edit window.
- **FR-024**: Own activity names MUST no longer be checked against former built-in names.
- **FR-025**: With no own activities, the Activities tab MUST show an empty state linking to "My activities".

**Privacy and logging**

- **FR-026**: Notes, reasons, action items, body weight and entries MUST never be written to logs.

### Key Entities

- **Member profile**: gains body weight (kg, optional; 75 kg default when unset).
- **Workout entry** (activity or gym): gains an optional AI note (one-line reason) that marks its calories/duration as AI adjusted.
- **Overall coach note**: one per member per day; headline, status, highlights (≤ 3), action items (≤ 3) each with a done flag, saved time.
- **Full context**: a read-only bundle assembled per request (profile figures, logs with ids, daily totals, streak); not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member sees today's coach verdict without scrolling or leaving the landing screen, and the bar never takes more than 56 px of height while collapsed.
- **SC-002**: A member can expand the bar and tick an action item in 2 taps.
- **SC-003**: After an AI calorie adjustment, 100% of the places that show the day's burned calories (exercise row, day total, week strip, Food ledger, AI history) agree on the next view.
- **SC-004**: An AI agent can gather everything it needs for a daily review (profile, body weight, all logs with ids, totals, streak) in 1 request instead of several.
- **SC-005**: Every AI write that the app would reject from the member (wrong day, bad numbers, unknown item, someone else's log) is also rejected for the AI.
- **SC-006**: No built-in activity appears for new logging, and no historic day's totals change because of their removal.

## Assumptions

- "Main home screen" means the Workouts area, which is where `/` lands; the Pulse Bar sits on both Workouts tabs and is not added to Food.
- Scoring and leaderboard are not built (PRD §5 is a later feature), so "squad standing" is left out of full context and the note; "keep the score in sync" is met by deriving totals on read. When scoring ships, it reads the same entries.
- The streak in full context is the existing provisional rule (consecutive days with at least one workout).
- The AI edit window matches the member's (today + 2 previous days), as for photo estimates in feature 005; notes may still be posted for up to 30 days back.
- "Food item" in the upsert tool means a logged food entry on a day, not the member's own-food catalog.
- The requested `update_workout_log` is merged into `update_workout_calories` (see Clarifications); `totalVolumeKg` is not accepted because volume is always derived from sets.
- The new structured note replaces the markdown note (the only place that showed it is removed); old notes are left in storage but not shown.
- Metrics in the expanded card are computed from current data on view, not copied from the note.
- Body weight range 20–400 kg is chosen to cover all adults while catching typos.
- The existing per-member AI rate limit (60 requests/min) covers the new tools.
