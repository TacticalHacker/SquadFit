# Feature Specification: Squad Leaderboard (weekly streaks, PRs, consistency, activity feed)

**Feature Branch**: `010-squad-leaderboard`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Squad leaderboard. Signed-in members see each other's weekly streaks, personal records and consistency, as friendly motivation. One global squad for now, structured so more squads can be added later. Privacy opt-out from the board, opt-in body weight sharing for relative strength. Weekly streak against a per-member weekly target (default 3, 1–7) in the member's own timezone; PRs (heaviest weight, Epley e1RM for 1–10 reps; first log is a baseline; suspicious >50% jumps excluded and flagged for the member to confirm); consistency over the last 4 weeks and weekly volume. /squad page with This week · Last 30 days · All time, boards Streaks, PRs, Consistency, Lift board (with relative strength), ties share a rank, current member highlighted. Activity feed of the last 20 items with one toggleable high-five per member. Stats computed on the server when workouts are saved (UI and AI agent alike), backfill from history without flooding the feed."

## Clarifications

### Session 2026-11-18

- Q: Should a set be flagged only when the jump is both more than 50% and more than a fixed amount? → A: Yes: flagged only when it is more than 50% AND more than 20 kg above the previous best (weight or estimate).
- Q: What happens to old sets that break the jump rule when the backfill runs? → A: Trust history: the backfill never flags; only sets saved after launch can be flagged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who is keeping their weekly streak (Priority: P1)

A member taps "Squad" in the main navigation and lands on the squad page, showing the Streaks
board. Each row shows a rank, the member's avatar or initials, their name, their current weekly
streak as a large number, and their best streak as a small muted figure. The current, unfinished
week shows as a small progress indicator ("2/3 this week"). The member's own row is highlighted.
Streaks count weeks, not days, so planned rest days never break them: a week counts when the
member logged a workout on at least their weekly target number of days.

**Why this priority**: Weekly streaks are the core motivation loop the PRD asks for (§3.4) and the
smallest slice that gives the squad page a reason to exist.

**Independent Test**: With two members who logged workouts on 3 different days in each of the
last 2 full weeks and 1 day this week, open the squad page and check both show a current streak
of 2 with "1/3" in progress; delete one member's workout from last week (inside the edit window)
and confirm their streak drops accordingly.

**Acceptance Scenarios**:

1. **Given** a member with a weekly target of 3 who logged workouts on 3 different days in each of the last 4 full weeks, **When** any member opens the Streaks board, **Then** that member shows a current streak of 4.
2. **Given** a member who logged 2 workouts on the same day, **When** workout days are counted, **Then** that day counts once.
3. **Given** a member with a 5-week streak who has logged 1 workout so far in the current week, **When** the board is shown, **Then** the current streak is still 5 and the current week shows "1/3" in progress.
4. **Given** a member whose streak was 5 and who missed their target last full week, **When** the board is shown, **Then** the current streak is 0 and the best streak is still 5.
5. **Given** two members with the same current and best streak, **When** the board is ranked, **Then** they share the same rank and the next member's rank skips accordingly (1, 1, 3).
6. **Given** a member in a timezone ahead of UTC who logs a workout at 00:30 on a Monday local time, **When** weeks are computed, **Then** the workout counts in the week that starts that Monday, not the previous week.

---

### User Story 2 - Celebrate personal records (Priority: P1)

When a member saves a set that beats their previous best for that exercise (heavier weight, or a
higher estimated one-rep max), it counts as a personal record. The PRs board ranks members by
how many PRs they set in the selected period (This week · Last 30 days · All time); tapping a row
expands it to list which lifts and numbers. The very first time a member logs an exercise only
sets their baseline and is not a PR.

**Why this priority**: PRs are the most motivating moments between gym buddies and feed the
activity feed (Story 4).

**Independent Test**: Log bench press 60 kg × 8 for a member who has never logged bench, confirm
no PR; the next session log 65 kg × 5, confirm one PR appears on the PRs board for "This week"
with the lift listed when the row is expanded.

**Acceptance Scenarios**:

1. **Given** a member who has never logged an exercise, **When** they save their first sets for it, **Then** no PR is recorded and those sets become the baseline.
2. **Given** a member whose best bench press is 60 kg, **When** they save a completed set of 62.5 kg × 3, **Then** one bench press PR is recorded for that day.
3. **Given** a member whose best estimated one-rep max for an exercise is 80 kg, **When** they save 70 kg × 6 (estimate 84 kg), **Then** one PR is recorded even though the weight itself is not heavier.
4. **Given** a set of 12 reps, **When** the estimated one-rep max is computed, **Then** that set is ignored for the estimate (only 1–10 reps count) but can still set a heaviest-weight PR.
5. **Given** a member who sets a PR and then, the next day (inside the edit window), corrects the weight down so it no longer beats the old best, **When** the board and feed are next shown, **Then** that PR and its feed item no longer appear.
6. **Given** sets marked as not completed, or bodyweight sets (0 kg), **When** PRs are computed, **Then** those sets are ignored.

---

### User Story 3 - Suspicious jumps are held back until confirmed (Priority: P2)

If a saved set is more than 50% and more than 20 kg heavier (by weight or estimated one-rep max)
than the member's previous best for that exercise, it is treated as a likely typo: it is not counted as a PR or on
the Lift board, and the member sees an "Unusual jump, check this set" note on that exercise in
their gym drawer with a "Looks right" button. Confirming makes it count; editing the set fixes it
the usual way. Nothing is ever deleted automatically.

**Why this priority**: Keeps the board fair and trustworthy without punishing honest members;
builds on Story 2.

**Independent Test**: For a member whose best squat is 80 kg, save 140 kg × 5; check the PRs and
Lift boards ignore it and the drawer shows the note; tap "Looks right" and check the PR now
appears.

**Acceptance Scenarios**:

1. **Given** a best of 80 kg, **When** the member saves 125 kg × 1 (more than 50% over), **Then** no PR is recorded, the set is flagged, and the gym drawer for that exercise and day shows the "Unusual jump" note.
2. **Given** a flagged set, **When** the member taps "Looks right", **Then** the set counts toward PRs and the Lift board and the note disappears.
3. **Given** a flagged set, **When** the member edits it to 85 kg, **Then** the flag clears and 85 kg counts as a normal PR.
4. **Given** a member's first-ever log of an exercise, **When** it is saved, **Then** it is never flagged (there is no previous best to compare against).
5. **Given** a best of 20 kg, **When** the member saves 32.5 kg × 5 (+62% but only +12.5 kg), **Then** it is not flagged and counts as a PR.

---

### User Story 4 - Activity feed with high-fives (Priority: P2)

Below the boards, the squad page shows the 20 most recent squad events, newest first:
"Arjun hit a bench press PR: 85 kg × 5 (e1RM 99 kg)", "Priya completed week 6 of her streak",
"Rahul logged his first workout". Each item has a high-five button with a count; a member can
give one high-five per item and tap again to take it back.

**Why this priority**: Turns numbers into social encouragement; depends on Stories 1–2 for
events.

**Independent Test**: Have member A set a PR; as member B open the squad page, see the item,
high-five it (count 1), tap again (count 0).

**Acceptance Scenarios**:

1. **Given** a member sets a PR, **When** anyone in the squad opens the squad page, **Then** a PR item for it appears at the top of the feed.
2. **Given** a member reaches their weekly target, completing week N of their current streak, **When** the feed is shown, **Then** a "completed week N of their streak" item appears once for that week.
3. **Given** a member saves their first-ever workout, **When** the feed is shown, **Then** a "logged their first workout" item appears.
4. **Given** member B has high-fived an item, **When** B taps the high-five again, **Then** the reaction is removed and the count goes down by one; B can never add two high-fives to the same item.
5. **Given** an event later stops being true (the PR or workout was edited away inside the edit window), **When** the feed is shown, **Then** that item is gone.

---

### User Story 5 - Consistency board and weekly volume (Priority: P3)

The Consistency board ranks members by the share of the last 4 completed weeks in which they hit
their weekly target, then by workouts this week. Each row shows the percentage large, with
"workouts this week / target" and this week's lifting volume muted.

**Why this priority**: A gentler ranking that rewards showing up; reuses the week math of
Story 1.

**Independent Test**: For a member who hit the target in 3 of the last 4 full weeks and has 2 of
3 workouts this week, check the row shows 75% and "2/3".

**Acceptance Scenarios**:

1. **Given** a member who hit their target in 3 of the last 4 completed weeks, **When** the Consistency board is shown, **Then** their figure is 75%.
2. **Given** two members both at 75%, **When** ranked, **Then** the one with more workouts this week ranks higher; if that also ties, they share a rank.
3. **Given** a member who joined 2 weeks ago, **When** consistency is computed, **Then** only completed weeks since they joined count (2 of 2 hit = 100%), and with no completed week yet the figure shows "—" and ranks last.

---

### User Story 6 - Lift board with optional relative strength (Priority: P3)

The Lift board lets a member pick an exercise (Bench Press, Barbell Squat, Deadlift and Overhead
Press by default, plus any built-in exercise that at least 2 visible members have logged) and
ranks members by their best estimated one-rep max for it in the selected period. A "Relative"
toggle divides each estimate by body weight, but only for members who have a body weight saved
and chose to share it; everyone else shows "—" on that toggle and is listed after the ranked
members, never ranked as zero.

**Why this priority**: Fun head-to-head comparison; depends on Story 2's estimates.

**Independent Test**: With two members who logged bench, one sharing body weight 80 kg with an
e1RM of 100 kg, toggle Relative and check that member shows 1.25× and the other shows "—" below.

**Acceptance Scenarios**:

1. **Given** members who logged bench press, **When** the Lift board for Bench Press is shown, **Then** members are ranked by their best estimated one-rep max in the period, with the top set shown as the secondary figure.
2. **Given** a member's own custom exercise, **When** the exercise picker is shown, **Then** it is never offered (own exercises are private to each member).
3. **Given** Relative is on, **When** a member has not opted in to share body weight, **Then** their row shows "—", is unranked, and their body weight is not revealed.
4. **Given** a member never logged the selected exercise, **When** the board is shown, **Then** they are not listed on it.

---

### User Story 7 - Control my visibility and target (Priority: P1)

In Settings, a member can set their weekly workout target (1–7, default 3), turn off "Show me on
the squad leaderboard" (default on), and turn on "Share my body weight for relative strength"
(default off).

**Why this priority**: Privacy controls must exist before any member data is shown to others.

**Independent Test**: Turn off visibility for member A; as member B check A appears on no board
and in no feed item; as A check the squad page still opens and A can see everyone else.

**Acceptance Scenarios**:

1. **Given** a member turns off "Show me on the squad leaderboard", **When** any other member views boards or the feed, **Then** that member and all their feed items are absent, and ranks are computed without them.
2. **Given** a hidden member, **When** they open the squad page, **Then** they can see the boards and feed, see a note that they are hidden, and their own stats are shown to them but not ranked.
3. **Given** a member changes their weekly target from 3 to 4, **When** stats are next shown, **Then** the current and future weeks use 4, and past weeks keep the target that applied when they ended.
4. **Given** a member turns visibility back on, **When** others view the board, **Then** they reappear with their full history, including feed items created while hidden.

---

### Edge Cases

- A member with no workouts at all: shown on Streaks with 0 and on Consistency with "—"; never on PRs or Lift boards.
- Empty boards show friendly text, for example "No PRs this week yet. Go lift something heavy."
- A member changes their timezone: past weeks are not recomputed retroactively in a way that changes completed weeks' days; weeks from the change onward use the new timezone.
- Two members tie on every ranking key: same rank, listed alphabetically by display name.
- A removed own exercise keeps its PR history; logs of exercises from the retired built-in activity list count as workout days but never as PRs.
- Workouts saved by the member's AI agent count exactly like ones saved in the app (streaks, PRs, feed items, flags).
- The only possible days for a change are the edit window (today and 2 previous days), so a completed week can change only while its last days are still editable.
- Backfill on launch computes streaks, bests and historical PR counts but creates no feed items and flags no sets; only sets saved after launch can be flagged.

## Requirements *(mandatory)*

### Functional Requirements

**Access & privacy**

- **FR-001**: The squad page, boards and feed MUST be available only to signed-in members with a completed profile; anonymous requests MUST receive no squad data, and the public landing page MUST NOT show any of it.
- **FR-002**: Boards and feed MUST show other members only by display name and avatar (or initials). They MUST NOT reveal username, email, timezone, calorie target, food, calories or body weight (body weight only as a relative-strength ratio, and only per FR-022).
- **FR-003**: Each member MUST have a "Show me on the squad leaderboard" setting (default on). Hidden members MUST be excluded from all boards, ranks and feed items shown to others; they can still view the squad page, and their own row is shown to them unranked.
- **FR-004**: Each member MUST have a "Share my body weight for relative strength" setting (default off).
- **FR-005**: All members with a completed profile belong to one squad. Every squad query and stored squad item MUST be scoped by a squad identifier so further squads can be added later without migrating data.

**Weekly streaks**

- **FR-006**: Each member MUST have a weekly workout target, an integer from 1 to 7, default 3, editable in Settings.
- **FR-007**: A workout day is a calendar day (in the member's timezone) with at least one workout entry: a gym strength entry with at least one completed set, a gym cardio entry, or an Activities entry. Several entries on one day count as one day.
- **FR-008**: Weeks run Monday to Sunday in the member's own timezone. A week is complete-and-hit when its workout days ≥ the target that applied to that week.
- **FR-009**: Current streak = number of consecutive hit weeks ending with the most recent ended week, plus the current week if it is already hit. The current week, while not yet hit, MUST NOT break the streak and is shown as in progress ("n/target").
- **FR-010**: Best streak = the longest run of consecutive hit weeks ever (including the current week once hit).
- **FR-011**: The Streaks board MUST rank by current streak, then best streak.

**Personal records**

- **FR-012**: A working set is a completed set with at least 1 rep and a weight above 0 kg. Only working sets count for PRs, estimates and volume.
- **FR-013**: For each member and exercise the system MUST track the heaviest working-set weight and the best estimated one-rep max, where the estimate = weight × (1 + reps / 30), computed only for sets of 1 to 10 reps.
- **FR-014**: Exercises are matched by their identity (built-in or the member's own custom exercise), not by name.
- **FR-015**: Exercise entries are processed in date order. The first day a member logs an exercise sets the baseline and produces no PR. On each later day, if the day's best weight beats the previous heaviest, or the day's best estimate beats the previous best estimate, that day has one PR for that exercise (at most one PR per exercise per day).
- **FR-016**: A set whose weight or estimate is both more than 50% and more than 20 kg above the member's previous best for that exercise MUST be flagged as unusual, excluded from PRs, bests and the Lift board, and shown to the member with an "Unusual jump, check this set" note and a "Looks right" action. Confirming MUST make it count; editing the entry clears the flag and re-evaluates. Flagged entries are never deleted.
- **FR-017**: The PRs board MUST rank by the number of PRs in the selected period, with each row expandable to list the exercise, the set and the estimate for each PR. Members with no PRs in the period are not listed.

**Consistency & volume**

- **FR-018**: Consistency = share of the last 4 completed weeks (or fewer, counting only weeks since the member joined) in which the target was hit, shown as a whole percentage; with no completed week it is "—".
- **FR-019**: Weekly volume = sum of weight × reps over working sets in the member's current week.
- **FR-020**: The Consistency board MUST rank by consistency, then workouts this week; "—" ranks last.

**Lift board**

- **FR-021**: The Lift board MUST offer Bench Press, Barbell Squat, Deadlift and Overhead Press, plus any other built-in exercise logged by at least 2 visible members, and rank members by their best estimated one-rep max for it in the selected period. Own custom exercises are never offered.
- **FR-022**: A Relative toggle MUST show estimate ÷ body weight (2 decimals, e.g. "1.25×") only for members with a saved body weight who opted in under FR-004; all others show "—" and are listed unranked after the ranked members.

**Board presentation**

- **FR-023**: The squad page MUST offer a period toggle (This week · Last 30 days · All time) that applies to the PRs and Lift boards; the Streaks and Consistency boards are period-independent and say so. "This week" and "Last 30 days" are evaluated in each member's own timezone.
- **FR-024**: Every row MUST show rank, avatar or initials, display name, the main figure large with tabular numerals and a muted secondary figure. The viewer's own row MUST be highlighted. Ties on all ranking keys MUST share a rank (1, 1, 3) and be ordered by display name.
- **FR-025**: Each board MUST show a friendly empty state when there is no data, and the page MUST be readable on a phone without horizontal scrolling.
- **FR-026**: The main navigation MUST include a "Squad" item; the landing page's Squad preview loses its "Coming soon" tag.

**Activity feed**

- **FR-027**: The feed MUST show the 20 most recent visible squad events, newest first, of three kinds: PR (exercise, set, estimate), streak week completed (week number), first workout ever.
- **FR-028**: Feed events MUST be derived from the same recomputation as the stats: an event that stops being true after an edit or delete MUST disappear, and re-saving the same data MUST NOT create duplicates.
- **FR-029**: Each feed item MUST show a high-five count and let each member add or remove exactly one high-five of their own; members may high-five their own items.

**Computation**

- **FR-030**: Stats and feed events MUST be computed on the server whenever a member's workout entries change (save or delete through the app or through the member's AI agent), never by the client.
- **FR-031**: A one-off operator backfill MUST compute stats for every member from their existing history, MUST NOT create any feed items, MUST NOT flag any historical set (history is trusted as logged), and MUST mark every PR found as historical so it does not reappear in the feed later. It MUST be safe to run more than once.
- **FR-032**: The streak shown on the member's own Workouts screens and the streak given to their AI agent MUST be the weekly streak from FR-009 (with the in-progress "n/target"), replacing the provisional daily streak.

### Key Entities

- **Member squad settings**: weekly target (1–7), visible on leaderboard (yes/no), share body weight (yes/no); part of the member's profile.
- **Member stats**: per member, derived from workout entries: current and best streak, current-week workout days and target, per-week hit history, consistency, weekly volume, and per exercise the heaviest weight, best estimate, last and per-day PRs; plus flagged sets awaiting confirmation.
- **Squad**: a group of members; for now exactly one, containing every member with a completed profile.
- **Feed event**: squad, member, kind (PR, streak week, first workout), event date, the figures shown, and a stable identity so recomputation updates rather than duplicates it.
- **High-five**: one per (feed event, member).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in member can open the squad page and see all four boards and the feed in under 2 seconds on a phone connection.
- **SC-002**: After saving a workout (in the app or via the AI agent), the member's streak, PRs and feed items are up to date the next time any member opens the squad page.
- **SC-003**: 100% of the listed test cases pass: weekly streak across a timezone boundary, a missed week breaking the streak, the in-progress week not breaking it, first log not being a PR, the 10-rep estimate cutoff, suspicious-jump filtering, privacy opt-out hiding a member, and ties sharing a rank.
- **SC-004**: An anonymous visitor cannot obtain any squad figure or member name from any page or request.
- **SC-005**: After the backfill, every existing member's streak and best lifts match a manual count of their history, and the feed is empty.
- **SC-006**: The squad page has no horizontal scrolling at 320 px width.

## Assumptions

- Exactly one squad today (about 3 members, PRD §5.2); performance targets assume tens of members, not thousands.
- The member's timezone is already stored on their profile (set during setup, editable in Settings), so no browser detection is added.
- Input validation already rejects 0 reps and weights above 500 kg; only the >50% jump rule is new filtering.
- "Working set" uses the existing `completed` tick, since sets have no warm-up flag; this differs on purpose from feature 006's calorie totals, which count every set.
- Changing the weekly target applies from the current week onward; the target of each ended week is stored with it.
- A timezone change is applied from the change onward; ended weeks are kept as stored.
- Reacting is allowed on one's own items; there are no comments or notifications.
- This feature defines streaks for the leaderboard and resolves PRD §5 question 4 (a streak needs workouts, counted weekly); the provisional daily streak on the Workouts screen is replaced by the weekly streak. The overall score formula (PRD §5.1) and nudges remain out of scope.
- Constitution principle VI is amended (MINOR) so members may hide themselves from the leaderboard and may opt in to sharing body weight as a ratio.
