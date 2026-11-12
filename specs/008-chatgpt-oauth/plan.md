# Implementation Plan: ChatGPT Connector (key in URL)

**Branch**: `008-chatgpt-oauth` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

ChatGPT custom connectors support only OAuth or no authentication, so they can't send our `Authorization: Bearer sfk_…` header. Add a second route `ANY /mcp/{key}` on the existing MCP Lambda. The handler takes the key from the header or, failing that, from the path (`parsePathKey`, same format check as `parseBearer`). Everything after authentication is unchanged.

## Technical Context

TypeScript 6 / Node 24; no new dependencies, storage or functions. One extra API Gateway route on the existing `mcp` function (no Cognito authorizer, like `/mcp`). The API has no access logs, so the path is not recorded.

## Constitution Check

| Principle | Status |
|---|---|
| I. Spec-Driven | ✅ |
| II. Types | ✅ no new payloads |
| III. Lean tests | ✅ one handler test (path key accepted / bad key refused) + route assertion |
| IV. IaC | ✅ route in `api-stack.ts` |
| V. Server-Authoritative | ✅ unchanged |
| VI. Visibility | ✅ the key acts only as its member; never logged |
| VII. Simplicity | ✅ OAuth server rejected as overkill for three members |

## Files

- `packages/shared/src/domain/ai-credential.ts`: `parsePathKey`
- `services/api/src/handlers/mcp.ts`: header, then path key
- `infra/lib/api-stack.ts`: `ANY /mcp/{key}` on the same function; `infra/test/stacks.test.ts`
- `services/api/test/mcp-auth.test.ts`: one test
- `CLAUDE.md`: note

## Complexity Tracking

None.
