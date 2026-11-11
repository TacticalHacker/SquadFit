# Feature Specification: AI Coach (Remote MCP)

**Feature Branch**: `004-ai-coach-mcp`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "AI Coach loop via a remote MCP server. Remote AI clients (Claude Desktop, Claude mobile, Cursor) connect to SquadFit with a personal per-user credential and can: (read) fetch the user's workout and food history over a date window and view the group leaderboard (rankings, streaks, scores); (write) post a daily coach note (markdown summary + list of recommendations, one per day, labelled as AI-generated) and update the user's calorie and protein targets. The web app shows the day's coach note as a dedicated AI-badged card and uses the user's current targets for the progress thresholds. Provide a client config snippet for the team and curl examples for testing. Builds on 001-user-accounts, 002-workout-tracker, 003-nutrition-tracker."

## Clarifications

### Session 2026-11-11

- Q: Protein target? → A: Add an optional daily protein target to the profile, editable by member and assistant, shown against daily protein.
- Q: Leaderboard tool? → A: Defer; ship without it until scoring lands.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My AI assistant coaches me and I see it in the app (Priority: P1)

A user connects their AI assistant (Claude Desktop, Claude mobile or Cursor) to SquadFit using a personal credential. They ask it to review their week. The assistant reads their workout and food history, then posts a coach note for a day: a short markdown summary and a list of recommendations. When the user opens that day in the web app, they see the note in a card clearly labelled as AI-generated.

**Why this priority**: This is the whole loop (log → AI reads → AI writes → user sees it). Everything else supports it.

**Independent Test**: Log some food and a workout, connect an assistant with a valid credential, ask it to fetch history and post a note for today, then open the Food screen for today and confirm the AI-badged card shows the summary and recommendations.

**Acceptance Scenarios**:

1. **Given** a user with a valid personal credential, **When** their assistant requests history for a date window, **Then** it receives that user's workout and food entries for those days, with calories and macros.
2. **Given** the assistant posts a coach note for a date, **When** the user opens that day in the web app, **Then** a card with an "AI" badge shows the summary (formatted markdown) and the recommendations as a list.
3. **Given** a note already exists for that date, **When** the assistant posts another, **Then** the newer note replaces it (one note per user per day).
4. **Given** a day with no note, **When** the user opens it, **Then** no coach card is shown and the rest of the screen is unchanged.
5. **Given** a note for another user, **When** any user opens their own screen, **Then** they only ever see their own notes.
6. **Given** a note with an empty summary, no recommendations, or a date outside the allowed range, **When** the assistant posts it, **Then** it is rejected with a message saying what is allowed and nothing is saved.
7. **Given** note text containing markup or scripts, **When** it is shown in the app, **Then** it is displayed as inert text/formatting and never executed.

---

### User Story 2 - The assistant adjusts my targets (Priority: P2)

After reviewing progress, the assistant updates the user's daily calorie target and protein target. The web app immediately uses the new values for the day's progress thresholds.

**Why this priority**: Closes the loop by letting advice change the numbers the user is measured against, but the coach note alone already delivers value.

**Independent Test**: Via the assistant, set calorie target to 2,400; open the Food screen and confirm "remaining" is computed against 2,400.

**Acceptance Scenarios**:

1. **Given** a valid credential, **When** the assistant sets a calorie target within the allowed range, **Then** the profile target changes and the web app shows progress against it.
2. **Given** a value outside the allowed range or not a whole number, **When** the assistant submits it, **Then** it is rejected, nothing changes, and the reason is returned.
3. **Given** only one target is supplied, **When** the update is applied, **Then** only that target changes.
4. **Given** a changed target, **When** past days are viewed, **Then** they are measured against the current target, same as when the user edits it themselves.

---

### User Story 3 - Operator hands out and revokes access (Priority: P2)

The operator issues each member a personal credential, gives the team a ready-to-paste client configuration snippet and a set of test commands, and can revoke a credential without affecting others.

**Why this priority**: Accounts are operator-managed, so credentials must be too; without this nobody can connect.

**Independent Test**: Issue a credential for a member, paste the snippet into a client, list tools successfully; revoke it and confirm the same client is refused.

**Acceptance Scenarios**:

1. **Given** the operator tool, **When** they issue a credential for an existing member, **Then** the secret is shown once and can be placed in the client configuration snippet.
2. **Given** a missing, malformed, unknown or revoked credential, **When** any request is made, **Then** it is refused with an authentication error and no data is returned or changed.
3. **Given** the documentation, **When** a teammate follows the test commands, **Then** they can list the available tools and call one successfully.

---

### Edge Cases

- A credential only ever acts as its own user; the assistant cannot pass another user's identifier to read or write their data.
- History window with start after end, or longer than the maximum window (assumed 31 days): rejected with a clear message.
- Dates are interpreted in the user's own timezone; "today" is never computed in UTC. A note for a future date is rejected.
- Very long summaries or too many recommendations: rejected with the limits stated.
- A user who has not completed profile setup connects: refused with a message to finish setup in the app.
- Many rapid requests from one credential: rate limited with a clear message.
- Credential appears in logs, errors or the web app: must never happen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a remote AI client connect over the network using a personal credential tied to exactly one existing member, and act only as that member.
- **FR-002**: The system MUST refuse every request with a missing, invalid or revoked credential, and MUST NOT disclose whether a member exists.
- **FR-003**: The system MUST offer the assistant a way to discover the available tools and their inputs, and to call them.
- **FR-004**: A history tool MUST return the member's own workout and food entries (names, calories, macros, durations, servings, meal) for a requested date window of at most 31 days, using the same day boundaries as the web app.
- **FR-005**: *(Reserved: the leaderboard tool is out of scope for this feature; see Assumptions.)*
- **FR-006**: A coach-note tool MUST save one note per member per date, containing a markdown summary and a bounded list of recommendations, labelled as AI-generated, replacing any existing note for that date.
- **FR-007**: The web app MUST show the selected day's coach note in a dedicated card with an AI badge, rendering the summary as safe formatted text and recommendations as a list, and show nothing when no note exists.
- **FR-008**: A targets tool MUST let the assistant update the member's daily calorie target and/or protein target, applying the same validation range as the web profile, and the web app MUST use the current target for progress.
- **FR-009**: The profile MUST gain an optional daily protein target (whole grams, validated range), editable by the member in the profile screen and by the assistant, and shown against the day's protein total on the Food day screen. Members without one see no protein progress.
- **FR-010**: The assistant tool set MUST NOT include the leaderboard in this feature; it is added by the scoring/leaderboard feature, which MUST keep exposing only public fields.
- **FR-011**: All tool inputs MUST be validated, with clear human-readable errors, and invalid input MUST NOT change any data.
- **FR-012**: Write tools MUST only affect the calling member's own data, and edits made by the assistant MUST be distinguishable from user edits where shown (coach note badge).
- **FR-013**: The operator MUST be able to issue a credential for a member (secret shown once), list which members have one, and revoke it; credentials MUST be stored so that a data leak does not reveal them.
- **FR-014**: The system MUST rate limit requests per credential and MUST NOT write credentials or personal data to logs.
- **FR-015**: The project MUST provide a client configuration snippet for the team and copy-paste test commands for listing tools and calling a tool.

### Key Entities

- **Access credential**: A secret tied to one member that lets an AI client act as them; can be issued, listed (without the secret) and revoked.
- **Coach note**: One per member per date; markdown summary, list of recommendations, AI-generated label, created time.
- **Daily targets**: The member's calorie target (existing) and an optional protein target; owned by the member's profile.
- **History entry**: A workout or food entry from features 002/003, read-only through the assistant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A teammate can go from receiving their credential to a successful first assistant call in under 5 minutes using the provided snippet and instructions.
- **SC-002**: A coach note posted by the assistant is visible on the member's day screen within 5 seconds of the next page load or refresh.
- **SC-003**: 100% of requests without a valid credential are refused and return no member data.
- **SC-004**: In a test with two members, 0 requests can read or change the other member's entries, notes or targets.
- **SC-005**: A target change made by the assistant is reflected in the day's progress figures on the next view, with no manual refresh of anything else.
- **SC-006**: Invalid inputs (bad dates, out-of-range targets, oversized notes) are rejected 100% of the time without changing stored data.
- **SC-007**: A revoked credential stops working within 1 minute.

## Assumptions

- The pasted plan's choices (AWS Amplify, a hardcoded token-to-user map in environment variables, a `GROUP#squadfit` leaderboard index, a custom item layout) do not match this project. This spec is behaviour only; the plan will reconcile them with the existing Next.js/Vercel, Cognito and single-table design (hardcoded tokens in env vars are not acceptable because they cannot be revoked or hashed, see FR-013).
- Members and their profiles come from feature 001; the operator, not the member, issues AI credentials (consistent with no self sign-up).
- The coach note appears on the Food day screen for the selected date (the existing day view with date navigation); also showing it on the Workouts screen is out of scope.
- Coach notes are read-only for the member in the app; members cannot edit or delete them in this feature.
- History includes only data that features 002 and 003 already store; the assistant cannot create, edit or delete food or workout entries.
- Maximum limits (assumed): history window 31 days, summary 4,000 characters, 10 recommendations of 280 characters each.
- Coach notes can be written for today and up to 30 days back, never the future.
- Claude mobile and the Claude.ai connector UI are not targeted: they are expected to need OAuth rather than a static key (plan research R6). Cursor, Claude Code and Claude Desktop (via a bridge) are.
- Leaderboard access for the assistant is deferred until scoring exists (PRD §3.3).
- Out of scope: the leaderboard tool, the assistant generating notes itself (the user's own AI client does the reasoning), push notifications, cross-member coaching, editing groups, billing.
