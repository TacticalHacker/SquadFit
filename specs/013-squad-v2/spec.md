# Feature Specification: Squad v2 (Simpler Leaderboard)

**Feature Branch**: `013-squad-v2`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Squad v2: simplify the /squad leaderboard": one row of controls, a short feed with three reactions at the top, monthly board cards showing the top 3 and the viewer, a Hall of Fame of all-time records, club badges from the estimated Big 3 total, a "targets confirmed" flag, and plain wording everywhere. Bodyweight, relative strength and relative badges are feature 014.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who's winning at a glance (Priority: P1)

A member opens Squad. Under the title there is one row of controls ("This month" · "Hall of Fame"). "This month" shows a stack of board cards. Each card has a title, an (i) icon, the top 3 members (rank, avatar, name, one big number with its unit, at most one small muted line) and, if the viewer is not in the top 3, one line such as "You · #5 · 6 workouts". Tapping a card opens that board's full ranked list; tapping a person opens their profile. There is no date picker, period toggle, Boards/Today switch, tab row or explanation paragraph on the page.

**Why this priority**: The current page is unreadable; this is the core of the feature.

**Independent Test**: With five members who logged workouts this month, open Squad and check each card shows exactly three ranked rows plus the viewer's own line when the viewer is 4th or lower, and that tapping a card shows all five.

**Acceptance Scenarios**:

1. **Given** the viewer is ranked 5th on "Most workouts", **When** they open Squad, **Then** the card shows ranks 1–3 and a line "You · #5 · 6 workouts".
2. **Given** the viewer is in the top 3, **Then** no extra "You" line is shown and their row is marked as theirs.
3. **Given** a board has fewer than 3 ranked members, **Then** it shows only those, and an empty board shows one short sentence (e.g. "No workouts yet this month.").
4. **Given** the viewer taps the (i) icon, **Then** a one-sentence plain explanation of that board opens (e.g. Active streak: "Weeks in a row you hit your workout goal. Rest days don't break it.").
5. **Given** a row, **Then** it shows no protein bar, calorie bar or burned calories.
6. **Given** the viewer is hidden from the leaderboard, **Then** cards show other members only, the viewer's own line reads "You · not ranked (hidden)", and the existing hidden notice is shown.

---

### User Story 2 - Monthly boards that reset on the 1st (Priority: P1)

The "This month" cards are, in order. Grind: **Most workouts**, **Active streak**, **Lifts improved**, **Steps**. Strength: **Biggest PR jump**, **Current strength (Big 3)**. Nutrition: **Protein days** (only if at least one member qualifies). All monthly boards count the current calendar month in the squad's timezone, so everyone resets at the same moment. Active streak is not monthly.

**Why this priority**: The boards are the content of the page; monthly resets keep it winnable.

**Independent Test**: With entries on 30 Nov and 1 Dec, check that on 1 Dec the monthly boards show only December figures while Active streak is unchanged.

**Acceptance Scenarios**:

1. **Most workouts**: big number = workout days this month ("6 workouts"). A workout day is the existing definition (gym strength with a completed set, gym cardio, or any activity entry); two sessions on one day count once.
2. **Active streak**: big number = the existing weekly-target streak in weeks ("3 weeks in a row"); muted line "Best: 5 weeks"; members at 0 who have at least one workout day ever are listed in the full list with "2 of 4 workouts this week" instead of a streak and are ranked below everyone with a streak; members who have never trained are absent.
3. **Lifts improved** (owner change 2026-11-19, replaces Total weight lifted): big number = strength sessions this month whose top set beat the previous session of the same exercise: more weight at the same or more reps, or more reps at the same weight ("12 lifts improved"; (i): "Times you beat your last session: one more rep or a bit more weight."). First-ever sessions of an exercise and cardio never count; flagged unusual jumps are excluded. Total weight lifted moves to the member's profile as this week vs last week ("8% more than last week").
4. **Steps**: big number = average daily steps this month over days with synced steps ("9,210 steps a day"); only members whose steps are visible to the viewer (feature 012 gate); members with no synced day this month are absent.
5. **Biggest PR jump**: for each member and each eligible lift (bench press, barbell squat, deadlift, overhead press, barbell row, pull-ups with added weight), jump = best estimated max this month − best estimated max before this month; the member's value is their largest jump. Shown as "+7.5 kg · Squat" with the percentage ("+8%") muted. Ranked by kg; the full list has a "kg | %" switch that re-ranks by percentage. A lift with no history before this month gives no jump; a jump of 0 or less is not listed.
6. **Current strength (Big 3)**: big number = best-ever estimated max on bench press + barbell squat + deadlift ("about 380 kg"), labelled "Current strength". The full list has a "Big 3 | Big 4" switch that adds overhead press. Members missing any of the lifts are not ranked; in the full list they appear muted at the bottom with "missing: Deadlift" (all missing lifts named). The card shows ranked members only. This board does not reset monthly (it uses best-ever figures), and says so in its (i) text.
7. **Protein days**: big number = days this month the member hit their own protein target, written "14 / 19 days" (19 = days elapsed this month in the member's timezone). Only members who share nutrition (at `totals` or `meals`), have a protein target and have confirmed their targets (User Story 6). Never ranked or labelled by calories eaten, burned or deficit. The card is omitted when no member qualifies.
8. **Given** the squad timezone is Asia/Kolkata and it is 1 Dec 00:05 there, **Then** monthly boards count December, even for a member whose own local date is still 30 Nov; that member's 30 Nov entries count toward November.

---

### User Story 3 - Feed with three reactions (Priority: P1)

The top of Squad shows the latest 5 feed items in plain words ("Nikhil hit a new PR (personal best) on Bench Press: about 95 kg (+2.5 kg)", "Swathi hit the workout goal 4 weeks in a row"), with "See all" opening the full feed and "See today's workouts →" under it. Every feed item and every workout-day card has three reactions, 🔥 💪 👑, each with a count. A member can give each reaction at most once per item and tap again to take it back. Existing high-fives become 💪.

**Why this priority**: The feed is the social core and must replace the old high-five without losing anyone's reactions.

**Independent Test**: Give 🔥 and 💪 to one item, check counts are 1/1/0 and both are marked as yours; take 🔥 back and check 0/1/0; check an item that had 3 high-fives before migration shows 💪 3.

**Acceptance Scenarios**:

1. **Given** an item, **When** the member taps 🔥, **Then** its 🔥 count rises by one and shows as given by them; tapping again lowers it by one.
2. **Given** two members react at the same time, **Then** both reactions count and the counts are exact.
3. **Given** a member cannot react to their own items (same as high-fives today), **Then** the reaction buttons on their own items show counts but are not pressable.
4. **Given** the operator runs the reaction migration, **Then** every existing high-five becomes a 💪 from the same member on the same item, counts match, and running it again changes nothing.
5. **Given** "See today's workouts →", **Then** it opens the Today's workouts view (with its own day picker) on its own page, unchanged otherwise except for wording and reactions.

---

### User Story 4 - Hall of Fame (Priority: P2)

"Hall of Fame" shows one row per all-time record: what it is, who holds it, the value and the date it was set. Tapping the holder opens their profile.

**Why this priority**: All-time glory moves here so the main boards can reset; it reuses the same figures.

**Independent Test**: With history across two months, check each record names the right holder, value and date.

**Acceptance Scenarios**:

1. Records: heaviest estimated max on Bench Press, Barbell Squat, Deadlift and Overhead Press; best Big 3 total; longest streak ever (weeks); most workouts in one calendar month; biggest PR jump in one calendar month; most lifts improved in one calendar month; highest monthly step average (sharing members only).
2. **Given** a tie, **Then** the member who reached it first holds the record.
3. **Given** a record with no qualifying data, **Then** its row shows "No record yet".
4. **Given** a record holder hides from the leaderboard, **Then** the next qualifying visible member holds it for everyone else.
5. Monthly records use calendar months in the squad timezone, and the current month counts as soon as it beats the old record.

---

### User Story 5 - Club badges (Priority: P2)

Members earn club badges from their estimated Big 3 total: 225 kg Club, 300 kg Club, 400 kg Club, 450 kg Club (1000 lb) and 500 kg Club, each labelled "est.". A member's profile shows all their badges; boards show one small icon (the highest) next to their name. Earning a badge posts once to the feed: "Roshan joined the 300 kg Club 👑".

**Why this priority**: Milestones give lighter or newer lifters something to aim at; they come from figures already computed.

**Independent Test**: Log lifts that take a member's estimated Big 3 from 290 kg to 310 kg; check the profile shows 225 and 300 kg Clubs, the board shows the 300 icon, and exactly one feed item for the 300 kg Club appears.

**Acceptance Scenarios**:

1. **Given** a member's estimated Big 3 crosses a threshold, **Then** they hold that badge and every lower one, and one feed item is posted for each newly earned badge.
2. **Given** further logs keep them above it, **Then** no further feed item is posted for that badge.
3. **Given** an edit or deletion inside the edit window drops them back below a threshold, **Then** that badge and its feed item are removed (the same rule as PRs today).
4. **Given** the launch backfill, **Then** members get the badges their history earns, and no feed items are posted for them.

---

### User Story 6 - Confirmed targets (Priority: P2)

Members whose calorie and protein targets were never confirmed (all existing members) see a short prompt on Squad and on Food: "Set your daily goals" with their current values filled in. Saving (with or without changes) confirms them. Until then, other members never see their targets, and they are not on the Protein days board.

**Why this priority**: Unconfirmed targets such as "2,000 calories" or "20 g protein" are shown as if real, which misleads everyone.

**Independent Test**: As an unconfirmed member sharing nutrition, check another member sees their totals without targets and they are not on Protein days; confirm; check targets appear and they are ranked.

**Acceptance Scenarios**:

1. **Given** an unconfirmed member shares nutrition, **When** another member views their day, **Then** calories, protein, carbs, fat and burned are shown but no target.
2. **Given** the member confirms (saves the prompt or saves targets in Settings), **Then** targets are shown to others and the member can appear on Protein days.
3. **Given** a new member completes their profile (targets are entered there), **Then** their targets count as confirmed.
4. **Given** the member dismisses the prompt, **Then** it no longer appears on Squad or Food; Settings keeps showing "Not confirmed yet: save to share your goals", and their targets stay unconfirmed.
5. The member always sees their own targets regardless.

---

### User Story 7 - Plain wording everywhere (Priority: P2)

Every screen in the squad area (boards, full lists, feed, Today's workouts, day cards, profiles) uses wording a non-gym-goer understands, always with units, from one shared set of phrases.

**Why this priority**: Applies across all of the above; low risk but large in scope.

**Independent Test**: Review each screen against the wording table below; no "e1RM", no bare numbers.

**Acceptance Scenarios** (now → shown):

1. "0-week streak · best 0" → hidden when 0; otherwise "🔥 3 weeks in a row" and muted "Best: 5 weeks".
2. "2 / 4 days" → "2 of 4 workouts this week".
3. "7 / 150 g" protein → "Protein: 7 g of 150 g goal" (no goal part when the target is not visible).
4. "In 120 / 2,000 kcal" → "Ate 120 of 2,000 calories".
5. "Burned ~433 kcal" + "adj." → "Burned about 433 calories" with an (i): "Estimated. Smartwatches often overcount gym calories, so we adjust it down." The (i) is shown only when the day had an adjustment.
6. Gym session summary shown once: "69 min · 8 exercises · lifted 6,225 kg in total", with (i): "Total weight lifted = every rep's weight added together."
7. "top 15 × 10" → "Best: 15 kg × 10 reps".
8. Equal sets → "3 sets of 10 reps at 15 kg"; otherwise "3 sets · 25 kg → 30 kg → 35 kg · 10 reps each" (or "· 12, 10, 8 reps" when reps differ).
9. "top Shoulder Press 60 × 10" → "Heaviest lift: Shoulder Press 60 kg × 10 reps".
10. Estimated one-rep max → "Estimated max: about 101 kg", (i): "The most you could likely lift once, worked out from your sets." The term "e1RM" never appears.
11. "Volume" → "Total weight lifted"; "PR" → "PR (personal best)" the first time on a screen, then "PR".
12. Cardio rows → "Incline treadmill walk · 5 min" (no "top", no set numbers).
13. Exercises whose name contains "Dumbbell" or that are known dumbbell lifts (Hammer Curl, Lateral Raises) show weight as "15 kg per dumbbell".

### Edge Cases

- A member who joined mid-month competes with what they logged; Protein days uses days elapsed since the 1st, not since joining.
- A member with no workouts this month is absent from Most workouts and Lifts improved (not shown as 0).
- A flagged "unusual jump" set (feature 010 jump rule) never counts towards PR jump, Current strength, Hall of Fame or badges until confirmed.
- Built-in exercises only: own exercises never count towards PR jump, Big 3, Hall of Fame lift records or badges.
- Pull-ups count for PR jump only for sets with added weight above 0 kg.
- An edit inside the 3-day edit window that changes last month's figures (e.g. on 1 Dec editing 30 Nov) updates last month's records and the PR-jump baseline.
- A feed item that stops being true is removed with all its reactions.
- The squad timezone is changed by the operator: month boundaries move immediately; nothing stored needs rewriting.
- Ties on any board share a rank (1, 1, 3), then are ordered by name, as today.

## Requirements *(mandatory)*

### Functional Requirements

**Page layout**

- **FR-001**: The Squad page MUST show, top to bottom: the title, any one-time cards/notices (nutrition sharing, targets prompt, hidden notice), the latest 5 feed items with "See all" and "See today's workouts →", one segmented control "This month | Hall of Fame", then the selected view.
- **FR-002**: The Squad page MUST NOT show a date picker, period toggle, Boards/Today switch, board tab row or explanation paragraphs. The full feed and Today's workouts MUST each be reachable on their own page; Today's workouts keeps its own day picker.
- **FR-003**: Each board card MUST show title, an (i) control opening exactly one plain sentence, the top 3 ranked members (rank, avatar, name, highest badge icon if any, one big number with unit, at most one muted line), and the viewer's own "You · #N · value" line when they are ranked below 3rd. Tapping the card MUST open the full ranked list; tapping a member MUST open their profile.
- **FR-004**: Board rows MUST NOT show protein, calorie, or burned figures.
- **FR-005**: Boards MUST be defined so adding a board needs one configuration entry and one ranking rule.

**Months and timezone**

- **FR-006**: The squad MUST have a timezone setting (default Asia/Kolkata) that only the operator can change. "This month" MUST be the calendar month of the current moment in that timezone.
- **FR-007**: Monthly figures MUST bucket each entry by the month of its own stored local date; streaks, workout days, step days and protein days MUST keep using each member's own timezone (constitution V).

**Boards** (as defined in User Story 2)

- **FR-008**: Most workouts MUST rank by workout days this month.
- **FR-009**: Active streak MUST rank by current weekly streak, then best streak, then workout days this week, and MUST NOT reset monthly.
- **FR-010**: Lifts improved MUST rank by the number of strength sessions this month whose top set (heaviest working set, then most reps) beat the previous session's top set of the same exercise (more weight at ≥ reps, or more reps at the same weight); first sessions and cardio never count. Member profiles MUST show total weight lifted this week against last week; it is never ranked.
- **FR-011**: Steps MUST rank by average steps over synced days this month, only for members passing the feature 012 steps gate.
- **FR-012**: Biggest PR jump MUST rank by the largest positive (best estimated max this month − best estimated max before this month) over the eligible lifts, show kg and %, and offer a % ranking in the full list. Lifts first logged this month MUST NOT give a jump.
- **FR-013**: Current strength MUST rank by the sum of best-ever estimated max over bench press, barbell squat and deadlift (Big 4 adds overhead press when chosen); members missing a lift MUST NOT be ranked and MUST appear only in the full list, muted, with the missing lift names.
- **FR-014**: Protein days MUST rank by days this month the member's protein hit their own target, only for members visible on the leaderboard, sharing nutrition, with a protein target and confirmed targets; it MUST never rank, sort or label by calories.
- **FR-015**: Estimated max MUST use the existing estimate (Epley, 1–10 reps) and existing jump-flag exclusions.

**Hall of Fame**

- **FR-016**: Hall of Fame MUST list the records in User Story 4 with holder, value with unit, and date (day for lift records, month for monthly records), computed only from members visible to the viewer (and, for steps, passing the steps gate); ties go to whoever reached it first.

**Badges**

- **FR-017**: A member MUST hold each club badge (225, 300, 400, 450 "1000 lb", 500 kg) whose threshold their best-ever estimated Big 3 total meets, labelled as estimated.
- **FR-018**: Earning a badge MUST create exactly one feed item; the backfill MUST create none; a badge that stops being true MUST be removed with its feed item.
- **FR-019**: Profiles MUST show all held badges; board rows MUST show only the highest.

**Feed and reactions**

- **FR-020**: Feed lines MUST use the plain wording of User Story 7, including badge items.
- **FR-021**: Each feed item and workout-day card MUST support three reactions (🔥, 💪, 👑), at most one of each per member per item, toggleable, with exact counts under concurrent use; members MUST NOT react to their own items.
- **FR-022**: Reactions MUST replace high-fives entirely. An operator migration MUST turn every existing high-five into a 💪 by the same member on the same item, preserving counts, and MUST be safe to re-run.
- **FR-023**: A feed item removed because it is no longer true MUST lose all its reactions.

**Targets**

- **FR-024**: The profile MUST record whether the member has confirmed their calorie and protein targets. Completing a new profile and saving targets (prompt, Settings, or through the member's AI agent) MUST confirm them; existing members start unconfirmed.
- **FR-025**: Unconfirmed members MUST see a dismissible "Set your daily goals" prompt (on Squad and Food) with current values filled in; after dismissing, Settings still marks the targets as not confirmed.
- **FR-025a**: Unconfirmed members MUST NOT earn protein-goal streak feed items (a streak needs a real target).
- **FR-026**: Other members MUST NOT receive an unconfirmed member's calorie or protein targets in any response; the member always sees their own.

**Wording**

- **FR-027**: All squad-area text MUST follow the User Story 7 table, come from one shared set of phrases, and always show units; the term "e1RM" MUST NOT appear in the UI.

**Privacy**

- **FR-028**: Every new response MUST go through the existing member gates (hidden members, nutrition level, steps gate) and strict response shapes; no response may carry body weight, timezone, username, calories in/burned rankings, or another member's unconfirmed targets.
- **FR-029**: No new logs may contain names, sets, weights, steps, targets, reactions or feed text.

### Key Entities

- **Squad settings**: one per squad; the timezone used for month boundaries.
- **Member squad stats** (existing, extended): adds per-month workout days and lifts improved, and per-lift best estimated max per month, so monthly boards, PR jumps and monthly records come from stored figures.
- **Board**: a definition (id, group, title, one-sentence explanation, whether monthly) plus its ranking rule.
- **Record**: a Hall of Fame entry: record type, holder, value, date or month.
- **Badge**: club id and threshold; held by a member while their estimated Big 3 meets it; posts one feed item when earned.
- **Reaction**: one member's 🔥, 💪 or 👑 on one feed item or workout day; replaces the high-five.
- **Profile** (extended): targets-confirmed flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Squad page has exactly one row of controls, and each board card shows at most 4 member lines (top 3 + you).
- **SC-002**: A new member can say who leads each board within 5 seconds of opening Squad, without opening any (i).
- **SC-003**: On the 1st of a month at 00:00 in the squad timezone, every monthly board shows only the new month, and Active streak is unchanged.
- **SC-004**: 100% of existing high-fives appear as 💪 after migration, with identical per-item counts.
- **SC-005**: Each badge produces exactly one feed item per member, however many times their stats are rebuilt.
- **SC-006**: No screen in the squad area shows "e1RM", a number without a unit, or an unconfirmed target belonging to someone else.
- **SC-007**: Build, lint and all tests pass, including tests for: monthly reset vs streak, PR jump vs prior months and first logs, Big 3 exclusion, reaction toggle/counts/migration, and badge once-only posting.

## Assumptions

- "Current strength" uses best-ever figures (owner decision 2026-11-19), so it does not reset monthly; Hall of Fame holds the same figure as the record.
- Workout days, not sessions, are counted (owner decision).
- Only built-in exercises count towards strength boards, records and badges; pull-ups count for PR jump only with added weight.
- Dumbbell detection is by exercise (names containing "Dumbbell", plus Hammer Curl and Lateral Raises); no new per-set field.
- Badges follow the same "true or removed" rule as PRs rather than being permanent.
- Squad timezone is set with the operator CLI; there is no in-app setting.
- Reactions on one's own items are not allowed, matching high-fives today.
- The relative strength board, relative badges, bodyweight logging, the bodyweight graph and bodyweight privacy are feature 014. The existing "share body weight" ratio on the old Lifts board is removed with that board and returns in 014.
- The old Consistency and PR-count boards and the period toggle are removed; their figures are covered by Active streak, Most workouts and Biggest PR jump.
