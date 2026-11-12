# Feature Specification: ChatGPT Connector (key in URL)

**Feature Branch**: `008-chatgpt-oauth`

**Created**: 2026-11-12

**Status**: Implemented

**Input**: User description: "Let ChatGPT connect to the SquadFit MCP server. It's an app for three people: keep it simple."

## Clarifications

### Session 2026-11-12

- Q: OAuth sign-in or something simpler? → A: Simpler. The app has three members. ChatGPT's "No authentication" mode is used, with the member's existing AI key in the URL path. A full OAuth server (an earlier draft of this spec) is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect ChatGPT with my existing key (Priority: P1)

A member adds SquadFit in ChatGPT as a custom MCP server with "No authentication" and the URL `<api>/mcp/<their key>`. The tools then work in any ChatGPT chat or project, acting only as that member, exactly as Claude does with the same key in a header.

**Independent Test**: Add the connector with the key URL, ask ChatGPT to call `get_full_context`, and get that member's data.

**Acceptance Scenarios**:

1. **Given** a valid key in the URL path, **When** ChatGPT calls a tool, **Then** it works as that member with the same tools, edit window, rate limit (60/min, shared with header use) and privacy rules.
2. **Given** a wrong or old key in the path, **When** ChatGPT connects, **Then** it is refused as unauthorized.
3. **Given** Claude uses the same key in a header, **Then** both keep working side by side.
4. **Given** the operator rotates the key, **Then** both ChatGPT and Claude stop working until the new key is put in both.

### Edge Cases

- A header key and a path key are both present: the header key is used.
- Something that doesn't look like a key in the path: refused as unauthorized.

## Requirements *(mandatory)*

- **FR-001**: The AI connection MUST also accept the member's key as the last segment of its address, for clients that cannot send headers.
- **FR-002**: A key given this way MUST behave exactly like the same key sent as a header (same member, tools, limits).
- **FR-003**: The key MUST NOT be written to logs (the API keeps no access logs and the function never logs paths).

## Success Criteria *(mandatory)*

- **SC-001**: A member connects ChatGPT in under 2 minutes with only their key URL.
- **SC-002**: Header-key clients see no change.

## Assumptions

- Three trusted members. A key in a URL lives in ChatGPT's connector settings; treat that URL like a password. If it leaks, the operator rotates the key with `pnpm admin ai-key issue`.
- Each member's ChatGPT plan allows custom connectors.
