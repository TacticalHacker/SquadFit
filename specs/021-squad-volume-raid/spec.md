# Feature Specification: Squad Volume Raid

**Feature Branch**: `021-squad-volume-raid`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "SquadFit — Squad Volume Raid Spec" (2026-11-27). A raid is a shared volume target (weight × reps) the whole squad fills within admin-set dates. Every set a member already logs counts automatically: nothing to join, no extra taps. In scope: admin create, edit, schedule and cancel; automatic counting; the raid card on the Squad tab; the win moment; a raid sticker stored per member. Out of scope: raids between squads, protein or step raids (the model leaves room for them), push notifications. (Lifecycle, form fields, editing rules, counting rules, card states and the acceptance table are reproduced below, adapted to how the app works today.)

> Numbering note: branch `020-pre-workout-meal` already exists (empty), so this feature is 021.

## Context: what already exists

- **One squad.** There are no groups: every member with a completed profile belongs to one global squad. Members can hide from the leaderboard; hidden members are excluded from everything other members see. There is no "leave the squad" action. The squad has its own time zone (default Asia/Kolkata), already used for "this month" on the boards.
- **Admins** are members in the `admin` group (feature 015); they have an admin panel in Settings. Everyone else has no admin controls.
- **Gym logging.** A gym session is one entry per exercise per day, dated with the member's own local date, holding sets of weight × reps with a DONE tick. Members can edit today and the two previous days. "Total weight lifted" already exists on the drawer, day cards and profiles (weight × reps summed). Cardio exercises have no weight × reps. AI agents can also save gym entries through the same save path.
- **Exercise groups**: every exercise (built-in, admin catalog or the member's own) has one group: chest, back, legs, shoulders, arms, core or cardio.
- **Big jumps.** A set more than 50% **and** more than 20 kg above the member's previous best is held as an "Unusual jump" until the member taps **Looks right**.
- **No bodyweight flag** exists on exercises yet (feature 019 deferred it); a blank weight saves as 0 kg.
- **After-save toast** exists in the Gym tab (feature 019): "★ 1 PR · +1,450 kg lifted · 2-week streak". A PR haptic exists.
- **Design rules** forbid scale animations, glows and gradients; turmeric `accent-fill` is reserved for the one primary action per section, data marks may use the accent.
- **Product decision (feature 013):** "Total weight lifted is never a board" — members are not ranked by volume.

## Clarifications

### Session 2026-11-27

- Q: Should bodyweight exercises count reps × the member's latest weigh-in? → A: No. Every 0 kg set (pull-ups included) adds 0 kg in this feature. Counting body weight would mix each member's private weigh-in into a figure others see. The "+720 kg" acceptance case is dropped. Bodyweight volume can return once exercises carry a bodyweight flag, probably as reps rather than kg.
- Q: Does a hidden member's lifting count? → A: Yes, toward the squad total, and they get the sticker, but they are never named or shown as a contributor. They still see their own "You: x kg". The guessing risk from a mixed squad total is accepted as small.
- Q: Top contributors ranked by kg, or who took part? → A: Who took part, without kg. Feature 013's rule ("total weight lifted is never a board") stands: ranking by raw weight puts beginners off, and a raid should feel like a team effort. The card shows up to 5 avatars of contributors, most recent first; the admin toggle is renamed "Show contributors". Each member's own kg stays visible to them only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The squad fills a live raid just by training (Priority: P1)

A raid "Leg Day Siege" is live: target 40,000 kg, Mon 1 Dec – Sun 7 Dec. At the top of the Squad tab every member sees the raid card: name, tagline, a turmeric progress bar with a thin pace tick, "28,400 / 40,000 kg · 71%", "3 days left", "You: 6,200 kg (22%)" and the avatars of who took part. A member logs 80 kg × 8 × 3 sets of squats as usual; after Save the existing toast adds "+1,920 kg to raid", and the card shows the new total next time the Squad tab loads. Nothing in the logging flow changes.

**Why this priority**: This is the feature: shared progress driven by logging members already do.

**Independent Test**: Seed a live raid (created directly, without the admin form), log and edit gym sets as two members, and check the card's total, each member's contribution and the toast.

**Acceptance Scenarios** (live raid, target 40,000 kg, cap 40% = 16,000 kg, Mon 1 Dec 00:00 – Mon 8 Dec 00:00 IST, all exercises):

1. **Given** a member saves 80 kg × 8 × 3 ticked sets of bench, **Then** the raid total rises by 1,920 kg and the toast reads "… · +1,920 kg to raid".
2. **Given** a workout dated Sun 7 Dec saved Mon 8 Dec 10:00 IST, **Then** it counts (within the 12-hour grace).
3. **Given** a workout dated Sun 7 Dec saved Mon 8 Dec 13:00 IST, **Then** it does not count, and the toast shows no raid part.
4. **Given** a member whose raw raid volume reaches 18,000 kg, **Then** 16,000 kg counts toward the bar and their line reads "You: 16,000 kg (40%) · capped".
5. **Given** a set held for **Looks right**, **Then** it adds nothing until the member confirms it; after confirming, it counts.
6. **Given** a member edits a saved session inside the raid to fewer reps, or deletes it, **Then** the total drops accordingly.
7. **Given** unticked sets in a saved session, **Then** they add nothing to the raid (even though "kg lifted" in the toast counts them, as today).
8. **Given** a cardio exercise or an activity entry, **Then** it adds nothing.
9. **Given** pull-ups logged at 0 kg × 10 (whatever the member's body weight), **Then** they add 0 kg.
10. **Given** a legs-only raid and a member logs bench, **Then** bench adds 0 kg and the toast shows no raid part.
11. **Given** no raid is live, **Then** the toast is unchanged from today.
12. **Given** a member hidden from the leaderboard saves 1,000 kg of counting sets, **Then** the squad total rises by 1,000 kg, they see "You: 1,000 kg" on their own card, and no one else sees their avatar or name on the raid.
13. **Given** seven members have contributed, **Then** the card shows 5 avatars, most recent contributor first, with no kg beside them.

---

### User Story 2 - Winning the raid (Priority: P1)

On Thursday the total reaches 40,000 kg. The raid becomes **won** at that moment and every member who has at least one counting set receives the "Raid Cleared" sticker. The card switches to a "RAID CLEARED" stamp with the final %, and keeps filling past 100% until the end date ("118%"). The first time each member opens the Squad tab after the win, the stamp appears once with a fade and the PR haptic. A member whose first counting set comes after the win still gets the sticker.

**Why this priority**: The win moment is the payoff that makes the raid worth chasing.

**Independent Test**: Seed a live raid 100 kg short of target, save a 100 kg set, then check status, stickers for each contributor, the stamp shown once, and later contributions still adding to the total.

**Acceptance Scenarios**:

1. **Given** the total reaches 40,000 kg on Thu, **Then** the raid is won, each contributor holds the sticker, and the bar keeps filling past 100% until the end.
2. **Given** a won raid, **When** a member deletes sets so the total falls below the target, **Then** the raid stays won (a win is final) and the total shows the lower figure.
3. **Given** a member who first contributes after the win, **Then** they receive the sticker on that save.
4. **Given** the end date passes below target, **Then** the card reads "Raid ended · 86%" with no penalty and no effect on streaks.
5. **Given** a won or ended raid after its grace period, **When** a member edits a workout dated inside the raid, **Then** the raid total does not change (frozen).
6. **Given** a won raid, **Then** the card stays on the Squad tab for 3 days after the end date, then moves to raid history; an ended one also stays 3 days.

---

### User Story 3 - An admin creates and schedules a raid (Priority: P2)

An admin opens the Squad tab, taps "+ New raid" and sees a form with sensible defaults (name "Squad Volume Raid", start next Monday 00:00, end 7 days later, suggested target, cap 40%) and a live preview of the card. They name it "Leg Day Siege", pick "Legs" as the counting group and save. Members now see "Next raid: Leg Day Siege · starts Mon 1 Dec". At the start time it goes live on its own.

**Why this priority**: Raids need a way in, but Story 1 can be tested with a seeded raid; the form is the second slice.

**Independent Test**: As an admin, create raids with the form and check each rule below; as a non-admin, check there is no "+ New raid" and that admin requests are refused.

**Acceptance Scenarios**:

1. **Given** the admin turns on **Start now** and saves, **Then** the raid is live immediately and the card appears for everyone.
2. **Given** a raid scheduled for 1–8 Dec, **When** the admin schedules another for 5–12 Dec, **Then** it is refused with "Dates overlap Leg Day Siege", shown inline.
3. **Given** an end 40 days after the start, **Then** refused: "A raid can last at most 31 days".
4. **Given** 1 live and 3 scheduled raids, **When** the admin schedules a fifth, **Then** refused: at most 3 scheduled raids.
5. **Given** a live raid, **When** the admin tries **Start now** on another, **Then** refused: one live raid at a time.
6. **Given** the squad logged 30,000 kg a week on average over the last 4 weeks, **When** the admin opens a 7-day form, **Then** the suggested target is 33,000 kg (30,000 × 7/7 × 1.1, rounded to 500 kg). With no history the target field is empty and required.
7. **Given** a non-admin member, **Then** they see no admin controls, and any admin action is refused.
8. **Given** the admin saves a draft, **Then** members do not see it and it holds no schedule slot until it is scheduled.

---

### User Story 4 - An admin edits or cancels a raid (Priority: P3)

During a live raid the admin can rename it, change the tagline, extend or shorten the end date, raise or lower the target (not below current progress) and toggle "Show contributors". Start, counting exercises and per-member cap are locked. They can cancel any raid before it ends, with an optional reason shown as "Raid cancelled · <reason>".

**Why this priority**: Corrections and cancellations are rare but needed; the form already covers creation.

**Independent Test**: Apply each editing rule below to raids in each state and check the result and the inline message.

**Acceptance Scenarios**:

1. **Given** a live raid with total 28,400 kg, **When** the admin lowers the target to 20,000 kg, **Then** refused: "Target can't be below current progress (28,400 kg)".
2. **Given** a live raid, **Then** start date, counting exercises and per-member cap are shown locked in the form, and a request changing them is refused.
3. **Given** a live raid, **When** the admin moves the end date earlier than now, **Then** refused.
4. **Given** a scheduled or draft raid, **Then** every field can change, and it can be deleted.
5. **Given** a won, ended or cancelled raid, **Then** nothing can change.
6. **Given** a live raid, **When** the admin cancels with reason "Gym closed for Diwali", **Then** the card reads "Raid cancelled · Gym closed for Diwali" for 1 day, no stickers are given from then on (stickers already given are kept), and the raid moves to history.
7. **Given** two admins edit the same raid at once, **Then** the second save is refused as out of date and the form reloads the current values.

---

### User Story 5 - Raid history and stickers (Priority: P3)

Below the raid card (or on its own when no raid is on the card) a "Raid history" link lists past raids, newest first: name, dates, final total and %, outcome (cleared, ended, cancelled) and whether you contributed. A member's profile shows the raid stickers they have earned.

**Why this priority**: Nice closure; the raids themselves work without it.

**Independent Test**: With three past raids in different outcomes, open history and a contributor's profile.

**Acceptance Scenarios**:

1. **Given** past raids, **Then** history lists each with outcome, final % and "You: x kg" (or "You didn't take part").
2. **Given** a member who earned the sticker in two raids, **Then** their profile shows the "Raid Cleared" sticker with ×2.

### Edge Cases

- **Raid starting mid-day (Start now)**: workouts are dated, not timed, so the whole start day counts, including sets logged earlier that day.
- **Day boundaries**: the raid's dates are in the squad time zone; a workout counts when the member's own local workout date falls on a raid day (start date to the day before the end, inclusive) and the save happens before end + 12 hours. A member in another time zone is judged by their own workout date, never by UTC.
- **Edits inside the edit window but after the grace**: members may still edit Sunday's session on Tuesday (the normal edit window), but once the grace has passed the raid total no longer changes.
- **Edits to a day before the raid**: never affect it.
- **Late joiners** (profile completed mid-raid): count automatically when the raid has "Late joiners count" on (default); when off, only members whose profile was complete at the raid's start count.
- **Hidden members** (leaderboard off): their sets count toward the total and they earn the sticker, but they never appear on the card, in history or anywhere else on the raid for other members. Turning "hidden" on mid-raid removes their avatar at once; their kg stays in the total.
- **Merged exercises** (feature 015): days moved by a merge count under the target exercise's group for the filter; the raid total is recomputed.
- **AI agent writes**: gym entries saved by a member's AI agent count exactly like their own saves.
- **Cap smaller than one session**: a member's counted kg never exceeds the cap, even within one save.
- **Target edited above total on a won raid**: impossible (won raids are read-only).
- **Target raised on a live raid** so progress is now below it: allowed; the bar recalculates.
- **End shortened on a live raid** so that the total already exceeds the target: the raid is won at that moment.
- **Raid with zero contributors**: ends at 0%, no stickers.
- **Pace tick** before any time has passed sits at 0; at or after the end it is hidden.
- **Two saves at the same moment** by different members: both count; the total never loses an update, and the win happens exactly once.

## Requirements *(mandatory)*

### Functional Requirements

**Lifecycle**

- **FR-001**: A raid has one of six states: **draft** (saved by an admin, invisible to members, holds no slot), **scheduled** (start in the future), **live**, **won** (target reached; still counting until the end), **ended** (end passed below target), **cancelled**. Won, ended and cancelled are final.
- **FR-002**: A scheduled raid becomes live at its start time and a live raid becomes ended at its end time; members see the correct state within 1 minute of those times, with no action by anyone.
- **FR-003**: A raid becomes won at the moment its counted total first reaches the target. A win is never undone, even if later edits lower the total.
- **FR-004**: Contributions keep updating until end + 12 hours (the grace); after that the total and every contribution are frozen.
- **FR-005**: At most one raid is live at a time and at most 3 are scheduled. Live and scheduled raids never overlap in time.

**Admin: create and edit**

- **FR-006**: Only admins can create, edit, schedule, delete or cancel raids; every such request from a non-admin is refused on the server.
- **FR-007**: The create form has these fields, with a live preview of the card:

  | Field | Required | Default | Limits |
  |---|---|---|---|
  | Name | Yes | Squad Volume Raid | 3–40 characters |
  | Tagline | No | blank | ≤ 120 characters, shown under the name |
  | Start | Yes | Next Monday 00:00, or **Start now** | now to 90 days ahead |
  | End | Yes | Start + 7 days | 1–31 days after start |
  | Target (kg) | Yes | Suggested (FR-008) | 1,000 – 10,000,000 kg |
  | Counting exercises | No | All | muscle groups (chest, back, legs, shoulders, arms, core) and/or specific library exercises |
  | Per-member cap | No | 40% of target | 10–100% |
  | Late joiners count | No | On | |
  | Show contributors | No | On | |
  | Reward sticker | No | Raid Cleared | from the sticker set (one sticker in this feature) |

  All dates and times are in the squad time zone.
- **FR-008**: The suggested target is the squad's average weekly counted volume over the last 4 full weeks (using the raid's counting exercises, before caps), scaled to the raid's length in days ÷ 7, plus 10%, rounded to the nearest 500 kg and at least 1,000 kg. With less than 4 weeks of history it averages the weeks that exist; with none, there is no suggestion and the admin must type a target.
- **FR-009**: Editing follows these rules; anything else is refused with a message the form shows inline:

  | State | Admin can change |
  |---|---|
  | Draft, scheduled | Everything, or delete it |
  | Live | Name, tagline, end (not earlier than now, still 1–31 days after start, no overlap), target (not below current counted total), "Show contributors" |
  | Live, locked | Start, counting exercises, per-member cap, late joiners, sticker |
  | Won, ended, cancelled | Nothing |

- **FR-010**: An admin can cancel a draft, scheduled or live raid (not won or ended) with an optional reason (≤ 120 characters). A cancelled raid stops counting and gives no further stickers.
- **FR-011**: Concurrent admin edits never silently overwrite each other: a save based on an out-of-date version is refused.

**What counts**

- **FR-012**: Raid volume = weight × reps summed over every **counting set**: a set in a saved gym entry of a counting exercise, ticked DONE, with reps ≥ 1, by a counting member, on a raid day (see Edge Cases), saved before end + 12 hours. Warm-up sets count.
- **FR-013**: A set held as an unusual jump counts only after the member confirms it with **Looks right**. Cardio exercises and activity entries never count.
- **FR-014**: Sets at 0 kg add 0 kg, bodyweight exercises (pull-ups, dips, push-ups) included. Body weight is never used in raid volume.
- **FR-015**: Each member's counted contribution is min(raw volume, cap); only counted kg fills the bar. A member's raw volume above the cap is kept and shown to that member only ("· capped").
- **FR-016**: Counting members are every member with a completed profile (subject to the late-joiner toggle). Members hidden from the leaderboard count toward the total and earn stickers like everyone else, but are never named or shown to other members (FR-029).
- **FR-017**: Any save, edit, delete, jump confirmation or merge of a gym entry (by the member or their AI agent) updates the affected member's contribution and the raid total before the save returns, so the toast can show the change and the Squad tab reads a current total.
- **FR-018**: Removing a member's account is out of scope; a member's contribution is never removed for any reason other than editing or deleting their own sets.

**Stickers**

- **FR-019**: When the raid is won, every member with at least one counting set receives the raid's sticker; a member whose first counting set comes later (before the freeze) receives it then. A member holds at most one sticker per raid and keeps it forever.
- **FR-020**: Stickers are shown on the member's profile (with a count when earned more than once) and on the won raid's card for the viewer.

**Squad tab card**

- **FR-021**: The raid card is the first block on the Squad tab and never appears in the logging drawer or anywhere in the logging flow. It shows:

  | State | Card |
  |---|---|
  | None | Nothing for members; admins see "+ New raid" |
  | Scheduled (next one) | "Next raid: Leg Day Siege · starts Mon 1 Dec" |
  | Live | Name, tagline, progress bar, "28,400 / 40,000 kg · 71%", "3 days left", your contribution, who took part |
  | Won | "RAID CLEARED" stamp, final %, sticker; until 3 days after the end, then history |
  | Ended | "Raid ended · 86%"; until 3 days after the end |
  | Cancelled | "Raid cancelled" + reason; for 1 day after cancelling |

  Admins also see a way to manage the raid shown (edit, cancel) and to add a raid when the next slot is free.
- **FR-022**: Progress bar: turmeric fill on the paper-grey track; past 100% the bar stays full and the % keeps rising. A thin pace tick marks elapsed time ÷ raid length. Under the bar: "You: 6,200 kg (22%)" (% of target), plus "· capped" when capped; members with no counting sets see "You: 0 kg — any lift counts".
- **FR-023**: Who took part: up to 5 avatars of visible members with at least one counting set, most recent counting save first, with no kg, rank or order by volume beside them (feature 013: total weight lifted is never a board). Hidden when "Show contributors" is off, leaving only the squad total and "You: x kg". No member's kg is ever shown to anyone but that member.
- **FR-024**: The Squad tab loads the raid card's data in the same single request it makes for the card (one read of the raid and its totals); no extra request per contributor.
- **FR-025**: After a save that changed the member's counted contribution to a live or won raid (before the freeze), the existing toast adds "+1,920 kg to raid" (only when positive; a reduction shows nothing). Nothing else in the logging flow changes.
- **FR-026**: The first time a member opens the Squad tab after a win they took part in, the stamp appears once with a fade and colour change (no scale) and the PR haptic; with reduced motion, fade only. It does not replay on later visits on that device.
- **FR-027**: All raid wording ("to raid", "days left", "capped", "RAID CLEARED", "Raid ended", "Raid cancelled", form messages) lives with the rest of the squad wording.

**Privacy and limits**

- **FR-028**: Raids are visible only to signed-in members; nothing about raids is served to anonymous visitors or the public landing page.
- **FR-029**: Raid responses about other members carry only display name and avatar (FR-023); never their kg (counted or raw), cap status, body weight, timezone or username. A member's own kg, %, and "capped" are returned only to that member. Members hidden from the leaderboard never appear by name.
- **FR-030**: AI agents get no raid data in this feature.
- **FR-031**: Raid names, taglines, reasons, contributions, sets and weights are never written to logs.

### Key Entities

- **Raid**: squad, name, tagline, start, end (instants in the squad time zone), target kg, metric (volume kg now; protein or steps later), counting filter (all, or groups and/or exercise ids), per-member cap %, late joiners, show contributors, sticker, state, counted total, won at, created by, cancel reason, version for safe concurrent edits.
- **Raid contribution** (one per member per raid): counted kg, raw kg, first counting set at, last counting save at (for "most recent first"), updated at. Visible only to its member, except that the member took part.
- **Sticker award** (one per member per raid): member, raid, sticker, awarded at. Shown on the member's profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The logging flow has exactly the same taps, sheets and popups as before.
- **SC-002**: The Squad tab shows the raid card with one data request for it.
- **SC-003**: State changes (scheduled → live, live/won → final) are visible to members within 1 minute of the start and end times.
- **SC-004**: After any sequence of saves, edits, deletes and confirmations by any members, the raid total equals the sum of every member's counted contribution recomputed from their sets, and the raid is won at most once.
- **SC-005**: Every acceptance scenario in Stories 1–5 passes.
- **SC-006**: The toast's "+x kg to raid" matches the change in the member's counted contribution from that save.

## Assumptions

- **Squad**: "the squad" is the one global squad; raids are keyed by squad so more squads can be added later. Raids between squads are out of scope.
- **Admin entry point**: the source's "Squad tab → admin menu" is the raid card area of the Squad tab, visible only to admins; the form is its own page. The existing Settings admin panel may link to it.
- **Sticker set**: only one sticker, "Raid Cleared", exists in this feature; the picker shows it alone until more are added.
- **"Members who leave"**: there is no leave action; nothing is ever removed from a raid except by editing one's own sets.
- **Ticked sets only**: the raid counts ticked sets (source: "ticked DONE where used"), while "kg lifted" elsewhere counts every set (feature 006), so the two figures can differ for sessions with unticked sets.
- **Muscle groups** for the filter are the existing exercise groups (chest, back, legs, shoulders, arms, core); own and catalog exercises count by their group; specific-exercise picks are library exercises.
- **Stamp "once"** is tracked on the device; a second device may show it once more.
- **Out of scope**: push notifications, feed posts for raids, protein or step raids, AI agent access, raids between squads, account removal.
