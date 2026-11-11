# Feature Specification: Photo Food Log

**Feature Branch**: `005-photo-food-log`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Photo food log with AI-filled macros. A signed-in user can log what they ate by uploading a photo of the food plus an optional caption (instead of picking or typing a food from a list), choosing the meal. The entry is saved immediately as 'pending analysis' with no calories or macros, clearly marked pending and not counted in the day totals. Later the user runs their own AI agent (connected through the MCP server from feature 004), which lists the user's pending photo entries, views each photo and caption, analyses the image, and writes estimated calories and macros back through the MCP server. Once written, the entry becomes a normal food entry counted in the ledger and labelled AI-estimated; the user can still correct it. The user can edit the caption/meal of or delete a pending entry, or fill in values manually. Photos are private to the owner and their own AI key. Builds on 003-nutrition-tracker and 004-ai-coach-mcp; supersedes 003's 'photo logging out of scope'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a meal with a photo (Priority: P1)

A signed-in user opens the Food screen, chooses "Add photo", takes or picks a picture of their meal, optionally types a caption (for example "dal, 2 rotis and a bowl of curd"), picks the meal and saves. The entry appears at once under that meal showing the photo, the caption and a clear "Pending analysis" label, with no calories.

**Why this priority**: Capturing the meal in seconds, without searching or typing numbers, is the whole point; analysis can happen later.

**Independent Test**: Add a photo with a caption to Lunch, reload, and confirm it is listed under Lunch as pending with the same photo and caption, and that eaten calories and macros did not change.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a completed profile on an editable day, **When** they choose "Add photo", select a picture, optionally add a caption and a meal, and save, **Then** a pending photo entry appears under that meal immediately.
2. **Given** a pending entry, **When** the user looks at the day, **Then** the entry shows the photo, caption and meal with a "Pending analysis" label, and the ledger's eaten, net, remaining and macro totals exclude it, with a visible count such as "2 meals pending analysis".
3. **Given** a photo that is not an accepted picture type or is too large even after resizing, **When** the user tries to save it, **Then** nothing is saved and a message states what is allowed.
4. **Given** no caption, **When** the user saves, **Then** the entry is saved; the caption is optional (maximum length applies when present).
5. **Given** a failed upload (offline or error), **When** saving, **Then** the entry is not shown as saved and a short message lets the user retry.
6. **Given** a read-only day (older than the edit window) or a future date, **When** the user tries to add a photo entry, **Then** it is refused, as for other food entries.
7. **Given** the user has not completed profile setup, **When** they open Food, **Then** they are sent to setup first.

---

### User Story 2 - My AI agent fills in the macros (Priority: P1)

The user asks their AI agent (connected to SquadFit through the MCP server from feature 004) to analyse their pending meals. The agent lists the user's pending photo entries, looks at each photo and caption, estimates calories, protein, carbs and fat, and writes the estimate back. The entry then becomes a normal entry: its calories and macros count in the day ledger and it is labelled "AI-estimated".

**Why this priority**: This is what turns a photo into usable numbers, and it is the reason photos are stored.

**Independent Test**: With a pending entry and a valid AI key, call the list and view tools, write an estimate, then open the Food screen and confirm the entry shows the numbers with an "AI-estimated" label and the ledger totals include them.

**Acceptance Scenarios**:

1. **Given** the user has pending photo entries, **When** their agent asks for them, **Then** it receives each pending entry's id, date, meal and caption, newest first, and only the key owner's entries.
2. **Given** a pending entry, **When** the agent requests its photo, **Then** it receives the image so it can analyse it, and nobody but the owner's key can.
3. **Given** a pending entry, **When** the agent writes calories (whole number in the allowed range) and protein, carbs and fat (all three together, in the allowed range, one decimal), **Then** the entry stops being pending, is labelled "AI-estimated", and its values count in that day's calories, eaten, net, remaining and macro totals.
4. **Given** invalid values (out of range, missing macros, negative), **When** the agent writes them, **Then** the write is refused with a clear message and the entry stays pending.
5. **Given** an entry that is no longer pending (already analysed, edited by the user, or deleted), **When** the agent tries to write an estimate, **Then** it is refused and nothing changes; the agent cannot overwrite values.
6. **Given** a pending entry on a day that is now locked (older than the edit window), **When** the agent lists pending entries or tries to write to it, **Then** the entry is not offered and a write is refused, so locked days never change silently.
7. **Given** another member's entry id, **When** the agent tries to view or write it, **Then** it is refused as not found.
8. **Given** the agent has written an estimate, **When** the user reopens the day, **Then** they see the new values without any manual step.

---

### User Story 3 - Manage a pending or AI-estimated entry (Priority: P2)

The user can change a pending entry's caption or meal, delete it, or fill in the values themselves if they do not want to wait for the AI. They can also correct an AI-estimated entry's values.

**Why this priority**: People make mistakes, change their mind, or have no AI agent at hand; the log must stay in their control.

**Independent Test**: Add a photo entry, edit its caption and meal, then fill in calories and macros by hand and confirm the entry counts in the totals and is no longer pending; delete another pending entry and confirm its photo is gone.

**Acceptance Scenarios**:

1. **Given** a pending entry on an editable day, **When** the user edits the caption or meal, **Then** the change is saved and still pending.
2. **Given** a pending entry, **When** the user fills in calories (and optionally macros) by hand, **Then** it becomes a normal entry counted in the totals, keeps its photo, and is labelled as entered by the user rather than AI-estimated.
3. **Given** an AI-estimated entry, **When** the user corrects calories or macros, **Then** the values update, the totals follow, and the "AI-estimated" label is replaced by "edited".
4. **Given** a pending or analysed photo entry, **When** the user deletes it, **Then** the entry and its photo are removed and can no longer be fetched by anyone.
5. **Given** a read-only day, **When** the user opens a photo entry, **Then** it can be viewed but not changed or deleted.
6. **Given** an entry being edited by the user at the same moment the agent writes an estimate, **When** both save, **Then** exactly one wins, deterministically (see FR-012), and the user sees the true state with a short notice.

---

### User Story 4 - Photos stay private (Priority: P1)

Only the owner, and the owner's own AI key, can ever see a food photo or caption.

**Why this priority**: Food photos are personal; leaking them would break the members-only promise.

**Independent Test**: With two members, confirm member B can never view, list or write member A's photo entries by any route, and that an unauthenticated request gets nothing.

**Acceptance Scenarios**:

1. **Given** a photo, **When** a signed-out visitor or another member requests it, **Then** it is refused and no image data is returned.
2. **Given** the owner viewing their screen, **When** a photo is shown, **Then** access to it expires shortly and cannot be shared as a permanent link.
3. **Given** server logs and error output, **When** photos are uploaded or analysed, **Then** neither photo contents nor captions appear in them.

---

### Edge Cases

- Entry added at 23:59 local time and analysed after midnight: it stays on its original date.
- Agent estimate arrives for an entry whose day has since locked: see Assumptions.
- User deletes a pending entry while the agent is analysing it: the agent's write fails with "not found"; nothing is created.
- Many pending entries: the agent receives at most the 20 most recent per request and can ask for more.
- A caption with markup or very long text: stored as plain text within the limit and displayed as inert text.
- A rotated or revoked AI key mid-analysis: the next agent call is refused; pending entries remain pending.
- A day with only pending entries: ledger shows zero eaten and the pending count, not an alarming "remaining" jump.
- Photo upload interrupted: no half-saved entry or orphan photo remains visible to the user.
- The same photo uploaded twice: two separate entries, as with food typed twice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add a food entry from a single photo and an optional caption (maximum 200 characters), choosing a meal, on today and the two days before it (same window and server-decided "today" as other food entries).
- **FR-002**: The browser MUST reduce the photo before upload; the system MUST accept only JPEG or WebP pictures up to 1.5 MB after reduction and MUST reject anything else with a message stating the allowed type and size.
- **FR-003**: A new photo entry MUST be saved as "pending analysis" with no calories or macros, and MUST appear immediately under its meal.
- **FR-004**: Pending entries MUST be shown with their photo, caption and a clear "Pending analysis" label, MUST NOT contribute to eaten, net, remaining or macro totals, and the day MUST show how many entries are pending.
- **FR-005**: A tool exposed through the MCP server MUST let the key owner's AI agent list that member's pending photo entries (id, date, meal, caption), newest first, at most 20 per request with a way to request more.
- **FR-006**: A tool MUST let the agent retrieve the photo of one of that member's photo entries so it can be analysed; the same photo is never available to any other member or key.
- **FR-007**: A tool MUST let the agent write calories (whole number, same range as typed food entries) and protein, carbs and fat (all three required together, same ranges and one-decimal precision as feature 003) to a pending entry; a successful write makes the entry a normal entry labelled "AI-estimated" that counts in all day totals.
- **FR-008**: The write in FR-007 MUST be refused for entries that are not pending (already analysed, filled by the user, or deleted), for another member's entries, for invalid values, and for entries on days outside the edit window, leaving the entry unchanged.
- **FR-009**: Users MUST be able to edit the caption and meal of a pending entry, delete a pending or analysed photo entry (deleting also removes the photo), and fill in calories (and optionally macros) by hand to make it a normal entry.
- **FR-010**: Users MUST be able to correct the calories and macros of an AI-estimated entry; the label changes from "AI-estimated" to "edited".
- **FR-011**: The AI-estimated, entered-by-user and edited labels MUST be visible on the entry; entries keep their photo after analysis.
- **FR-012**: When the user and the agent change the same pending entry at the same time, exactly one change MUST be applied and the other MUST fail clearly; the agent never overwrites user-entered values.
- **FR-013**: Photos MUST be private: stored where only the system can read them, shown to the owner through short-lived access, and returned to an AI agent only for the key owner's own entries; unauthenticated and other-member requests MUST receive nothing.
- **FR-014**: Photos and captions MUST NOT be written to logs or error messages.
- **FR-015**: Existing per-key request limits and size limits from feature 004 MUST apply to the new tools, and a returned photo MUST stay within the size limit of FR-002.
- **FR-016**: Entries and photos MUST be isolated per member; one member's list, view or write by id MUST return "not found" for another member's entry.
- **FR-017**: The project MUST provide updated client instructions and curl-style examples for the new tools (list pending, get photo, write estimate).

### Key Entities

- **Photo food entry**: A food entry for one meal on one date with a photo, an optional caption, a status (pending, AI-estimated, entered by user, edited) and, once analysed, calories and macros. Belongs to one member.
- **Food photo**: One reduced picture attached to a photo food entry; private to the owner; removed with the entry.
- **Pending analysis list**: The member's photo entries still without values, as seen by their own AI agent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a photo meal (pick photo, optional caption, save) in under 15 seconds on a normal mobile connection.
- **SC-002**: A written AI estimate appears on the user's day screen on its next load, and the day totals include it with no other action.
- **SC-003**: 100% of attempts by another member, a signed-out visitor or another member's key to view, list or write a photo entry are refused without returning any photo or caption data.
- **SC-004**: Pending entries add 0 kcal and 0 g to any day total, in 100% of cases.
- **SC-005**: Invalid estimates (out-of-range, partial macros, not pending, locked day) are refused 100% of the time and leave the entry unchanged.
- **SC-006**: Deleting an entry makes its photo unreachable immediately for everyone, including the owner and their agent.
- **SC-007**: Setting up and running a first analysis through the agent takes under 10 minutes from the documentation.

## Assumptions

- Builds on 003 (food entries, meals, ledger, edit window) and 004 (MCP server, per-member keys, rate limits); the sign-in model is unchanged.
- One photo per entry; camera or gallery pick through the browser's normal file picker.
- Photos are kept as long as their entry exists and are deleted with it; no separate retention period.
- AI-estimated values count in totals immediately; there is no separate approval step before they count (the user can correct afterwards).
- Pending entries on days that have since locked (older than the edit window) can no longer be analysed by the agent or edited; they stay visible and uncounted. This keeps locked days from changing silently.
- The user's own agent does the image analysis; the system does no automatic analysis, and the agent is expected to be vision-capable.
- Re-analysing an already analysed entry (resetting it to pending) is out of scope; the user deletes and re-adds, or corrects by hand.
- Out of scope: server-side automatic analysis, barcode scanning, external food databases, multiple photos per entry, sharing photos with other members, photo editing or cropping beyond reduction.
