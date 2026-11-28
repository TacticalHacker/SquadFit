# Feature Specification: Reaction Notifications and "Who Reacted"

**Feature Branch**: `022-reaction-notifications`

**Created**: 2026-11-28

**Status**: Draft

**Input**: User description: "Reaction notifications and 'who reacted'. Today when a member reacts (🔥 💪 👑) to another member's feed item or workout day, the owner only sees a count change, which is easy to miss. (1) Notify the owner: an in-app notification (indicator in the header with unread count, and a notifications list: 'Asha reacted 💪 to your workout on 26 Nov' / 'to your PR', tap opens the item), marked read when viewed. No push/email. (2) Show who reacted: anyone who can see a feed item or workout day can open the reactions and see the members per reaction type (avatar + display name), respecting squad privacy (hidden members are not named, same rules as the raid split 'Others'). Also: members can tap their own avatar in the header to open their own profile."

## Context: what already exists

- **Reactions (feature 013).** Members react to other members' feed items (PRs, week hit, club badges, protein/step streaks, posted workout days) and to workout days on profiles with 🔥 Fire, 💪 Strong, 👑 Crown; one of each per member per item, toggleable, never on your own items. Today everyone sees only a count per type; the owner of the item is told nothing.
- **Profiles (feature 011).** Every member has a profile page with history, PR board, heatmap and a timeline of workout days. Other members' profiles are reachable from the squad area; until now the header avatar was not a link.
- **Hidden members.** A member can hide from the leaderboard. Hidden members are excluded from what other members see and are never named (the raid split merges them into one unnamed "Others" share).
- **One squad**; every signed-in member with a completed profile belongs to it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know when someone reacted to my workout (Priority: P1)

Asha reacts 💪 to Ravi's bench PR. Next time Ravi opens any page in the app, the header shows a bell with a "1" badge. Ravi taps it and sees "Asha reacted 💪 to your Bench press PR · 2 h". Tapping the row opens the item (his feed item or his profile day). Once he has opened the list, the badge clears.

**Why this priority**: This is the core complaint: reactions are invisible to the person they are for, so they feel pointless.

**Independent Test**: With two accounts, react to an item of the second account from the first, then sign in as the second and check the bell count, the list wording and that the row opens the right item.

**Acceptance Scenarios**:

1. **Given** Ravi has no unread notifications, **When** Asha reacts 💪 to his PR, **Then** Ravi's header shows an unread count of 1 on his next page load.
2. **Given** Ravi has unread notifications, **When** he opens the notifications list, **Then** each shows who reacted (avatar + name), which reaction, what it was on ("your workout on 26 Nov", "your Bench press PR", "your 3-week streak" …) and how long ago, newest first; and the unread count becomes 0.
3. **Given** a notification row, **When** Ravi taps it, **Then** he lands on the item: his profile with that workout day, or the squad feed item.
4. **Given** Asha reacts 💪 and then removes it before Ravi looks, **When** Ravi opens the list, **Then** there is no notification for it and it does not count as unread.
5. **Given** Asha, Ben and Chen all react to the same workout day, **When** Ravi opens the list, **Then** he sees one row per reacting member (not one per reaction type: Asha giving 🔥 and 💪 shows as one row "Asha reacted 🔥💪").

---

### User Story 2 - See who reacted (Priority: P1)

On any feed item or workout day with reactions, anyone who can see it can tap the reaction counts and see, per reaction type, the members who gave it (avatar + display name, tappable to their profile).

**Why this priority**: Explicitly requested; it is what makes reactions social rather than anonymous counts, and the owner also needs it on their own items (where the buttons are not pressable today).

**Independent Test**: React from two accounts to a third account's workout day, then from any account open "who reacted" on it and check names per type.

**Acceptance Scenarios**:

1. **Given** a feed item with 🔥 2 and 💪 1, **When** any member opens "who reacted", **Then** they see 🔥 Asha, Ben and 💪 Chen, each with avatar and name.
2. **Given** the item is the viewer's own, **When** they tap the counts, **Then** the same list opens (own items still cannot be reacted to).
3. **Given** one of the reactors is hidden from the leaderboard, **When** another member opens the list, **Then** that reactor is not named; they appear only as "+1 other" under that type and the count is unchanged. The hidden member sees themself as "You".
4. **Given** the viewer reacted, **When** they open the list, **Then** they appear as "You" first in that type.

---

### User Story 3 - Open my own profile from the header (Priority: P2)

A member taps their avatar in the header (desktop and phone) and lands on their own profile: history, PRs, heatmap and timeline, the same page others see when they tap them in the squad area.

**Why this priority**: Small and requested; gives a direct way to the member's own history.

**Independent Test**: Tap the header avatar on any page and check the own profile opens.

**Acceptance Scenarios**:

1. **Given** any signed-in page, **When** the member taps their header avatar, **Then** their own profile opens.
2. **Given** the member is hidden from the leaderboard, **When** they tap their avatar, **Then** their own profile still opens.

---

### Edge Cases

- A reactor later hides from the leaderboard: from then on their notifications show "Someone reacted 💪 …" with no avatar, and they are unnamed in "who reacted" lists.
- A reactor's item stops being true (PR no longer a PR, day no longer a workout day): the item and its reactions are removed, so its notifications disappear too; a notification never links to a missing item. If one does (race), opening it shows the normal "not found / private" message.
- The owner hides from the leaderboard: they still get notifications for reactions already given (others can no longer react to their hidden items anyway).
- Very many notifications: the list shows the newest 50; older ones are dropped after 30 days.
- A member toggles the same reaction on and off repeatedly: at most one notification per reactor per item; toggling never makes the unread count grow beyond one for that reactor and item.
- Opening the list on one device clears the badge on others on their next page load.
- An API deployed before this feature: the bell shows no badge and the list is empty rather than an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a member adds a reaction to another member's item, the system MUST create or refresh one notification for the item owner, identified by (item, reactor). It MUST record the reaction types that reactor currently has on that item and when the latest was added.
- **FR-002**: When a reactor removes a reaction, the notification MUST drop that type; when no types remain, the notification MUST be removed.
- **FR-003**: When a feed item or workout-day reaction target is deleted, its notifications MUST be removed (or never be shown).
- **FR-004**: The header MUST show a notifications entry (bell icon) on every signed-in page, with a badge of the unread count (capped display "9+") when it is above zero.
- **FR-005**: A notification is unread when its latest reaction is newer than the time the owner last opened the notifications list. Opening the list MUST mark all as read.
- **FR-006**: The notifications list MUST show, newest first, up to 50 notifications from the last 30 days: reactor avatar + name (or "Someone" if hidden), the reaction emoji, a plain description of the item ("your workout on 26 Nov", "your Bench press PR", "your 3-week streak", "your 300 kg club badge", "your 7-day protein streak", "your 7-day step streak", "joining the squad"), relative time, and unread rows visually marked.
- **FR-007**: Tapping a notification MUST open the item: workout days and posted days open the owner's profile at that day; other feed items open the squad feed.
- **FR-008**: Any member who can see an item's reactions MUST be able to open "who reacted" from the reaction counts, including on their own items.
- **FR-009**: "Who reacted" MUST list, per reaction type, the visible reactors by avatar and display name, viewer first as "You", the rest in the order they reacted; each name links to that member's profile.
- **FR-010**: Members hidden from the leaderboard MUST NOT be named, shown or linked to anyone but themselves, in either "who reacted" or notifications; they appear only as a count ("+N others", "Someone").
- **FR-011**: The header avatar MUST link to the member's own profile.
- **FR-012**: Responses MUST carry only display name, avatar and member id for reactors (never username, timezone, targets or weights). Names, reactions and notification contents MUST NOT be written to logs.
- **FR-013**: No push, email or other out-of-app delivery.

### Key Entities

- **Reaction notification**: belongs to the item owner; one per (item, reactor): item reference (owner, event), reactor, current reaction types, first and latest reaction time, expiry 30 days after the latest reaction.
- **Notifications read marker**: per member, the time they last opened the notifications list.
- **Reactor list** (derived, not stored): the existing reactions of an item grouped by type, filtered by the viewer's visibility rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of reactions added by one member to another's item appear as an unread notification for the owner on their next page load.
- **SC-002**: A member can go from any signed-in page to the item someone reacted to in 2 taps (bell, row).
- **SC-003**: A member can see who reacted to any visible item in 1 tap from the reaction counts.
- **SC-004**: No hidden member's name or avatar ever appears to another member in notifications or reactor lists (verified by tests on every response).
- **SC-005**: Showing the unread count adds no noticeable delay to page loads (header renders in the same time as before for members with no notifications).

## Assumptions

- Notifications are pulled on page load/navigation; no live updates while a page stays open.
- Only reactions produce notifications in this feature (not new feed items, raids or comments).
- Grouping is per reactor per item (FR-001); a daily digest or "Asha and 2 others" collapsing is not needed for a small squad.
- Read state is "all read when the list is opened"; there is no per-row mark-read or delete.
- Notifications existing before this feature are not backfilled: reactions given before deploy produce no notifications, but they do show in "who reacted".
- Per the API resource limit, new endpoints join existing functions; this is a delivery constraint, not a user-visible one.
