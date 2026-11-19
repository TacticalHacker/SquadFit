# Feature Specification: Exercise Admin Panel

**Feature Branch**: `015-exercise-admin-panel`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Admin panel for the gym exercise library. Built-in gym exercises are currently a code constant, so every new exercise needs a code deploy. Add an operator-managed exercise catalog that the app reads at runtime, plus an in-app admin panel where admins add exercises (name, muscle group; strength only for now) and rename or retire them, with no deploy. Existing code built-ins stay as they are (their ids are permanent and the Big 3/4, PR jump and club badges depend on them); catalog exercises get new permanent ids, appear to every member alongside the built-ins, clash-check names against built-ins, the catalog and members' own exercises, and are usable by the AI agent by exact name. Retiring an exercise hides it from the picker but keeps past entries and history. Admin role: only members marked admin can open the panel or use the admin actions (server-enforced), granted by the operator via the admin CLI; the initial admins are the users roshan and nikhil. Non-admins never see the panel link. Optionally, from the panel an admin can merge members' own exercises with the same name into a catalog exercise."

> Feature number 015: 014 is reserved for relative strength / body-weight log (see CLAUDE.md, feature 013 notes).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin adds a new exercise for everyone (Priority: P1)

A squad member asks for "Cable Kickback". An admin opens the admin panel, types the name, picks the muscle group (Arms) and saves. Within a few minutes every member sees "Cable Kickback" in the Gym picker under Arms, can log sets on it, and gets "last time" values and PRs for it like any built-in exercise. No one had to ship code.

**Why this priority**: This is the whole point of the feature: new exercises without a deploy.

**Independent Test**: As an admin, add an exercise in the panel; as another member, open the Gym tab, find it under its group and by search, log sets, and see it on the next day's "last time".

**Acceptance Scenarios**:

1. **Given** an admin on the panel, **When** they add "Cable Kickback" in Arms, **Then** it is listed in the panel and, within 5 minutes, appears for every member in the Gym picker under Arms and in search.
2. **Given** a name that matches a built-in, an existing catalog exercise, or ignores only case/spacing differences (e.g. "bench  press"), **When** the admin saves, **Then** it is refused with "An exercise with this name already exists" and nothing is created.
3. **Given** a member who logged a catalog exercise, **When** they view their history, squad profile, timeline and day cards, **Then** the exercise shows and counts exactly like a built-in one (workout days, improved lifts, PR feed items, burned calories).
4. **Given** a member's AI agent, **When** it logs a workout using the catalog exercise's exact name or id, **Then** the entry is saved like any built-in exercise.

---

### User Story 2 - Only admins can manage the library (Priority: P1)

The operator marks roshan and nikhil as admins with the admin CLI. They see an "Admin" link in the app (Settings); everyone else sees no link, and opening the panel's address or calling its actions directly is refused.

**Why this priority**: Without access control, any member could change the shared library for everyone. Ships together with Story 1.

**Independent Test**: Grant admin to one user with the CLI; sign in as that user and as a non-admin; confirm only the admin sees the link and can save; confirm the non-admin's direct request is refused.

**Acceptance Scenarios**:

1. **Given** the operator runs the grant command for "roshan" and "nikhil", **When** either signs in, **Then** they see the Admin link and can use the panel.
2. **Given** a non-admin member, **When** they open the panel address directly, **Then** they get a "not found" page, and any admin action they attempt is refused by the server.
3. **Given** an admin whose role the operator revokes, **When** their current session next refreshes (within one hour at most), **Then** they lose access.
4. **Given** the operator lists admins with the CLI, **Then** it prints the usernames that have the role.

---

### User Story 3 - Admin renames, regroups or retires an exercise (Priority: P2)

An admin fixes a typo ("Arnold Pres" → "Arnold Press"), moves an exercise to another muscle group, or retires one nobody should use. A retired exercise disappears from the picker for new logs but every past entry, PR, feed item and board figure stays as it was. A retired exercise can be restored.

**Why this priority**: Mistakes happen; without edit/retire the library only grows and typos stay forever. Not needed for the first add.

**Independent Test**: Rename, regroup, retire and restore one catalog exercise and check the picker and a member's past entries after each step.

**Acceptance Scenarios**:

1. **Given** a catalog exercise, **When** an admin renames it, **Then** the picker and new logs use the new name; past entries keep the name they were logged with (entries snapshot their name), and history and PRs continue under the same exercise.
2. **Given** a catalog exercise, **When** an admin retires it, **Then** it no longer appears in the picker or in AI name matching for new logs, and every past entry and figure based on it is unchanged; a day that already has an entry for it still shows that entry.
3. **Given** a retired exercise, **When** an admin restores it, **Then** it appears in the picker again with its history intact.
4. **Given** a code built-in exercise (e.g. Bench Press), **Then** the panel shows it read-only: it cannot be renamed, regrouped or retired from the panel.

---

### User Story 4 - Admin folds members' own copies into a catalog exercise (Priority: P3)

Before the library had "T-Bar Row", two members created their own "T-Bar Row". After the admin adds it, the panel shows "2 members have their own exercise with this name" and offers **Merge**. Merging moves those members' logged days onto the catalog exercise so their history, "last time" and PRs live in one place, and removes their now-duplicate own exercise.

**Why this priority**: Nice clean-up that today needs the operator CLI; the library works without it.

**Independent Test**: Create an own exercise for a member with a catalog exercise's name, log days on it, merge from the panel, and check the member's history now sits on the catalog exercise.

**Acceptance Scenarios**:

1. **Given** members with own exercises whose name matches a catalog or built-in strength exercise (ignoring case and spacing), **When** an admin views that exercise, **Then** the panel shows how many members have a match, never who they are or what they lifted.
2. **Given** the admin confirms Merge, **Then** each matching member's logged days move to the library exercise with sets, dates and notes unchanged; a day where the member already logged the library exercise is left alone (and that member's own exercise is kept); the panel reports moved days and skipped days as counts.
3. **Given** a merge, **Then** each affected member's squad stats and feed are refreshed so boards and PRs reflect the merged history.

---

### Edge Cases

- Two admins add the same name at the same moment: exactly one succeeds, the other gets the "already exists" message.
- A member has their own exercise with the same name as a newly added catalog exercise: both appear until merged (Story 4); members cannot create a new own exercise with a library name.
- Adding when the catalog is at its maximum size (200 exercises): refused with a clear message.
- A name longer than 40 characters, empty, or only spaces: refused with the same messages members see for their own exercises.
- A member has the Gym drawer open for an exercise that an admin retires: their save still succeeds for that day (retiring only hides it from the picker); a later fresh open won't list it.
- A retired exercise's name: still reserved, so it cannot be reused for a different exercise (restore it instead).
- The catalog can't be read (temporary outage): members still see and can log every code built-in exercise and any exercise they already have an entry for that day; catalog-only exercises reappear when reading recovers.
- Cardio: only strength exercises can be added from the panel in this feature.

## Requirements *(mandatory)*

### Functional Requirements

**Library**

- **FR-001**: The exercise library MUST be the code built-ins plus an admin-managed catalog stored as data, so adding, renaming, regrouping, retiring or restoring a catalog exercise requires no code change or deploy.
- **FR-002**: Catalog exercises MUST get a new permanent id in the same family as built-ins, never reused or changed after creation; built-in ids and their special roles (Big 3/4, PR jump lifts, club badges) MUST stay unchanged and cannot be edited from the panel.
- **FR-003**: Catalog exercises MUST be strength exercises with a name (1–40 characters, trimmed, inner spaces collapsed) and one of the existing muscle groups other than Cardio.
- **FR-004**: A name MUST be refused when it matches, ignoring case and spacing, any built-in or any catalog exercise (active or retired).
- **FR-005**: Members MUST NOT be able to create an own exercise whose name matches a library exercise (built-in or active catalog).
- **FR-006**: Every member MUST see active catalog exercises in the Gym picker under their group and in search, after the built-ins of that group, within 5 minutes of an admin change.
- **FR-007**: Logging, totals, "last time", PRs, the jump rule, improved lifts, feed events, timeline and day cards MUST treat catalog exercises exactly like built-in strength exercises.
- **FR-008**: The AI agent MUST be able to log a catalog exercise by its id or exact name (case and spacing ignored); retired exercises are not matched by name for new logs.
- **FR-009**: Retiring MUST hide the exercise from the picker and name matching only; all past entries and derived figures stay. A day that already has an entry for a retired exercise MUST still show and allow editing that entry within the normal edit window.
- **FR-010**: Renaming MUST change the name for the picker and future entries only; past entries keep their logged name.
- **FR-011**: The catalog MUST hold at most 200 exercises (active + retired).

**Admin access**

- **FR-012**: Admin is a role on a member account, granted, revoked and listed only by the operator through the admin CLI. The initial admins are the users `roshan` and `nikhil`.
- **FR-013**: Every admin action MUST be authorized on the server from the caller's verified identity; the web app hiding the link is not a security control.
- **FR-014**: Non-admins MUST NOT see any admin link, and the admin page MUST respond as "not found" for them.
- **FR-015**: Revoking the role MUST take effect no later than the admin's next session refresh (at most one hour).

**Admin panel**

- **FR-016**: The panel MUST list the library grouped by muscle group, showing built-ins as read-only and catalog exercises with their status (active/retired), and let an admin add, rename, change group, retire and restore catalog exercises.
- **FR-017**: For each strength exercise in the library, the panel MUST show the number of members who have an own exercise with a matching name, and offer Merge (Story 4). It MUST NOT reveal which members or any of their logged data.
- **FR-018**: Merge MUST move each matching member's own-exercise days onto the library exercise unchanged (sets, dates, notes, confirmations), skip days already logged on the library exercise, remove the own exercise only when nothing was skipped, refresh affected members' squad stats and feed, report counts only, and be safe to run again.
- **FR-019**: Each catalog exercise MUST record who created it and when, and when it was last changed and by whom (visible in the panel).

**Privacy and logging**

- **FR-020**: Exercise names, member identities and lifting data MUST NOT be written to logs by admin actions; logs may contain counts and error names only.

### Key Entities

- **Catalog exercise**: permanent id, name, muscle group, kind (strength), status (active/retired), created by/at, updated by/at. Shared by all members.
- **Admin role**: a property of a member account, set by the operator; read from the member's verified identity on every admin request.
- **Library**: the merged view of code built-ins and active catalog exercises that every member's Gym picker, AI matching and name-clash checks use.
- **Merge result**: counts of members affected, days moved, days skipped and own exercises removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add a new exercise in under 1 minute, and every member can log it within 5 minutes, with zero code changes or deploys.
- **SC-002**: 100% of admin actions attempted by non-admin accounts are refused by the server.
- **SC-003**: After retiring, renaming or merging, 100% of past entries, PRs and board figures remain identical (except merged own-exercise days now appearing under the library exercise).
- **SC-004**: No duplicate-by-name exercise can exist in the library (built-ins + catalog).
- **SC-005**: Gym page load time for members does not noticeably increase (stays within 10% of today).

## Assumptions

- The squad is small (tens of members), so 200 catalog exercises and a few-minute propagation delay are enough.
- Admin status is managed by the operator only; admins cannot grant admin to others from the app.
- The panel lives under Settings → Admin on the existing web app; it is used mostly on phones and follows the existing theme.
- Code built-ins (54 after the 2026-11-19 additions) stay in code; there is no need to move them into the catalog.
- Cardio exercises (which need calorie rates) and timed exercises (planks) are out of scope; they can be added in a later feature.
- Exercise names are not personal data; they may be shown to all members.
- Merging uses the same rules as the existing operator command `pnpm admin gym merge`, which remains available.
