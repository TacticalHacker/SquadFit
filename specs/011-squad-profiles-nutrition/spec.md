# Feature Specification: Squad Member Profiles and Shared Nutrition

**Feature Branch**: `011-squad-profiles-nutrition`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Squad member profiles and shared nutrition (feature 011). Builds on 010 squad leaderboard." Clickable member profiles with PR board, heatmap and a workout timeline; expandable leaderboard rows and a "Today's workouts" view; opt-in nutrition sharing at three levels; a Nutrition board that ranks only on hitting your own protein target.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a squad member's profile (Priority: P1)

A signed-in member taps another member's name or avatar on the leaderboard or in the activity feed and lands on that member's profile. It shows who they are, how consistent they are, their best lifts, a 12-week activity heatmap and a newest-first timeline of their workout days. Tapping a day expands the full set-by-set log. The member's own profile is the same page with an "Edit sharing settings" link.

**Why this priority**: This is the core of the feature and the entry point for everything else. It is useful with no nutrition at all.

**Independent Test**: Sign in as member A, tap member B's name on the leaderboard, and check that the header, PR board, heatmap and timeline show B's data. Expand a day and check the set-by-set log.

**Acceptance Scenarios**:

1. **Given** member B is visible on the leaderboard, **When** A taps B's name or avatar on any board or feed item, **Then** B's profile opens showing avatar or initials, display name, member-since date, current and best weekly streak, weekly target and this week's workouts (e.g. "2 / 3").
2. **Given** B has logged lifts, **When** A views B's profile, **Then** the PR board lists, for each main lift B has logged, the best estimated one-rep max and the heaviest set, each with the date achieved.
3. **Given** B has workout history, **When** A views the heatmap, **Then** it shows the last 12 weeks, one square per day, unshaded for no training and progressively darker accent-green shades for higher training volume.
4. **Given** B has more workout days than fit on one page, **When** A scrolls to the end of the timeline, **Then** the next older days load, newest first, with no day repeated or skipped.
5. **Given** a day card, **When** A taps it, **Then** it expands to the full set-by-set log (weight × reps for every set); tapping again collapses it.
6. **Given** a day with a gym session and one or more activity entries, **When** the card is shown, **Then** each session is listed separately inside the one day card with its exercises, sets, top set, volume and any PR badges.
7. **Given** B reached a weekly-streak milestone, **When** A views the timeline, **Then** the milestone appears as its own item in date order.
8. **Given** A opens their own profile, **Then** the same page is shown with an "Edit sharing settings" link to Settings.

---

### User Story 2 - Respect privacy on profiles (Priority: P1)

A member who has turned off "Show me on the squad leaderboard" cannot be opened by others. Nobody ever sees another member's email, AI keys or body weight (unless that member opted in to share body weight).

**Why this priority**: Privacy rules gate every other story; a profile page without them must not ship.

**Independent Test**: Hide member C, then request C's profile, timeline and day log as member A and confirm a private-log response with no data. Confirm C can still open their own.

**Acceptance Scenarios**:

1. **Given** C has hidden themselves, **When** A opens C's profile (by link or by guessing the address), **Then** A sees "This member keeps their log private" and no profile data, timeline or day log is returned.
2. **Given** C is hidden, **When** C opens their own profile, **Then** it works normally and notes that others cannot see it.
3. **Given** any profile viewed by another member, **Then** it never includes email, login or AI keys, calorie target, timezone or username, and body weight appears only as already allowed by feature 010 (opt-in relative strength).
4. **Given** an anonymous visitor, **When** they request any profile, **Then** they get no member data.

---

### User Story 3 - See what the squad trained, on the leaderboard (Priority: P2)

On the leaderboard, a member taps a row (not the name) to expand that member's full workout for the selected day: every exercise, every set (weight × reps), top set, volume, duration and PR badges. A "Today's workouts" view lists everyone's full workout for the day as cards.

**Why this priority**: Makes the squad's training visible at a glance, but depends on the same workout views as Story 1.

**Independent Test**: Expand a row and confirm the workout shows and is fetched only then; open "Today's workouts" and confirm every visible member appears as a card.

**Acceptance Scenarios**:

1. **Given** B trained on the selected day, **When** A taps B's row, **Then** the row expands with each session (gym session and each activity listed separately), every set as weight × reps, top set, volume, duration and PR badges.
2. **Given** B has no workout on a past day, **When** expanded, **Then** muted "Rest day" is shown; **Given** the selected day is today and nothing is logged yet, **Then** "Nothing logged yet" is shown.
3. **Given** a row is expanded on a phone, **When** A expands another row, **Then** the first collapses (one open at a time).
4. **Given** the leaderboard loads, **Then** set details for rows are not loaded until a row is expanded.
5. **Given** A opens "Today's workouts", **Then** members who trained are shown as cards, most recently active first, each with the full workout; hidden members never appear.
6. **Given** A taps a name or avatar inside an expanded row or card, **Then** that member's profile opens instead of toggling the row.

---

### User Story 4 - High-five a workout day (Priority: P2)

A member can high-five any workout day card on a profile or in "Today's workouts", once per member per day, and take it back. Milestone items on the timeline can be high-fived too. Day high-fives do not add items to the main activity feed.

**Why this priority**: Encouragement is the social core of the squad but is secondary to seeing the data.

**Independent Test**: High-five a day card, reload and see the count and your state persisted, toggle it off, and confirm the main feed shows no new item.

**Acceptance Scenarios**:

1. **Given** B's day card, **When** A taps the high-five, **Then** the count increases by one and A's state is "high-fived"; tapping again removes it. Repeated taps never count more than once per member per day.
2. **Given** A high-fives B's day, **Then** the main activity feed is unchanged.
3. **Given** a milestone item on B's timeline, **Then** it can be high-fived with the same rules as feed high-fives from feature 010.
4. **Given** B edits or deletes the workout so the day is no longer a workout day, **Then** that day's high-fives are removed with it.
5. **Given** A views their own profile, **Then** they see the counts but cannot high-five their own days.

---

### User Story 5 - Choose how much nutrition to share (Priority: P2)

A member picks a nutrition sharing level in Settings: **Off** (default), **Daily totals**, or **Totals + meals**. On the first leaderboard visit after launch, a one-time card explains the three levels so members choose consciously. A change takes effect immediately for all days, past and future.

**Why this priority**: Nutrition sharing is opt-in; nothing else in Part 2 can show data until members can choose.

**Independent Test**: Switch a member between the three levels and confirm what another member can see changes immediately, including for past days.

**Acceptance Scenarios**:

1. **Given** a new or existing member who has never chosen, **Then** their level is Off and nothing about their food is visible to others.
2. **Given** a member who has not chosen and opens the leaderboard, **Then** a one-time card "You can now share your nutrition with your squad" offers the three levels; choosing one or dismissing it (which keeps Off) means it is not shown again.
3. **Given** Daily totals, **Then** others can see only calories in, protein, carbs, fat, calories burned from workouts, and the member's protein and calorie targets per day.
4. **Given** Totals + meals, **Then** others can additionally see meal names, items, per-meal macros and food photos.
5. **Given** a member lowers their level, **Then** the higher-level data is no longer visible to others immediately, including on past days and for photos already viewed.
6. **Given** a member who is hidden from the leaderboard, **Then** their nutrition is not visible to others regardless of level.

---

### User Story 6 - See squad nutrition on the leaderboard and profiles (Priority: P3)

For members sharing at least daily totals, the leaderboard row shows a compact nutrition line: protein against their own target with a progress bar, calories in (and their target if set), and calories burned in workouts. If the burned figure is an AI-adjusted estimate it is marked "~" with an "adj." label, as elsewhere in the app. On profiles, each day card shows daily totals, and for Totals + meals members, an expandable meal list. No net figure is shown anywhere.

**Why this priority**: Valuable but only meaningful once members opt in.

**Independent Test**: With one member at each level, view the leaderboard row, profile timeline and meal list as another member and compare with the sharing rules.

**Acceptance Scenarios**:

1. **Given** B shares Daily totals and has a protein target of 160 g and logged 142 g, **Then** the row shows "142 / 160 g" with a proportional progress bar, calories in, and calories burned.
2. **Given** B has no protein target, **Then** only the protein logged is shown, with no bar.
3. **Given** the burned calories include any AI-adjusted workout, **Then** the figure is shown with "~" and "adj."; otherwise it is shown plain.
4. **Given** B shares Totals + meals, **When** A expands a day's meals, **Then** meals show names, items, per-meal macros and photos (photos only through short-lived links).
5. **Given** B shares only Daily totals, **Then** no meal, item or photo data and no photo links are returned to A.
6. **Given** pending photo entries, **Then** they count in no total, as in the rest of the app.

---

### User Story 7 - Nutrition board ranked on your own targets (Priority: P3)

A new **Nutrition** tab ranks members by how many days in the period they hit their own protein target (e.g. "6 / 7 days"), with days logged shown as a secondary figure. It never ranks on calories in, calories burned or deficit. Members who do not share are absent, and members without a protein target are not ranked.

**Why this priority**: A healthy competitive layer on top of sharing; lowest dependency risk to defer.

**Independent Test**: With members at various levels, targets and ties, check the ranking order, tie ranks and exclusions.

**Acceptance Scenarios**:

1. **Given** members with 6, 6 and 4 target-hit days, **Then** the first two share rank 1 and the third is rank 3, ordered by days logged then name for display only.
2. **Given** a member who shares Off, **Then** they do not appear on the tab at all (not as zero).
3. **Given** a member who shares but has no protein target, **Then** others do not see them ranked; on their own view they see "Set a protein target" linking to Settings.
4. **Given** any state of the board, **Then** no ordering, label or sort option is based on calories in, calories burned, net or deficit.
5. **Given** a member at Daily totals or above hits their protein target 7 days in a row, **Then** the activity feed shows "<Name> hit their protein target 7 days in a row"; it is never shown for members who share Off, and no individual meals are ever posted to the feed.

---

### Edge Cases

- A member with no workouts yet: profile shows an empty heatmap, empty PR board, and "No workouts yet" in the timeline.
- A day card whose workout contains an entry removed from the member's list (old `std-*` entries) still shows and counts as it does today.
- A member who lowers the sharing level while another member has their meal list open: the next load shows only the permitted level.
- A member hidden from the leaderboard while still being high-fived: their day high-fives stay stored but are not visible to others.
- Day high-fives on a day deleted after the high-five: removed with the day.
- Timelines for members with years of history: pages are bounded and load on demand.
- Profile links for unknown or malformed member ids: show "Member not found" without revealing whether the id exists as a hidden member (same response as private).
- Timezone: each day is the member's own local day, never UTC (constitution V).
- A burned figure with only some entries adjusted is still marked adjusted.

## Requirements *(mandatory)*

### Functional Requirements

**Profiles**

- **FR-001**: Every member name and avatar on the leaderboard boards, activity feed, "Today's workouts" and profile timeline MUST link to that member's profile.
- **FR-002**: Profiles MUST be available only to signed-in members; anonymous requests MUST get no member data.
- **FR-003**: A profile MUST show avatar or initials, display name, member-since date, current weekly streak, best weekly streak, weekly target and workouts this week against the target.
- **FR-004**: The PR board MUST show, per main lift with logged sets, the best estimated one-rep max and the heaviest set, each with the date achieved, using the existing working-set and jump-flag rules from feature 010.
- **FR-005**: The heatmap MUST show the last 12 weeks with one square per day in the member's local time, unshaded when no training and in at least three darker accent shades by volume; it MUST use only theme accent shades, with an accessible text alternative per square (date and whether trained).
- **FR-006**: The timeline MUST list workout days and streak milestones newest first, in pages, loading older pages on demand without repeats or gaps.
- **FR-007**: Each workout day card MUST list each session separately (the gym session, and each activity entry), with exercises, sets, top set, volume and PR badges, and expand to the full set-by-set log.
- **FR-008**: Members MUST be able to high-five every workout day card (once per member per day, toggleable) and every milestone item; members MUST NOT be able to high-five their own.
- **FR-009**: Day high-fives MUST NOT create items in the main activity feed; removing the day MUST remove its high-fives.
- **FR-010**: A member's own profile MUST be the same page with an "Edit sharing settings" link.
- **FR-011**: A member hidden from the leaderboard MUST NOT be viewable by others in any profile, timeline, day log or "Today's workouts" response; others see "This member keeps their log private"; the member can still view their own.
- **FR-012**: Responses about another member MUST NEVER contain email, login or AI keys, calorie target, timezone, username, or body weight (except the existing opt-in relative-strength ratio).

**Leaderboard workouts**

- **FR-013**: Leaderboard rows MUST expand (tap on the row but not the name) to the member's full workout for the selected day, fetched only on expand.
- **FR-014**: An expanded workout MUST show every session, every set as weight × reps, top set, volume, duration and PR badges; rest days show muted "Rest day" and an empty current day shows "Nothing logged yet".
- **FR-015**: On phone widths only one row MUST be expanded at a time.
- **FR-016**: A "Today's workouts" view MUST list every visible member's full workout for the selected day as cards, most recently active first; members with no workout are not listed.
- **FR-017**: Workout visibility is covered by the existing "Show me on the squad leaderboard" setting; no extra opt-in is needed.

**Nutrition sharing**

- **FR-018**: Each member MUST have a nutrition sharing level: Off (default), Daily totals, or Totals + meals, editable in Settings.
- **FR-019**: At Off, no nutrition field of any kind MUST appear in any response about that member to others.
- **FR-020**: At Daily totals, others MUST see only per day: calories in, protein, carbs, fat and calories burned from workouts, plus the member's protein target and calorie target as context for progress. No meal names, items, photos or photo links.
- **FR-021**: At Totals + meals, others MUST additionally see per day: meal names, items, per-meal macros, and food photos.
- **FR-022**: Sharing levels MUST be enforced on the server when building responses, with a fixed response shape per level; hiding in the client is not sufficient.
- **FR-023**: Food photos MUST be served to other members only at Totals + meals, through short-lived expiring links; no public links.
- **FR-024**: A level change MUST take effect immediately for all days, past and future (nutrition is computed when requested, not copied).
- **FR-025**: A member hidden from the leaderboard MUST NOT expose nutrition to others at any level.
- **FR-026**: On the first leaderboard visit after launch, a member who has not chosen MUST see a one-time card with the three options; any choice or dismissal MUST stop it showing again (dismissal keeps Off).
- **FR-027**: Photo entries still waiting for analysis MUST count in no total.

**Nutrition on the leaderboard and profile**

- **FR-028**: For members sharing at least Daily totals, the leaderboard row MUST show protein against the member's own target with a progress bar, calories in (with the target when set) and calories burned in workouts; it MUST NOT show net.
- **FR-029**: A burned figure that includes any AI-adjusted workout MUST be shown with "~" and an "adj." label, matching the app's existing marking.
- **FR-030**: Profile day cards MUST show the day's daily totals per the member's level and, at Totals + meals, an expandable meal list.

**Nutrition board and feed**

- **FR-031**: A Nutrition tab MUST rank members by the number of days in the period on which they hit their own protein target; days logged MAY be shown as a secondary figure and tie-break display order.
- **FR-032**: Ties MUST share a rank (standard competition ranking).
- **FR-033**: The board MUST NOT rank, sort or label on calories in, calories burned, net or deficit; those are informational only.
- **FR-034**: Members at Off MUST NOT appear on the board; members without a protein target MUST NOT be ranked and see "Set a protein target" on their own view.
- **FR-035**: The activity feed MUST show "<Name> hit their protein target 7 days in a row" only for members sharing at least Daily totals; individual meals MUST NEVER be posted to the feed.
- **FR-036**: Days are evaluated in each member's local time and use the same period options as other boards where meaningful ("This week", "Last 30 days"); "All time" is not offered for this board.

**Governance**

- **FR-037**: The constitution's principle VI MUST be amended (MINOR version bump) to list the exact nutrition fields a member may opt in to share at each level.
- **FR-038**: Nothing in this feature may expose food or calorie data in any future share card unless the member explicitly opts in there.
- **FR-039**: Notes, captions, photos, meals and entries MUST NOT be written to logs.

### Key Entities *(include if feature involves data)*

- **Member profile view**: What another member may see about a member: display name, avatar, member-since, streaks, weekly target, week progress, PR board, heatmap, timeline, and nutrition per sharing level.
- **Nutrition sharing level**: A per-member setting (Off, Daily totals, Totals + meals), plus whether the member has seen the one-time card.
- **Workout day card**: One member's workout day with its sessions, sets, volume, top set, PR badges, high-five count and (per sharing level) nutrition.
- **Session**: A gym session or a single activity entry inside a workout day.
- **Day high-five**: One reaction from one member to one other member's workout day; not a feed item.
- **Protein-target day**: A local day on which a member's logged protein reached their own protein target.
- **Heatmap cell**: One local day with trained/not trained and a volume shade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can go from the leaderboard to another member's full set-by-set log for a given day in at most three taps.
- **SC-002**: Profiles and the first timeline page are usable within 2 seconds on a typical mobile connection for members with a year of history; expanding a leaderboard row shows its workout within 1 second.
- **SC-003**: In automated checks across all three sharing levels, 100% of responses contain exactly the allowed fields for that level (zero nutrition fields at Off).
- **SC-004**: 100% of requests for a hidden member's profile, timeline, day log and today card return no member data.
- **SC-005**: After a member changes their level, the next view by another member reflects it with no waiting period, including past days.
- **SC-006**: Across all Nutrition board configurations tested, ranking depends only on protein-target days (ties share ranks) and never on calories, burned calories or deficit.
- **SC-007**: Adjusted burned figures are labelled in 100% of cases where any contributing workout was AI-adjusted.
- **SC-008**: Paging through a timeline returns every workout day exactly once in newest-first order.
- **SC-009**: At least 80% of active members see and respond to (choose or dismiss) the one-time sharing card on their first visit.

## Assumptions

- Feature 010 (leaderboard, feed, high-fives, "Show me on the squad leaderboard", weekly streak) is the base; its PR, jump-flag and working-set rules are reused.
- Data holds one entry per exercise or activity per day, so "sessions" are the gym session (all gym exercises that day) plus each activity entry; true multiple gym sessions in one day are not modelled.
- "Today's workouts" and leaderboard row expansion default to today and follow the page's selected day when one exists; "most recently active first" uses each member's last workout update time.
- The Nutrition board's periods are "This week" and "Last 30 days"; a protein-target day counts only if the member logged any food that day, and logging protein below target is not a hit.
- Existing members default to Off; no data migration is needed.
- The protein streak feed event fires once per completed 7-day run of consecutive local days (not per extra day), and is removed if the underlying days stop being true.
- Members with sharing Off still see their own nutrition everywhere, as today.
- There is no Story share card in the repository; no share-card work is in scope.
- Feature 010's "no AI/MCP leaderboard access" stays: the AI tools do not read other members' profiles or nutrition.
