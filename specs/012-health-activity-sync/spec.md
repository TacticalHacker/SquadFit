# Feature Specification: Health Activity Sync (Daily Steps)

**Feature Branch**: `012-health-activity-sync`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Daily activity sync (steps from Apple Health)": members get their daily steps (plus optional active calories and distance) into SquadFit through two routes that write to the same place: their AI agent (through the SquadFit AI connection) and a daily iPhone Shortcut (or the Health Auto Export app) posting with a dedicated Health sync token. Steps then show on member profiles, in "Today's workouts", on a new Steps board and as a 7-day step-goal streak in the feed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync steps automatically with an iPhone Shortcut (Priority: P1)

A member opens Settings → "Apple Health sync", generates a Health sync token, copies it, taps "Add the SquadFit Shortcut", pastes the token into the Shortcut and sets it to run daily. Every day the Shortcut sends today's and yesterday's totals (steps, and optionally active calories and distance). The Settings section then shows when the last sync happened and from which source.

**Why this priority**: Automatic, no-effort syncing is the main value; it works with no AI agent at all.

**Independent Test**: Generate a token, send one request with a day's totals using that token, and check the day is stored and that Settings shows the last-sync time and source "Shortcut".

**Acceptance Scenarios**:

1. **Given** a member with no token, **When** they generate one, **Then** the token is shown once with a copy button, and afterwards only its creation time and last-used time are shown, never the token itself.
2. **Given** a valid token, **When** the Shortcut sends `{ days: [{ date, steps, active_kcal, distance_km }], source: "shortcut" }`, **Then** each day is saved and the response lists what was saved.
3. **Given** the Shortcut sends numbers as text such as `"8423"` or `"8,423.0"`, or with decimals, **When** the request is processed, **Then** the values are read as numbers and rounded (steps and active calories to whole numbers, distance to two decimals).
4. **Given** the Shortcut sends a single day object instead of a list, **Then** it is accepted as a list of one.
5. **Given** a day was already saved earlier the same day with 4,100 steps, **When** the Shortcut sends 8,423 for that date, **Then** the stored value is 8,423 (replaced, not added).
6. **Given** a member regenerates the token, **Then** the old token stops working immediately and the new one works. **Given** they revoke it, **Then** no token works until they generate a new one.
7. **Given** a wrong, malformed or revoked token, **Then** the request is refused as unauthorised and nothing is saved.
8. **Given** a value out of range or a date in the future or more than 30 days ago, **Then** the request is refused with a plain-English message naming the date and the problem (e.g. "18 Nov: steps must be between 0 and 100,000"), suitable for display in the Shortcut, and nothing from that request is saved.
9. **Given** more than 60 requests in one hour with the same member's token, **Then** further requests that hour are refused with a "too many requests" message.

---

### User Story 2 - Sync steps through the member's AI agent (Priority: P1)

A member who has connected their AI agent (ChatGPT with Apple Health access, or Claude) asks it to "sync my steps for this week". The agent reads Health data and saves each day's whole-day totals through SquadFit's AI connection, then reports which days were saved and whether the member hit their step goal. The agent can also check what has already been synced.

**Why this priority**: Equal-value route for members who already use the AI connection; it writes to the same records as the Shortcut.

**Independent Test**: Through the AI connection, save three days of steps, then read the same range back and check the values, the goal and the "goal hit" flags.

**Acceptance Scenarios**:

1. **Given** a member's AI key, **When** the agent saves up to 31 days of `{ date, steps, active_kcal?, distance_km? }`, **Then** each day is saved with source "AI" and the reply lists, per day, the saved values, the member's step goal and whether it was hit.
2. **Given** the agent saves a date the Shortcut already saved, **Then** the later write replaces it and the source becomes "AI" (latest write wins).
3. **Given** the agent asks for a date range (at most 31 days, not after today), **Then** it receives each synced day in the range with its values, source and sync time, plus the step goal.
4. **Given** invalid values or dates, **Then** the agent gets a readable error and nothing from that call is saved.
5. **Given** the tool description, **Then** it reads exactly: "Save the member's daily activity from Apple Health or another health source. Use the member's local date. Send whole-day totals, not individual samples. Re-sending a date overwrites it. Call this when the member asks to sync or log their steps/activity."

---

### User Story 3 - Steps on profiles and in "Today's workouts" (Priority: P2)

Squad members see each other's steps: on a member's profile, each workout day card in the timeline shows the day's steps (e.g. "8,423 steps", with a small check when the goal was hit), and a bar chart shows the last 30 days of steps against the goal. In "Today's workouts" (and the expanded leaderboard row), a member's card shows the day's steps alongside the workout, and members who did not train but synced steps appear as "Rest day · 11,240 steps". On the profile, active calories and distance are shown as information marked "from Apple Health".

**Why this priority**: The social payoff of syncing, but it needs synced data from Story 1 or 2.

**Independent Test**: With member B sharing steps, sync a workout day and a rest day for B; as member A, open B's profile and "Today's workouts" and check both days show steps as described.

**Acceptance Scenarios**:

1. **Given** B shares steps and has a workout day with 8,423 steps and a goal of 8,000, **When** A views B's timeline, **Then** that day card shows "8,423 steps" with a goal-hit check.
2. **Given** B synced steps on 20 of the last 30 days, **When** A views B's profile, **Then** a 30-day bar chart shows those 20 days, with the goal marked and unsynced days shown as empty, not as zero.
3. **Given** B synced 11,240 steps today and logged no workout, **When** A opens "Today's workouts", **Then** B appears with a card reading "Rest day · 11,240 steps".
4. **Given** B synced active calories and distance, **When** A views B's profile, **Then** they appear as information labelled "from Apple Health" and nowhere else; they are never ranked or sorted on.

---

### User Story 4 - Steps board (Priority: P2)

A new "Steps" board on the squad leaderboard ranks members by average daily steps over This week or Last 30 days, and shows how many days each member hit their own goal (e.g. "5/7").

**Why this priority**: Adds friendly competition on top of Story 3.

**Independent Test**: With three sharing members, one of whom has never synced, open the Steps board and check the order, the averages, the goal-hit counts, and that the never-synced member is absent.

**Acceptance Scenarios**:

1. **Given** members with synced days in the period, **When** the Steps board is opened, **Then** they are ranked by average daily steps over the days they synced in the period, highest first, with ties sharing a rank.
2. **Given** a member with no synced day in the period, **Then** they are not on the board (not ranked as zero).
3. **Given** the period is This week and today is the member's Wednesday, **Then** the goal-hit count reads "n/3" (days elapsed in the member's week so far); for Last 30 days it reads "n/30".
4. **Given** the board period options, **Then** only This week and Last 30 days are offered (no All time), as on the Nutrition board.

---

### User Story 5 - Privacy controls for steps (Priority: P1)

Steps follow the existing "Show me on the squad leaderboard" setting, plus a new "Share my steps" toggle (default on), so a member can keep workouts visible but steps private. The member always sees their own steps.

**Why this priority**: Privacy gates every view in Stories 3 and 4; they must not ship without it.

**Independent Test**: Turn "Share my steps" off for B; as A, check B is absent from the Steps board, B's cards and profile show no steps, and B's rest-day card does not appear. Turn B's leaderboard visibility off and check the same.

**Acceptance Scenarios**:

1. **Given** B turns "Share my steps" off, **Then** no view seen by another member includes B's steps, active calories, distance, goal, step streak items or rest-day card, while B's workouts still show.
2. **Given** B is hidden from the leaderboard, **Then** B's steps are shown to nobody else, whatever "Share my steps" says.
3. **Given** B views their own profile or the Steps board, **Then** B sees their own steps; when B is not sharing, B sees a notice that others cannot see them.
4. **Given** a sharing setting changes, **Then** the change applies to all past days immediately.

---

### User Story 6 - Step-goal streak in the feed (Priority: P3)

When a sharing member hits their step goal 7 days in a row, the squad feed shows "<name> hit their step goal 7 days in a row". Only that milestone is posted, never daily step posts.

**Why this priority**: A nice extra; everything else works without it.

**Independent Test**: Sync 7 consecutive goal-hit days for a sharing member and check one feed item appears; lower one of those days below the goal and check the item disappears.

**Acceptance Scenarios**:

1. **Given** B shares steps and the 7 days ending on a date all hit the goal, **Then** one feed item "B hit their step goal 7 days in a row" exists for that run, and other members can high-five it.
2. **Given** a later sync lowers one of those 7 days below the goal, or B stops sharing, **Then** the item is removed.
3. **Given** B keeps hitting the goal on day 8, 9, …, **Then** no new item appears until a new, non-overlapping 7-day run is complete.

---

### User Story 7 - Health Auto Export app (Priority: P3)

A member who uses the Health Auto Export app points its REST export at the same address with the same token. SquadFit recognises that app's format and saves steps, active calories and distance per day with source "Health Auto Export".

**Why this priority**: Optional convenience for members who already use that app.

**Independent Test**: Send a sample Health Auto Export payload containing step count, active energy and walking + running distance for two days and check both days are saved with correctly summed and converted values.

**Acceptance Scenarios**:

1. **Given** a payload with metrics `step_count`, `active_energy` and `walking_running_distance` holding several samples per day, **Then** the samples are summed per local day within that request and each day is saved (replacing any earlier value).
2. **Given** distance in miles or energy in kilojoules, **Then** they are converted to kilometres and kilocalories.
3. **Given** a payload with other metrics as well, **Then** the others are ignored.

---

### Edge Cases

- A Shortcut runs just after midnight and sends "today" with 0 steps: 0 is valid and saved; a later run replaces it.
- A date that is "today" for the member (e.g. in Asia/Kolkata) but "tomorrow" in server time, or the reverse, is judged by the member's timezone only.
- The same request contains the same date twice: the last occurrence in the request wins.
- A request with an empty list, or a Health Auto Export payload with none of the three metrics: refused with a readable message.
- A request mixing valid and invalid days: refused as a whole, listing every invalid day, so the Shortcut never half-syncs.
- Active calories or distance missing for a day: saved as unknown (not zero); re-sending the day without them clears them, because the whole day is replaced.
- A sync token sent to any other part of the service (the AI connection or a member page request) is refused; an AI key sent to the sync address is refused.
- A member without a completed profile cannot generate a token, and a sync for such an account is refused.
- A member changes their step goal: goal-hit checks, the board's goal-hit counts and streak items all use the current goal for every day.
- A member changes timezone: stored dates are not moved; future "today" checks use the new timezone.
- The Shortcut link is not configured for the deployment: the "Add the SquadFit Shortcut" button is hidden; manual setup steps are still shown.

## Requirements *(mandatory)*

### Functional Requirements

**Daily activity record**

- **FR-001**: The system MUST keep at most one daily activity record per member per local calendar date, holding steps, optional active calories, optional distance, the source (AI agent, Shortcut, Health Auto Export, or manual), the time it was synced and the time it was last updated.
- **FR-002**: Saving a date that already has a record MUST replace all of its values with the new ones (latest write wins, whatever the source); values MUST never be added together across writes.
- **FR-003**: The system MUST accept steps 0–100,000, active calories 0–5,000 and distance 0–150 km, and dates that are not after the member's today and not more than 30 days before it, computed in the member's own timezone.
- **FR-004**: Any invalid day MUST cause the whole request or tool call to be refused with a plain-English message per problem naming the date and field; nothing from that request is saved.
- **FR-005**: The "manual" source MUST exist as a recognised value only; this feature provides no manual entry screen.

**AI agent route**

- **FR-006**: The AI connection MUST offer a tool to save up to 31 days of activity at once, with the description given in User Story 2, acting only as the member who owns the AI key, storing source "AI agent".
- **FR-007**: The save tool MUST return, per saved day, the stored values plus the member's step goal and whether the day hit it.
- **FR-008**: The AI connection MUST offer a tool to read the member's synced days for a date range (at most 31 days, not after today), returning values, source, sync time and the step goal.

**Shortcut / Health Auto Export route**

- **FR-009**: The system MUST offer one sync address that accepts a member's Health sync token as a bearer credential and nothing else; it MUST reject AI keys and sign-in sessions, and the Health sync token MUST be rejected everywhere else.
- **FR-010**: The sync address MUST accept a list of days or a single day object; numbers MUST be accepted as numbers or as text with thousands separators and decimals, and rounded (steps and calories to whole numbers, distance to 2 decimals). An optional `source` of "shortcut" is the default.
- **FR-011**: The sync address MUST recognise the Health Auto Export app's export format by its shape, sum each metric's samples per local day within the request, convert miles to km and kJ to kcal, ignore other metrics, and save with source "Health Auto Export".
- **FR-012**: Responses MUST be: success with the saved days; unauthorised for a missing, malformed, unknown or revoked token; validation failure with readable messages; too many requests after 60 requests in a clock hour for the same member's token.
- **FR-013**: Each successful authentication MUST update the token's last-used time.

**Health sync token**

- **FR-014**: A member with a completed profile MUST be able to generate, regenerate and revoke their own Health sync token from Settings; each member has at most one; regenerating invalidates the previous token immediately.
- **FR-015**: The token MUST be shown in full only once, at creation; only a one-way fingerprint of it is stored. Settings MUST show whether a token exists, when it was created and when it was last used.
- **FR-016**: The token MUST only be able to save daily activity for its owner; it grants no reading of any data.

**Settings: "Apple Health sync"**

- **FR-017**: Settings MUST include an "Apple Health sync" section that explains the two options (AI agent, iPhone Shortcut) in one line each; offers token generate/regenerate/revoke with a copy button; shows an "Add the SquadFit Shortcut" button linking to the deployment-configured Shortcut link (hidden when none is configured); shows the sync address, short setup steps, and the last synced time and source.
- **FR-018**: Settings MUST let the member set a daily step goal (whole number 1,000–50,000, default 8,000) and a "Share my steps" toggle (default on).

**Visibility**

- **FR-019**: A member's steps, active calories, distance, goal and step-streak items MUST be shown to another member only when the owner is visible on the leaderboard AND "Share my steps" is on; this MUST be decided on the server in one place, per request, so a settings change applies to past days immediately. The owner always sees their own.
- **FR-020**: Active calories and distance MUST be shown only on the owner's profile, labelled as coming from Apple Health, and MUST NOT be ranked, sorted or compared anywhere. No responses about other members may include anything about steps beyond what FR-021–FR-025 list.

**Display**

- **FR-021**: On a member profile, each workout day card in the timeline MUST show that day's steps (when synced) and a goal-hit mark when steps ≥ goal. The timeline continues to list workout days only.
- **FR-022**: A member profile MUST show a bar chart of the last 30 days of steps (in the owner's timezone) against the goal, with unsynced days shown empty rather than zero.
- **FR-023**: In "Today's workouts" and the expanded leaderboard row, a member's card MUST show the day's steps when synced, and a sharing member with synced steps but no workout that day MUST appear as "Rest day · N steps".
- **FR-024**: The squad leaderboard MUST gain a "Steps" board for This week and Last 30 days only, ranking sharing members by the average of their synced days' steps in the period (rounded to whole steps, ties share a rank), showing goal-hit days out of the days elapsed in the period in the member's timezone (e.g. "5/7"); members with no synced day in the period are absent.
- **FR-025**: The squad feed MUST show "<name> hit their step goal 7 days in a row" when the 7 days ending on a date all hit the goal, at most one item per non-overlapping 7-day run, removed when it stops being true or the member stops sharing, and dropped at read time for members not sharing. Feed items for daily steps MUST NOT exist.

**Rules and safety**

- **FR-026**: The community rules (constitution principle VI) MUST be amended before release to allow sharing exactly: daily steps, step goal, goal-hit status, step-goal streak items, and (on the profile only) active calories and distance; and to forbid ranking by active calories.
- **FR-027**: Tokens, step values, calories, distances and request bodies MUST never be written to logs.

### Key Entities

- **Daily activity**: one member's totals for one local date: steps, active calories (optional), distance in km (optional), source, synced time, updated time.
- **Health sync token**: one per member at most; stored only as a fingerprint with creation time and last-used time; can only save daily activity.
- **Step settings** (part of the member's profile): daily step goal (default 8,000) and "Share my steps" (default on).
- **Step streak feed item**: a squad feed event marking a 7-day run of goal-hit days, ending on a given date; can be high-fived.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can go from opening Settings to a first successful automatic sync in under 5 minutes using the on-screen steps.
- **SC-002**: Re-sending the same day any number of times, from any mix of sources, always leaves exactly one value for that day, equal to the last one sent.
- **SC-003**: 100% of refused syncs return a message a non-technical member can act on (names the date and what to fix) without contacting support.
- **SC-004**: With "Share my steps" off or leaderboard visibility off, zero step values for that member appear in any view or response seen by another member.
- **SC-005**: A step synced from the Shortcut or AI agent appears on the member's profile, "Today's workouts" and the Steps board the next time those pages are opened.
- **SC-006**: A Health sync token can save activity and do nothing else: every attempt to use it elsewhere is refused.

## Assumptions

- The owner decided: the sync address lives on the same service as the AI connection (not the website); the board averages over synced days only; the profile timeline stays workout-days-only (rest-day steps appear in the 30-day chart); activity can be saved up to 30 days back from both routes (wider than the 3-day edit window used for other AI writes); "manual" is a recognised source with no entry screen; feed copy uses "their".
- The Shortcut is built and published by the owner; the deployment provides its link as configuration.
- A "clock hour" for rate limiting is a UTC hour; 60 requests/hour per member is far above a daily Shortcut's needs.
- Health Auto Export samples carry their own local date; that date is used as the member's local date.
- Active calories here are informational only and are not added to the food ledger's "burned" figure.
- Existing members get the defaults (goal 8,000, sharing on) without a migration.
- The step streak counts consecutive calendar days ending on the run's last day; an unsynced day breaks the run.
