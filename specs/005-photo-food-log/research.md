# Research: Photo Food Log

**Plan**: [plan.md](plan.md)

## R1: A photo entry is a food entry with a status

**Decision**: Keep one item type. Add `source: "photo"` and a status `pending | ai | manual | edited`. Pending entries store `calories: 0`, `macros: null`; `buildFoodDay` skips them in every total and counts them in `ledger.pending`. After analysis the entry behaves like a typed one (free-form values, `servings: 1`, `rate` equals totals).
**Rationale**: Reuses meals, edit window, optimistic client, history and deletion with minimal change. Alternatives: a separate "photo log" item type (duplicates the day view, two sources for totals); storing pending in a separate list (needs a join and an index).

## R2: Status transitions and the user/agent race (FR-008, FR-012)

**Decision**: Transitions are `pending → ai` (agent), `pending → manual` (user fills values), `ai | manual → edited` (user corrects), and caption/meal edits keep the status. Every transition is one DynamoDB conditional update on `photoStatus` (`pending` for agent writes and manual fills; `ai`/`manual`/`edited` for corrections), so exactly one of two racing writers succeeds; the loser gets a clear 409/tool error and the web refreshes the day. The agent can never overwrite user values because it requires `pending`.
**Rationale**: Atomic, no locks or versions. Alternative: optimistic version counters (extra field, same outcome).

## R3: Photo storage in the existing private bucket

**Decision**: Key `food-photos/<sub>/<entryId>.<jpg|webp>` in the existing avatar bucket (private, SSL-only, encrypted). Each function gets S3 access only to the `food-photos/*` prefix it needs (read for views and MCP, read/write for add and delete). Views get a presigned GET URL valid 1 hour; agents receive the bytes through the MCP server, not a URL.
**Rationale**: No new bucket (constitution VII); prefix-scoped grants keep least privilege (IV). Alternative: a second bucket (more infra, nothing gained).

## R4: Upload path and limits

**Decision**: The browser draws the picked image on a canvas (long edge ≤ 1280 px) and exports JPEG, lowering quality until ≤ 1.5 MB, then submits it through a Server Action as base64 (same pattern as avatars). Next's Server Action body limit is raised to 3 MB (`serverActions.bodySizeLimit`). The API sniffs magic bytes (JPEG `FFD8FF`, WebP `RIFF…WEBP`), rejects others, and caps decoded size at 1.5 MB.
**Rationale**: Honors "browser never talks to AWS" (001 R3). Alternative: presigned direct-to-S3 upload (lighter on Lambda, but breaks that rule and needs CORS on the bucket). Client JPEG avoids the Safari WebP-encode gap.

## R5: MCP tools for the round trip

**Decision**: Three tools on the feature 004 server: `list_pending_food_photos` (pending photo entries in the editable window, newest first, `limit` default 20 max 50, `hasMore`), `get_food_photo` (`{date, entryId}` → MCP `image` content with base64 data and mime type, plus a text caption), `submit_food_estimate` (`{date, entryId, calories, protein, carbs, fat}`). `date` is part of the id because entry keys are `FOODLOG#<date>#<id>` (no extra index needed). Another member's id returns "not found".
**Rationale**: Vision-capable agents consume MCP images natively. Alternative: return a presigned URL (agents often cannot fetch arbitrary URLs and it leaks a bearer link).
**Verify at implementation**: the MCP SDK's image content shape for `registerTool` results, and that the 1.5 MB base64 response stays below Lambda's 6 MB limit.

## R6: Listing window and locked days

**Decision**: Pending entries older than the edit window are neither listed nor writable (FR-008, spec assumption), computed server-side from the member's timezone. History (`get_user_history`) includes photo entries with `status` and `caption`; pending ones show `calories: 0` and `pending: true`.
**Rationale**: Locked days never change silently (constitution V).

## R7: Deleting and orphans

**Decision**: Delete order is entry first, photo second (best effort, no PII logged). Upload order is photo first, entry second; if the entry write fails the photo is removed. A leftover object is never reachable (no entry points to it and the bucket is private).
**Rationale**: A dangling entry with a broken image would be worse than an unreferenced object.

## R8: Recent foods and history

**Decision**: Photo entries are excluded from "recent foods" (they have no reusable rate). `get_user_history` includes them as described in R6.

## R9: UI

**Decision**: "Add photo" sits beside the existing add panel; pending entries render as a card with thumbnail, caption, meal and a "Pending analysis" badge; the ledger shows "N meals pending analysis" and excludes them. Analysed entries show an "AI-estimated" / "edited" / "entered by you" label. Editing uses the existing inline editor, extended with caption for pending entries.
