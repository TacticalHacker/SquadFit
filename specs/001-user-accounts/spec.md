# Feature Specification: User Accounts & Profiles

**Feature Branch**: `001-user-accounts`

**Created**: 2026-11-11

**Status**: Draft (clarified)

**Input**: User description: "Auth & squads (groups): users sign up / sign in, create a squad, invite friends via link/code, join a squad, and view squad members. Foundation for the workout tracker, nutrition tracker, scoreboard, streaks and nudges described in docs/prd.md. Each user has name, avatar, IANA timezone and daily calorie target." Revised: "Remove squad. There is no squad concept, make it global. Users don't need to be in a squad. There should be a global leaderboard."

## Clarifications

### Session 2026-11-11

- Q: Sign-in method? → A: Plain username + password (no email).
- Q: Who may sign up? → A: Nobody. There is no public sign-up; the operator creates accounts with an admin script.
- Q (plan): Accept the managed identity service's built-in progressive lockout instead of an exact "5 attempts → 15 minutes" rule? → A: Yes (confirmed by product owner). FR-008 and SC-005 amended (see research R2).
- Q: Squads / groups? → A: None. All users belong to one global community with one global leaderboard. Expected scale is about 3 people, likely permanently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First sign-in and profile setup (Priority: P1)

The operator creates an account with a username and a temporary password and passes them to the
friend privately. On first sign-in, the friend must choose their own password and complete a
short profile: display name, optional avatar, timezone (pre-filled from their device), and daily
calorie target. From then on they are part of the community and will appear on the global
leaderboard. There is no public sign-up.

**Why this priority**: Every other feature (logging, leaderboard, streaks, nudges) is tied to an
identified user with a known timezone.

**Independent Test**: The operator creates an account. The user signs in with the temporary
password, sets a new password and profile, signs out, signs back in with the new password, and
confirms the profile values are still there.

**Acceptance Scenarios**:

1. **Given** an account the operator has just created, **When** the user signs in with the temporary password, **Then** they must set a new password before doing anything else.
2. **Given** a user who has set their password, **When** profile setup opens, **Then** the timezone is pre-filled with their device's timezone and can be changed.
3. **Given** a user who hasn't finished profile setup, **When** they try to open any other screen, **Then** they are sent back to profile setup first.
4. **Given** a visitor, **When** they look for a way to create an account, **Then** none exists; the sign-in screen says accounts are created by invitation.
5. **Given** the operator, **When** they try to create an account with a username that is already taken (in any letter case), **Then** the script refuses with "Username is taken".

---

### User Story 2 - Sign in, stay signed in, sign out (Priority: P1)

A returning user signs in with their username and password and stays signed in on that device
until they sign out.

**Why this priority**: Users log activity every day, so signing in has to be quick and rare.

**Independent Test**: Sign in, close and reopen the browser, confirm the user is still signed in,
then sign out and confirm protected screens need signing in again.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they sign in with the correct username and password, **Then** they land on their home screen and stay signed in across browser restarts.
2. **Given** a registered user, **When** they enter a wrong password, **Then** they see "Incorrect username or password", which doesn't reveal whether the username exists.
3. **Given** 5 consecutive failed attempts for a username, **When** further attempts are made, **Then** they are refused for a growing period (up to about 15 minutes), even with the correct password, and the user sees "Too many attempts. Try again in a few minutes."
4. **Given** a signed-in user, **When** they sign out, **Then** that device's session ends and protected screens require signing in.
5. **Given** a signed-in user, **When** they change their password by entering the current one and a new one, **Then** the new password works from the next sign-in and the old one doesn't.

---

### User Story 3 - Edit profile (Priority: P2)

A user updates their display name, avatar, timezone, or daily calorie target at any time.

**Why this priority**: Targets and timezones change (travel, new goals), but this isn't needed
for first sign-in.

**Independent Test**: Change each field, reload, and confirm the new values appear everywhere the
profile is shown.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they change their name, avatar, timezone, or calorie target, **Then** the change is saved and shown everywhere their profile appears.
2. **Given** a user who removes their avatar, **When** their profile is displayed, **Then** their initials are shown instead.

---

### User Story 4 - See everyone in the community (Priority: P2)

A signed-in user opens a "People" screen listing every user with display name, avatar or initials,
and join date. This is the base list that the global leaderboard and nudges will use later.

**Why this priority**: It shows the community exists and that friends have joined. The leaderboard
feature builds on this list.

**Independent Test**: With three accounts, each user opens People and sees all three.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open People, **Then** they see every user who has completed profile setup, including themselves (marked "You").
2. **Given** a visitor who isn't signed in, **When** they try to open People or any profile, **Then** they are asked to sign in and no user information is shown.

---

### Edge Cases

- A device reports a timezone that isn't recognized: profile setup requires the user to pick a valid timezone from the list.
- Calorie target out of range (0, negative, or more than 10,000): rejected with a message giving the allowed range (500–10,000 kcal).
- A user forgets their password: there is no self-service reset (no email on file). The operator resets it to a temporary password (FR-004b), and the user must change it on next sign-in.
- A user is created but never finishes first sign-in or profile setup: they don't appear on People or (later) the leaderboard.
- A user changes their timezone: the change affects how future days are counted. Past days already recorded are not re-counted. (This matters to later streak features.)

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & sessions**

- **FR-001**: Users MUST sign in with a username and password. No email address is collected.
- **FR-002**: Usernames MUST be 3–20 characters (letters, digits, underscore), unique regardless of letter case, and cannot be changed after the account is created.
- **FR-003**: Passwords MUST be at least 8 characters. Passwords MUST never be stored or shown in readable form.
- **FR-004**: There MUST be no public sign-up. Accounts MUST be created only by the operator, using an admin tool, with a username and a temporary password.
- **FR-004a**: A user signing in with a temporary password MUST set a new password before using any other part of the app. The temporary password MUST stop working once replaced.
- **FR-004b**: The operator MUST be able to reset a user's password back to a temporary one, using the same admin tool.
- **FR-005**: The system MUST keep a user signed in across browser restarts until they sign out or their session expires after 30 days of inactivity.
- **FR-006**: Users MUST be able to sign out, which ends the session on that device.
- **FR-007**: Failed sign-ins MUST NOT reveal whether the username exists.
- **FR-008**: After 5 consecutive failed sign-in attempts for one username, further attempts MUST be refused for a period that grows with each additional failure, up to about 15 minutes, and resets after a successful sign-in or a quiet period.
- **FR-009**: Signed-in users MUST be able to change their password by entering their current one.

**Profile**

- **FR-010**: Each user MUST have a display name (1–40 characters), an optional avatar image, an IANA timezone, and a daily calorie target (whole number, 500–10,000 kcal).
- **FR-011**: Profile setup MUST be completed before a user can use any other part of the app.
- **FR-012**: The timezone MUST be pre-filled from the user's device and be editable from a list of valid IANA timezones.
- **FR-013**: Avatars MUST be optional, limited to common image formats up to 5 MB, and shown as initials when absent.
- **FR-014**: Users MUST be able to edit all profile fields except username at any time.

**Community visibility**

- **FR-015**: All users who have completed profile setup MUST belong to one global community. There are no groups, squads, or invites.
- **FR-016**: Any signed-in user MUST be able to see every community member's display name, avatar or initials, and join date.
- **FR-017**: No user information MUST be visible to visitors who aren't signed in.
- **FR-018**: A user's daily calorie target MUST be visible only to that user. Whether it appears on the leaderboard is decided in the leaderboard spec.

### Key Entities

- **User**: A person with an account, created by the operator. Has a unique username, a protected password, a must-change-password flag, a display name, optional avatar, IANA timezone, daily calorie target, profile-complete flag, and created date. Every user with a complete profile is a community member and a leaderboard participant.
- **Session**: A signed-in state on one device. Belongs to one user, has a last-active time, and ends on sign-out or after 30 days of inactivity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from first sign-in (temporary password) to a completed profile in under 2 minutes.
- **SC-001a**: The operator can create a new account in under 1 minute.
- **SC-002**: A returning user on a device they've used before reaches their home screen without entering credentials, as long as they haven't been inactive for 30 days.
- **SC-003**: Visitors who aren't signed in can see no user information; access checks pass in 100% of tested cases.
- **SC-004**: The People screen appears within 1 second for up to 100 users.
- **SC-005**: A password-guessing run is limited to 5 rapid attempts per username, after which attempts are increasingly delayed (up to about 15 minutes).

## Assumptions

- The product is a web app used on desktop and mobile browsers. Native apps are out of scope.
- Expected scale is about 3 users, likely permanently. Requirements favour simplicity over scale.
- There is a single global community and a single global leaderboard (defined in a later feature). Groups, squads, and invites are permanently out of scope. The PRD's "group streak" becomes a community-wide streak, to be defined in the streaks feature.
- The operator (the developer) has direct admin access and creates accounts, and resets forgotten passwords, with an admin script. Self-service sign-up and recovery are out of scope.
- Sessions also end at most one year after sign-in, regardless of activity (the identity provider's refresh-token lifetime).
- Avatars are shrunk to a 256×256 still image; animated GIFs become a single frame.
- Avatar moderation is out of scope.
- Account deletion and data export are deferred to a later privacy feature.
- Timezone affects day boundaries in later features (logging, streaks, nudges); this feature only captures and stores it.
