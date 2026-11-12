# Feature Specification: Public Landing Page

**Feature Branch**: `009-public-landing-page`

**Created**: 2026-11-12

**Status**: Implemented

**Input**: User description: "Public landing page at `/` for signed-out visitors: a polished product showcase instead of a hard sign-in wall, while the app stays invite-only. Sticky navbar, hero, a phone-framed product preview, a 'Bring your own AI (MCP)' feature grid, a coarse public squad pulse strip, and a 'Request Squad Invite' waitlist."

## Clarifications

### Session 2026-11-12 (with the owner, before specify)

- Q: Where do signed-in members go, and is there a `/dashboard`? → A: No `/dashboard`. Signed-in visitors to `/` are sent to the Gym logger (`/workouts/gym`) as today. Protected pages keep sending signed-out visitors to the sign-in page with a "return to" link. "Member Sign In" goes to the existing sign-in page.
- Q: Public squad pulse? → A: Coarse counts only: number of lifters and number of workouts logged in the last 7 days. No weights, streaks, names or food data. This needs a MINOR constitution amendment to principle VI that names exactly these two figures.
- Q: Squad tab of the preview (streaks, leaderboard, nudge are not built)? → A: Show it as a static mockup clearly tagged "Coming soon".
- Q: Waitlist abuse protection? → A: Hidden honeypot field, per-network-address rate limit, one row per email, and an operator command to list entries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Signed-out visitor sees the product, not a wall (Priority: P1)

A friend opens the SquadFit link on their phone. Instead of a sign-in form they see a dark, high-contrast page: a sticky top bar (SquadFit logo, "PRIVATE BETA" pill, "Member Sign In"), a hero with the headline "10-second gym & macro logging, coached by your own AI.", a phone-framed preview they can switch between three tabs (Gym logger, AI Pulse, Squad), and three cards explaining "Bring your own AI (MCP)".

**Why this priority**: It is the whole point of the feature: the root URL becomes a product page. Every other story hangs off it.

**Independent Test**: Signed out, open `/` at a 375 px wide viewport: every section renders, the preview tabs switch, nothing scrolls sideways, and "Member Sign In" opens the sign-in page.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open `/`, **Then** they see the landing page, not a redirect to sign-in.
2. **Given** the landing page, **When** the visitor taps the "Gym", "AI Pulse" or "Squad" preview tab, **Then** the phone frame shows that preview: the Bench Press drawer (3 sets · 80 kg × 8 · 1,940 kg volume), the AI Coach pulse ("4,200 kg lifted · Protein on track 155 g / 160 g"), or a mini leaderboard with streaks (🔥 12d) and a Nudge button.
3. **Given** the Squad preview tab, **Then** it carries a visible "Coming soon" tag and its Nudge button does nothing.
4. **Given** the landing page, **When** the visitor taps "Member Sign In" (navbar or hero), **Then** they reach the existing sign-in page.
5. **Given** a 375 px wide viewport, **Then** the page has no horizontal scrolling and all text stays readable.

---

### User Story 2 - Members keep landing in the app (Priority: P1)

A signed-in member opens the root URL from a bookmark and lands on the Gym logger as before. A signed-out visitor following a deep link to a members-only page is still sent to sign in and comes back to that page afterwards.

**Why this priority**: The landing page must not slow down or break the daily flow of the three members.

**Independent Test**: Signed in, open `/` → Gym logger. Signed out, open `/food` → sign-in page; after signing in → `/food`.

**Acceptance Scenarios**:

1. **Given** a signed-in member with a completed profile, **When** they open `/`, **Then** they are taken to the Gym logger.
2. **Given** a signed-in member without a completed profile, **When** they open `/`, **Then** they are taken to profile setup as today.
3. **Given** a signed-out visitor, **When** they open any members-only page (Workouts, Food, People, Settings, Setup), **Then** they are sent to sign in and, after signing in, returned to the page they asked for.
4. **Given** the app's own "SquadFit" logo link inside the app, **When** a member taps it, **Then** they land on the Gym logger, not the landing page.

---

### User Story 3 - Visitor requests an invite (Priority: P2)

A visitor taps "Request Squad Invite", enters their name, email and primary goal, submits, and immediately sees a confirmation in place of the form. The operator later lists requests from the command line.

**Why this priority**: It turns interest into something the operator can act on; the page is still useful without it.

**Independent Test**: Submit the form with valid values → confirmation shown; run the operator list command → the entry is there, once.

**Acceptance Scenarios**:

1. **Given** the invite form, **When** the visitor submits a name, a valid email and a goal, **Then** they see "You're on the list" and the request is stored.
2. **Given** an email already on the list, **When** it is submitted again, **Then** the visitor sees the same confirmation, no second entry is created, and nothing reveals the email was already there.
3. **Given** an invalid email or an empty name, **When** the visitor submits, **Then** the form shows a field error and nothing is stored.
4. **Given** a bot fills the hidden honeypot field, **When** it submits, **Then** it sees the normal confirmation but nothing is stored.
5. **Given** one network address has submitted 5 times within an hour, **When** it submits again, **Then** it is told to try again later and nothing is stored.
6. **Given** stored requests, **When** the operator runs the waitlist list command, **Then** they see name, email, goal and request time for each, newest first.

---

### User Story 4 - Visitor sees the squad is alive (Priority: P3)

Below the preview, a strip shows "Active squad: 3 lifters · 27 workouts logged this week". It shows only those two counts.

**Why this priority**: Social proof is nice to have; nothing depends on it.

**Independent Test**: With known data, open `/` signed out → the two numbers match the members with a completed profile and the workout entries of the last 7 days.

**Acceptance Scenarios**:

1. **Given** members with completed profiles and logged workouts, **When** a visitor opens `/`, **Then** the strip shows the lifter count and the count of workouts logged in the last 7 days.
2. **Given** the counts cannot be loaded, **When** a visitor opens `/`, **Then** the strip is hidden and the rest of the page is unaffected.
3. **Given** the pulse response, **Then** it contains only the two counts and the time they were computed: no names, weights, streaks, food data or per-member figures.

### Edge Cases

- A member whose session expired opens `/`: they see the landing page (they are signed out) and can sign in from the navbar.
- Zero workouts this week: the strip shows "0 workouts logged this week"; zero lifters hides the strip.
- A visitor double-taps submit: one request is stored and one confirmation shown.
- Very long name or goal: rejected over the limits (name ≤ 60, goal one of a fixed list).
- Email case and surrounding spaces: `Alex@Example.com ` and `alex@example.com` are the same email.
- JavaScript disabled: the landing page still renders (preview shows its first tab); the invite form may need scripting.
- A screen reader user: the preview tabs are real tabs (keyboard and announced), decorative glows are hidden from assistive tech.

## Requirements *(mandatory)*

### Functional Requirements

**Routing**

- **FR-001**: `/` MUST be reachable without signing in and show the landing page to signed-out visitors.
- **FR-002**: A signed-in visitor to `/` MUST be sent to the Gym logger (or to profile setup if their profile is incomplete), as today.
- **FR-003**: All members-only pages MUST keep requiring sign-in and keep the "return to the requested page after sign-in" behavior.
- **FR-004**: There MUST be no self sign-up; "Member Sign In" leads to the existing sign-in page, and the only way in for new people is the invite request.

**Landing page**

- **FR-005**: The page MUST have a sticky navbar with the SquadFit logo, a "PRIVATE BETA" pill and a "Member Sign In" button.
- **FR-006**: The hero MUST show the eyebrow "✨ Powered by Model Context Protocol (MCP)", the headline "10-second gym & macro logging, coached by your own AI.", the subheadline from the brief, a primary "Request Squad Invite" action and a secondary "Member Sign In" action.
- **FR-007**: The product preview MUST be a phone-framed, tabbed, static mockup with the three tabs and figures listed in User Story 1; it MUST NOT load any real member data.
- **FR-008**: The Squad tab MUST be visibly tagged "Coming soon" while scoring, streaks and nudges are not built.
- **FR-009**: The "Bring your own AI (MCP)" section MUST show three cards: Claude & ChatGPT sync; realistic lifting calorie math; private & isolated per-member keys. Claims MUST match what the product does today (the AI adjusts burn on member logs; each member has their own key).
- **FR-010**: The page MUST use the dark high-contrast look (near-black background, slate cards, subtle translucent borders, emerald and purple accents) and MUST NOT scroll horizontally at 375 px width.
- **FR-011**: The preview tabs MUST be keyboard operable and announced as tabs; text contrast MUST meet WCAG AA.

**Squad pulse**

- **FR-012**: The system MUST offer a public, anonymous read of exactly two figures: the number of members with a completed profile, and the number of workout entries dated in the last 7 days (today and the 6 days before, by each entry's own date).
- **FR-013**: The pulse MUST NOT expose names, usernames, avatars, weights, streaks, food data, timezones or any per-member figure.
- **FR-014**: The pulse MAY be up to 10 minutes stale; failure to load it MUST NOT break the page.
- **FR-015**: The constitution (principle VI) MUST be amended (MINOR) to allow exactly these two anonymous aggregate counts, before this feature merges.

**Waitlist**

- **FR-016**: Visitors MUST be able to submit name (1–60 chars), email (valid, ≤ 254 chars, normalized to lowercase and trimmed) and primary goal (one of: Build muscle, Lose fat, Get stronger, Stay consistent).
- **FR-017**: The system MUST store at most one request per normalized email; a resubmission MUST return the same success response as a first submission.
- **FR-018**: A submission with the hidden honeypot field filled MUST get the success response and MUST NOT be stored.
- **FR-019**: The system MUST limit submissions to 5 per network address per hour and 30 per hour overall (a backstop, since the address is reported by the web server); over the limit it MUST refuse with a "try again later" message and store nothing.
- **FR-020**: The operator MUST be able to list waitlist requests (name, email, goal, time), newest first, from the operator command line.
- **FR-021**: Names, emails, goals and network addresses MUST NOT be written to logs.

### Key Entities

- **Waitlist request**: one per normalized email. Name, email, primary goal, time requested. Visible only to the operator.
- **Submission counter**: per network address per hour, plus one overall hourly counter; expires on its own; holds no personal data beyond a one-way fingerprint of the address.
- **Squad pulse**: lifter count, workouts in the last 7 days, time computed. Derived, not stored per member.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-out visitor on a phone sees the hero headline and both calls to action without scrolling, within 2 seconds on a typical 4G connection.
- **SC-002**: At 375 px width every section renders with zero horizontal scroll.
- **SC-003**: Signed-in members reach the Gym logger from `/` in one step, with no landing page flash.
- **SC-004**: A visitor can request an invite in under 30 seconds and sees confirmation instantly after submitting.
- **SC-005**: Repeated submissions of the same email produce exactly one stored request.
- **SC-006**: No anonymous response contains any name, username, weight, streak or food figure (checked by inspecting the pulse and waitlist responses).

## Assumptions

- Preview figures are illustrative copy, not live data.
- The landing page is static apart from the pulse strip and the invite form; it can be cached and served fast.
- The goal list is fixed in this feature; changing it later is a copy change.
- The operator follows up with invite requesters by hand (no automatic email); creating accounts stays `pnpm admin create-user`.
- "Network address" is the client address the API sees; it is stored only as a one-way fingerprint inside an expiring counter.
- No analytics or tracking scripts are added.
