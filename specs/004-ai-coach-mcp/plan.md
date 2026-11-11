# Implementation Plan: AI Coach (Remote MCP)

**Branch**: `004-ai-coach-mcp` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-ai-coach-mcp/spec.md`

## Summary

A member's AI client (Claude Code, Cursor, Claude Desktop via a bridge) calls a remote MCP server hosted as one Lambda behind the existing HTTP API. A personal, operator-issued, revocable secret identifies the member. Three tools: `get_user_history` (read), `post_daily_coach_note` and `update_user_targets` (write). The web app shows the day's coach note as an AI-badged card on `/food` and gains an optional daily protein target that the assistant and the member can both set.

Approach:
- **Domain first** (test-first, `packages/shared`): coach-note limits/validation, protein target schema, history-window rules, credential token format and hashing helpers.
- **MCP Lambda** `services/api/src/handlers/mcp.ts` (`ANY /mcp`, no Cognito authorizer; bearer secret checked in the handler). Stateless Streamable HTTP with JSON responses, using the SDK's web-standard transport (a `Request`→`Response` adapter, not the pasted fake Node `res`). Tools are plain functions over the existing repos so they are tested with the in-memory fakes.
- **Credentials**: stored as SHA-256 hashes in the existing table; one per member; issued/rotated/revoked by `pnpm admin ai-key ...`. Looked up on every request (no cache) so revocation is immediate.
- **Web**: `GET /coach-note?date=` (JWT) for the card; profile gets `dailyProteinTarget`; ledger shows protein against it.
- **Replaces from the pasted plan**: hardcoded env-var token map, `SquadFitTable`/`LOG#`/`GROUP#squadfit`/`SCORE#` layout, `get_group_leaderboard` (deferred), CORS `*` on everything, fake `res` object. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing (Next.js 16, Tailwind 4, zod 4, AWS SDK v3, CDK). **New**: `@modelcontextprotocol/sdk@^1.32` in `services/api` (bundled into the Lambda), `react-markdown` in `apps/web` (safe markdown rendering, no raw HTML). Both justified in Complexity Tracking.

**Storage**: Existing DynamoDB single table. New item types: `COACH#<date>`, `MCPCRED` (per user), `MCPTOKEN#<hash>` (lookup), rate-limit counters (TTL). Table gains a `ttl` attribute for counters.

**Testing**: Vitest (shared domain; API handler and MCP tool tests with fakes and a fixed clock; web helper tests), `aws-cdk-lib/assertions` (route, IAM, TTL), manual [quickstart.md](quickstart.md) with curl and a real client.

**Target Platform**: Next server (web), API Gateway HTTP API + Lambda arm64 (`ap-south-1`).

**Project Type**: Web application (extends the monorepo).

**Performance Goals**: Tool call round trip < 1 s typical (1 auth Get + 1 rate-limit Update + 1-3 data calls); note visible on next page load (SC-002).

**Constraints**: Revocation effective on the next request (SC-007 asks ≤ 1 min); no secret, note text or entry data in logs; the caller identity comes only from the credential, never from tool arguments; "today" from the profile timezone.

**Scale/Scope**: ~10 members, a few hundred tool calls a day; history window ≤ 31 days.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Spec-driven | Pass | Markers resolved; plan, tasks, analyze before implement. |
| II Type safety | Pass | Tool inputs and the note API are zod schemas in `packages/shared`; the web validates the note response. |
| III Test-first | Pass | Domain (limits, token hashing, window math) and handlers tested first; CDK assertions for the new route, IAM and TTL. |
| IV IaC / serverless | Pass | One Lambda, existing table and API. TTL attribute added in CDK. No always-on service. |
| V Server-authoritative | Pass | Today, date ranges and note dates validated server-side in the member's timezone. |
| VI Members-only visibility | Pass | The credential maps to exactly one member; tools only touch that member's data; other members' data is not reachable (leaderboard deferred). Secrets stored hashed; nothing personal logged. Rate limit server-side and atomic. |
| VII Simplicity | Pass with notes | See Complexity Tracking. |

Re-check after design: still pass. The 256-bit random secret is hashed with SHA-256, not a slow hash: slow hashing protects low-entropy passwords, not random keys (research R3).

## Project Structure

### Documentation (this feature)

```text
specs/004-ai-coach-mcp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md          # web-facing routes + profile changes
│   └── mcp-tools.md    # MCP tool schemas, errors, transport
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── contracts/coach.ts            # CoachNote schemas; MCP tool input schemas
├── contracts/me.ts               # + dailyProteinTarget (optional)
├── domain/coach-note.ts          # limits, normalisation
├── domain/ai-credential.ts       # token format, hash, parse bearer
├── domain/profile.ts             # + ProteinTargetSchema
└── domain/food-day.ts            # ledger gains proteinTarget
services/api/src/
├── handlers/mcp.ts               # ANY /mcp
├── handlers/coach-note-get.ts    # GET /coach-note
├── lib/mcp/{server,tools,history}.ts
├── lib/coach-repo.ts             # notes
├── lib/credential-repo.ts        # credentials + rate counter
└── lib/profile-repo.ts           # + setTargets, protein attr
infra/lib/{api-stack,data-stack}.ts   # route, ttl, TableName output
infra/scripts/admin.ts            # ai-key issue|revoke|list
apps/web/src/
├── components/coach-card.tsx     # AI-badged note card
├── components/{profile-form,food-ledger}.tsx   # protein target
└── app/(app)/food/page.tsx       # fetch note
```

**Structure Decision**: extend the existing monorepo; one new Lambda for MCP and one for the note read, following the one-handler-per-file convention.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `@modelcontextprotocol/sdk` | Protocol framing, tool schema listing, JSON-RPC errors | Hand-rolling JSON-RPC and `tools/list` schemas duplicates the spec and drifts from clients. |
| `react-markdown` | Notes are markdown from an external system and must never execute HTML | A hand-written renderer is a security risk; `dangerouslySetInnerHTML` is unacceptable. |
| DynamoDB `ttl` attribute + counter items | Per-credential rate limit (spec FR-014) | API Gateway throttling is per route/API, not per member. |
