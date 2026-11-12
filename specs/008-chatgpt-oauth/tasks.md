# Tasks: ChatGPT Connector (key in URL)

**Tests**: Lean (constitution III): one handler test and one route assertion.

- [X] T001 [US1] Add `parsePathKey` to `packages/shared/src/domain/ai-credential.ts` (same `TOKEN_PATTERN` as `parseBearer`).
- [X] T002 [US1] In `services/api/src/handlers/mcp.ts` use the header key, else `parsePathKey(event.pathParameters?.key)`.
- [X] T003 [US1] Add `ANY /mcp/{key}` to the existing MCP function in `infra/lib/api-stack.ts` (no authorizer); assert it in `infra/test/stacks.test.ts`.
- [X] T004 [US1] Test in `services/api/test/mcp-auth.test.ts`: path key accepted, bad path key → 401.
- [X] T005 Update `CLAUDE.md` (feature 008 note) and run `pnpm check`, `pnpm synth`.
- [ ] T006 Deploy and connect ChatGPT per [quickstart.md](quickstart.md) (manual).
