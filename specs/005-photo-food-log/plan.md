# Implementation Plan: Photo Food Log

**Branch**: `005-photo-food-log` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-photo-food-log/spec.md`

## Summary

A member adds a food entry from one photo and an optional caption. It is saved as a **pending** entry (no calories, excluded from totals, marked "Pending analysis"). The member's own AI agent, connected through the feature 004 MCP server, lists pending entries, fetches each photo, and writes calories and macros back; the entry becomes a normal, AI-estimated entry that counts in the ledger. The member can also edit, fill in by hand, correct or delete.

Approach:
- **Domain first** (test-first, `packages/shared`): a photo entry is a `FoodEntry` with `source: "photo"` and a status (`pending` → `ai` | `manual` → `edited`). `buildFoodDay` / `applyFoodChange` exclude pending entries from totals and report a `pending` count; photo entries edit free-form like typed ones; recent foods ignore photo entries.
- **Storage**: reuse the existing food entry item (`FOODLOG#<date>#<id>`) with three extra attributes (`photoKey`, `caption`, `photoStatus`); photos go in the existing **private** bucket under `food-photos/<sub>/…` (no new bucket). Status changes use conditional writes so the user and the agent can never both win (FR-012).
- **API**: one new web route (`POST /food/photos/{date}`); existing entry PUT/DELETE gain photo behaviour; every food view carries short-lived photo URLs.
- **MCP**: three new tools on the feature 004 server: `list_pending_food_photos`, `get_food_photo` (returns an MCP image), `submit_food_estimate`.
- **Web**: "Add photo" panel (browser reduces the image to JPEG ≤ 1.5 MB before upload through a Server Action), pending badge/count in the ledger, entry editing for photo entries.
- **No new dependencies.**

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing only (Next.js 16, zod 4, AWS SDK v3 incl. S3 + presigner, MCP SDK from 004, CDK). Browser image reduction uses the Canvas API (as avatars do).

**Storage**: DynamoDB single table (extra attributes on food entries); private S3 bucket (existing) with a `food-photos/` prefix.

**Testing**: Vitest (shared domain, API handlers and MCP tools with in-memory fakes, web helpers), `aws-cdk-lib/assertions`, manual [quickstart.md](quickstart.md) against `dev`.

**Target Platform**: Web (mobile first) → Next server → HTTP API → Lambda arm64 (`ap-south-1`).

**Project Type**: Web application (extends the monorepo).

**Performance Goals**: Add photo → entry visible < 3 s on mobile data (SC-001 allows 15 s end to end); MCP photo fetch < 2 s.

**Constraints**: Photo ≤ 1.5 MB after reduction, JPEG or WebP only (magic-byte check, not the client's word); Server Action body limit raised to 3 MB; MCP response ≤ ~2 MB (inside Lambda's 6 MB); no photo or caption in logs; access URLs expire in 1 hour; entry ownership enforced by key (`USER#<sub>`).

**Scale/Scope**: ~10 members, a few photos a day each.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Spec-driven | Pass | No open markers; analyze before implement. |
| II Type safety | Pass | New request/response shapes are zod schemas in `packages/shared`; tool inputs likewise. |
| III Test-first | Pass | Status transitions, totals exclusion, validation and ownership tested first; CDK assertions for new route and least-privilege S3 access. |
| IV IaC / serverless | Pass | One new Lambda, existing table and bucket; IAM scoped to the `food-photos/*` prefix per function. |
| V Server-authoritative | Pass | "Today", the edit window and status transitions are decided on the server; the agent cannot touch locked days. |
| VI Members-only visibility | Pass | Photos private, short-lived URLs, agent limited to its key owner's entries, nothing personal logged. |
| VII Simplicity | Pass | No new bucket, table, index or dependency; photo entries reuse the food entry. |

Re-check after design: still pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-photo-food-log/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md          # web routes and changed responses
│   └── mcp-tools.md    # new MCP tools
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/photo-entry.ts         # statuses, limits, transitions, image sniffing
├── domain/food-day.ts            # pending excluded; photo free-form edit; ledger.pending
├── domain/recent-foods.ts        # ignore photo entries
├── contracts/food.ts             # photo fields, PhotoEntryCreate/Patch, ledger.pending
└── contracts/coach.ts            # MCP tool inputs (list/get/submit)
services/api/src/
├── handlers/food-photo-post.ts   # POST /food/photos/{date}
├── handlers/food-entry-put.ts    # + caption, photo status rules (changed)
├── handlers/food-entry-delete.ts # + delete photo (changed)
├── lib/photo-store.ts            # private bucket put/get/delete/urlFor
├── lib/food-repo.ts              # photo attrs, conditional update (changed)
├── lib/food-day-loader.ts        # attach signed URLs (changed)
└── lib/mcp/{tools,photos}.ts     # three new tools
infra/lib/api-stack.ts            # route, S3 prefix grants
apps/web/src/
├── components/photo-add-panel.tsx, photo-entry.tsx   # add + display
├── lib/photo-reduce.ts (+ test)  # canvas → JPEG ≤ 1.5 MB
├── server/actions/food.ts        # addPhotoEntry (changed)
└── components/{food-screen,food-ledger}.tsx          # pending UI (changed)
next.config.ts                    # serverActions.bodySizeLimit
```

**Structure Decision**: extend the existing monorepo; one new Lambda, new MCP tools in the existing server.

## Complexity Tracking

No violations. Deliberately not added: a second bucket, a GSI for "pending by user", upload through presigned browser URLs (breaks the "browser never calls AWS" rule from 001 R3), automatic server-side analysis.
