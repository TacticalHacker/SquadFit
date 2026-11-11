# Research: AI Coach (Remote MCP)

**Plan**: [plan.md](plan.md)

## R1: Transport: stateless Streamable HTTP, JSON responses

**Decision**: One Lambda handles `POST /mcp`. Per request, build an `McpServer`, connect SDK's web-standard Streamable HTTP transport with `sessionIdGenerator: undefined` (stateless) and `enableJsonResponse: true`, convert the API Gateway v2 event to a Web `Request`, call `transport.handleRequest(request)` and map the `Response` back. `GET`/`DELETE` return 405 (no server-initiated stream), `OPTIONS` returns CORS headers.
**Rationale**: Lambda can't hold SSE streams; stateless JSON is the supported serverless shape. The pasted code faked a Node `res`, which breaks on headers, status codes and notifications (202).
**Alternatives**: Hand-written JSON-RPC (drift risk); Lambda response streaming (not needed, no server push).
**Verify at implementation**: the exact export names in `@modelcontextprotocol/sdk` 1.32 (`WebStandardStreamableHTTPServerTransport`); if absent, use the Node transport behind `node:http` mocks in tests only.

## R2: Identity: operator-issued bearer secret, not env-var tokens

**Decision**: `/mcp` is registered without the Cognito authorizer (AI clients have no Cognito session). The handler extracts `Authorization: Bearer sfk_...`, hashes it, loads `MCPTOKEN#<hash>` and acts as the stored `userId`. Tool arguments never carry a user id.
**Rationale**: The pasted map (`USER_1_TOKEN` env vars, `user_1` ids) cannot be revoked per user, ties members to deploys, and uses ids that don't exist (real ids are Cognito `sub`).
**Alternatives**: Cognito tokens (no way for Desktop/Cursor to refresh them); OAuth for MCP (the right answer for mobile, see R6, but heavy; deferred).

## R3: Secret format and storage

**Decision**: `sfk_` + 32 random bytes base64url (256 bits). Stored only as SHA-256 hex. Shown once by the CLI. One credential per member; issuing again rotates (old one stops working). Constant-time compare is unnecessary because lookup is by hash key.
**Rationale**: High-entropy random secrets don't need slow hashes; a DB leak gives hashes that can't be reversed. Constitution VI's slow-hash rule is about passwords.
**Alternatives**: Multiple keys per member (more admin surface, YAGNI); plaintext (rejected, FR-013).

## R4: Revocation and rate limiting

**Decision**: No caching of credential lookups. Revoke deletes both credential items transactionally. Rate limit: per-member fixed window of 1 minute, 60 requests, via an atomic `ADD` on `MCPRATE#<userId>#<epochMinute>` with a `ttl` (+120 s); over the limit returns HTTP 429 and a JSON-RPC error.
**Rationale**: Meets SC-007 trivially and FR-014 atomically (constitution V/VI). Cost is two extra DynamoDB calls per request, negligible at this scale.
**Alternatives**: API Gateway throttling (not per member); in-memory counter (per container, not atomic).

## R5: Item layout (replaces pasted layout)

**Decision**: Reuse the existing keys: profile `USER#<sub>`/`PROFILE`, food `FOODLOG#<date>#<id>`, workouts per feature 002. New: `COACH#<date>` under the user. See [data-model.md](data-model.md).
**Rationale**: The pasted `LOG#`, `calorieTarget`, `proteinTargetG`, `GROUP#squadfit` don't exist here; reading them would return nothing. History is read through the existing repos, so snapshots and units stay consistent with the web app.

## R6: Client support (honest limits)

**Decision**: Document three setups in quickstart: Cursor (`url` + `headers`), Claude Code (`claude mcp add --transport http ... --header`), Claude Desktop through the `mcp-remote` bridge with an `Authorization` header. Claude mobile and the Claude.ai custom-connector UI are expected to need OAuth rather than a static header, so mobile is **not** guaranteed by this feature.
**Rationale**: Static bearer headers are supported by Cursor and Claude Code; the hosted Claude apps' connector flow is OAuth-based. The pasted `claude_desktop_config.json` with `url` + `headers` is not a format Desktop is known to accept.
**Verify at implementation**: re-check current Claude Desktop/mobile docs; if static-header remote servers are now supported, update the quickstart. An OAuth follow-up would be a separate spec.

## R7: Dates and ranges

**Decision**: History `startDate`/`endDate` are `YYYY-MM-DD`, `start ≤ end ≤ today` (member's timezone, via `resolveReadDate`), span ≤ 31 days. Coach-note `date` must be within today and the 30 days before. Existing repos' `listEntriesInRange` serve the history.
**Rationale**: Reuses constitution V logic; bounds responses and writes.

## R8: Coach note content and rendering

**Decision**: `summaryMarkdown` 1-4,000 chars; `recommendations` 1-10 items of 1-280 chars (trimmed, empty rejected). Stored as plain text; the web renders with `react-markdown` (no `rehype-raw`, links `rel="noopener noreferrer nofollow"`, images disabled). Overwrites the same date; `generatedBy` is a fixed label "AI".
**Rationale**: Notes come from an external system; escaping by construction beats sanitising.

## R9: Protein target

**Decision**: Optional integer 10-500 g on the profile (`dailyProteinTarget`), editable in the profile form and by the assistant; `null` clears. The ledger reports `proteinTarget` and the Food screen shows protein against it when set.
**Rationale**: Spec FR-009. Optional so existing profiles stay valid.

## R10: Operator CLI

**Decision**: `pnpm admin ai-key issue|revoke|list <username>` resolves the username to the Cognito `sub` (`AdminGetUser`), and the table name from a new `TableName` output on the Data stack. `issue` prints the secret and a ready client snippet once.
**Rationale**: Mirrors existing `create-user`/`reset-password`; no new tooling.
