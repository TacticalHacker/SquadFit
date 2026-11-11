# Tasks: Photo Food Log

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included (constitution III: failing tests first for domain logic; CDK assertions for access-controlling resources).

**Format**: `- [ ] T### [P?] [US?] Description with file path`. `[P]` = different files, no dependency on unfinished tasks.

## Phase 1: Setup

- [X] T001 Raise the Server Action body limit to 3 MB in `apps/web/next.config.ts` (`experimental.serverActions.bodySizeLimit: "3mb"`; check the Next 16 docs in `apps/web/node_modules/next/dist/docs/` for the current key) and note the reason in a comment (photos up to 1.5 MB as base64).

## Phase 2: Foundational (blocks all stories)

**Shared domain, contracts, storage and repo support used by every story.**

- [X] T002 [P] Write failing tests `packages/shared/test/photo-entry.test.ts`: `sniffImage(bytes)` returns `"image/jpeg"` for `FFD8FF`, `"image/webp"` for `RIFF....WEBP`, `null` otherwise; `MAX_PHOTO_BYTES = 1.5 * 1024 * 1024`; caption schema trims, allows empty, rejects > 200 chars; `photoEntryName(caption)` returns the caption cut to 60 chars or `"Photo meal"`; `canTransition(from, to, actor)` encodes the machine in data-model.md (`pending→ai` agent only; `pending→manual` user; `ai|manual|edited→edited` user; nothing else).
- [X] T003 Implement `packages/shared/src/domain/photo-entry.ts` (`PHOTO_STATUSES`, `MAX_PHOTO_BYTES`, `CAPTION_MAX = 200`, `CaptionSchema`, `sniffImage`, `photoEntryName`, `canTransition`) and export from `packages/shared/src/index.ts`.
- [X] T004 [P] Write failing tests in `packages/shared/test/food-day.test.ts` and `packages/shared/test/recent-foods.test.ts`: pending photo entries (`source: "photo"`, `photo.status: "pending"`, calories 0, macros null) appear in their meal but add 0 to `subtotal`, eaten, net, remaining and macro totals and are not counted in `entriesWithoutMacros`; `ledger.pending` counts them; after `ai`/`manual`/`edited` they count normally; `applyFoodChange` edits photo entries free-form (calories/macros/meal) like typed ones and rejects `servings`; recent foods ignore every photo entry.
- [X] T005 Update `packages/shared/src/domain/food-day.ts` (`FoodEntry.source` gains `"photo"`; optional `photo?: { status; caption; url? }`; `FoodLedger.pending`; `assemble` skips pending; free-form branch covers `typed` and `photo`) and `packages/shared/src/domain/recent-foods.ts`; update `packages/shared/src/contracts/food.ts` (`FoodEntrySchema.photo`, `ledger.pending: z.number().default(0)`, `PhotoEntryCreateSchema` = `{ meal, caption?, contentType: "image/jpeg"|"image/webp", dataBase64 }`, `EntryPatchSchema.caption` optional 0-200).
- [X] T006 [P] Write failing tests `services/api/test/photo-store.test.ts` against the fake store contract: `put` returns key `food-photos/<sub>/<entryId>.jpg|webp`, `get(key)` returns bytes and content type, `delete` removes, `urlFor` returns a short-lived URL.
- [X] T007 Implement `services/api/src/lib/photo-store.ts` (`PhotoStore` interface; `S3PhotoStore` using the private bucket from `AVATAR_BUCKET` with `PutObject`/`GetObject`/`DeleteObject` and a 1-hour presigned GET); add `photos: PhotoStore` to `Deps` in `services/api/src/lib/deps.ts` and an in-memory fake in `services/api/test/fakes.ts`.
- [X] T008 Update `services/api/src/lib/food-repo.ts`: persist/read `photoKey`, `caption`, `photoStatus` in `toEntry`; add `updateEntryIf(userId, date, entryId, fields, nowIso, allowedStatuses)` (conditional on `photoStatus IN (...)`, returns false on condition failure); update the in-memory fake in `services/api/test/fakes.ts` with the same semantics. Cover with tests in `services/api/test/food-repo-photo.test.ts` (pending-only write succeeds once; second write fails).
- [X] T009 Update `services/api/src/lib/food-day-loader.ts` to attach `photo.url` (via `deps.photos.urlFor`) to photo entries and `ledger.pending`; make `food-get`, `food-entry-*` and `food-photo-*` handlers return it (they already call the loader). Test in `services/api/test/food-get.test.ts` (pending entry present, excluded from totals, `pending` count, URL present, other member's photo never present).
- [X] T010 [P] Write failing CDK assertions in `infra/test/stacks.test.ts`: route `POST /food/photos/{date}` exists with the JWT authorizer; food functions that return day views can read objects under `food-photos/*` only (no bucket-wide access beyond what avatars already have); the delete and photo-post functions can write and delete under that prefix; the MCP function can read but not write or delete photos.
- [X] T011 Update `infra/lib/api-stack.ts`: `route()` option `photos?: "read" | "readwrite"` granting S3 on `food-photos/*` only (`bucket.grantRead(fn, "food-photos/*")` / `grantReadWrite`); add `photos: "read"` to `food-get`, `food-entry-post`, `food-entry-put`; `photos: "readwrite"` to `food-entry-delete` and the new `route("food-photo-post", HttpMethod.POST, "/food/photos/{date}", { write: true, photos: "readwrite", memorySize: 512, timeoutSeconds: 15 })`; `photos: "read"` to `mcp`. Keep the existing `avatars` options unchanged.

**Checkpoint**: shared domain, storage and infra ready; pending entries are representable and excluded from totals.

## Phase 3: User Story 1: Log a meal with a photo (P1) 🎯 MVP

**Independent test**: add a photo with a caption to Lunch, reload, and see it pending with unchanged totals.

- [X] T012 [P] [US1] Write failing tests `services/api/test/food-photo-post.test.ts`: valid JPEG and WebP create a pending entry under the chosen meal with `calories: 0`, `macros: null`, `name` from caption or "Photo meal", `photoKey` set and the object stored; no caption allowed; caption > 200 chars, PNG bytes with a JPEG content type (magic bytes decide), > 1.5 MB, bad meal → 400/413 and nothing stored; locked or future date → 409 `DAY_LOCKED`/400; no profile → 409; if the entry write fails the stored photo is deleted; response is the day view with `ledger.pending: 1`; the body is never logged.
- [X] T013 [US1] Implement `services/api/src/handlers/food-photo-post.ts` (`handle(event, deps)`: `loadDayContext`, `resolveWriteDate`, `parseBody(PhotoEntryCreateSchema)`, size check, `sniffImage`, `photos.put`, `food.putEntry` with `source: "photo"`, `photoStatus: "pending"`, cleanup on failure, return `loadFoodDay`).
- [X] T014 [P] [US1] Write failing tests `apps/web/src/lib/photo-reduce.test.ts` for the pure helper `fitWithin(width, height, maxEdge)` (long edge 1280, keeps aspect, never upscales) and the quality-stepping rule `nextQuality(size, limit, quality)`.
- [X] T015 [US1] Implement `apps/web/src/lib/photo-reduce.ts`: `reducePhoto(file): Promise<{ contentType: "image/jpeg"; dataBase64: string }>` using canvas (long edge ≤ 1280, JPEG, quality 0.85 stepping down until ≤ 1.5 MB; throws a user-readable error if impossible), plus the pure helpers from T014.
- [X] T016 [US1] Add `addPhotoEntry(date, meal, caption, photo)` to `apps/web/src/server/actions/food.ts` (calls `POST /food/photos/{date}`, validates with `FoodDayViewSchema`, maps `ApiRequestError` to the existing action error state).
- [X] T017 [P] [US1] Build `apps/web/src/components/photo-add-panel.tsx` (file input with `accept="image/*"` and `capture` hint, preview, caption field with 200-char limit, meal select, Save/Retry, error messages for type/size/offline) and `apps/web/src/components/photo-entry.tsx` (thumbnail, caption, meal, status badge: "Pending analysis" / "AI-estimated" / "edited" / "entered by you"; broken-image fallback).
- [X] T018 [US1] Wire into `apps/web/src/components/food-screen.tsx` and `food-ledger.tsx`: "Add photo" action beside the add panel (editable days only), render photo entries with `photo-entry.tsx`, ledger line "N meal(s) pending analysis" when `ledger.pending > 0`, optimistic add of a pending card via `applyFoodChange` (replace with server view on success; remove and show a message on failure).

**Checkpoint**: US1 works in the browser end to end.

## Phase 4: User Story 2: My AI agent fills in the macros (P1)

**Independent test**: with a pending entry and a key, list → get photo → submit; the entry shows AI-estimated and counts in totals.

- [X] T019 [P] [US2] Add MCP input schemas to `packages/shared/src/contracts/coach.ts`: `ListPendingShape` (`limit` int 1-50 default 20), `GetPhotoShape`/`SubmitEstimateShape` (`date`, `entryId`, `calories` int 1-5000, `protein`/`carbs`/`fat` 0-500 one decimal, all required) with strict parse objects.
- [X] T020 [P] [US2] Write failing tests `services/api/test/mcp-photos.test.ts`: list returns only the key owner's pending photo entries in the editable window, newest first, respects `limit`, `hasMore`, excludes locked days and non-pending; `get_food_photo` returns an MCP `image` item (base64, correct mime) plus a text item with date/meal/caption, "not found" for other members' ids and non-photo entries; `submit_food_estimate` makes the entry `ai` and counts in the next `/food` ledger, rejects not-pending (already analysed, edited, manual), unknown/other-member ids, locked days, out-of-range or non-tenth-gram values, missing macros, and leaves the entry unchanged on every error; two concurrent submits → exactly one succeeds; a user manual fill racing a submit → exactly one wins; `get_user_history` shows `status`, `caption`, `pending: true` for pending entries and excludes them from totals; `tools/list` now lists six tools.
- [X] T021 [US2] Implement `services/api/src/lib/mcp/photos.ts` and register `list_pending_food_photos`, `get_food_photo`, `submit_food_estimate` in `services/api/src/lib/mcp/tools.ts` (use `deps.food` + `deps.photos`, `isEditableDay`, `updateEntryIf(... ["pending"])`; extend `ToolResult` to allow `image` content and update `server.ts` to return it); update `get_user_history` output for photo entries. Never include photo bytes or captions in errors or logs.
- [X] T022 [US2] Add privacy assertions to `services/api/test/mcp-privacy.test.ts`: member A's key cannot list, view or write member B's photo entries; errors never contain captions or key.

**Checkpoint**: the full photo → agent → numbers loop works against fakes.

## Phase 5: User Story 3: Manage a pending or AI-estimated entry (P2)

**Independent test**: edit caption/meal, fill by hand, correct an AI value, delete and confirm the photo is gone.

- [X] T023 [P] [US3] Write failing tests `services/api/test/food-entry-photo.test.ts`: pending → caption/meal edits keep `pending`; pending + calories (+ optional macros) → `manual` and counted; `ai` + calories/macros → `edited`; `servings` rejected for photo entries; caption ignored once analysed; editing a pending entry that the agent already analysed → 409 with `_: "This meal was already analysed; refresh"`; locked day → `DAY_LOCKED`; delete removes the entry then its photo, other members' entries 404, locked day refused.
- [X] T024 [US3] Update `services/api/src/handlers/food-entry-put.ts` (photo rules via `canTransition` and `updateEntryIf`; name follows caption for pending) and `services/api/src/handlers/food-entry-delete.ts` (delete entry, then `photos.delete` best effort without logging PII).
- [X] T025 [US3] Update the inline editor in `apps/web/src/components/food-screen.tsx` / `photo-entry.tsx` and `apps/web/src/server/actions/food.ts`: caption + meal for pending, "fill in myself" calories/macros form for pending, calories/macros correction for analysed, delete for all (editable days only); a 409 conflict refreshes the day with a short notice.

## Phase 6: User Story 4: Photos stay private (P1)

**Independent test**: with two members, member B and anonymous callers never get A's photos, lists or writes.

- [X] T026 [P] [US4] Write tests `services/api/test/food-photo-privacy.test.ts`: member B's `GET /food` never contains A's entries or URLs; B's `PUT/DELETE` on A's entry id is 404; `POST` never accepts another member's id; URLs are only produced by the store for the owner's keys (fake asserts the `food-photos/<sub>/` prefix matches the caller); no handler or tool output includes captions or bytes in errors; a spy on `console` during upload, list, get and submit sees no caption text (FR-014).
- [X] T027 [US4] Fix any gaps T026 finds (ownership checks, prefix assertions in `photo-store.ts`, log hygiene) in `services/api/src/lib/photo-store.ts` and the handlers/tools.

## Phase 7: Polish & cross-cutting

- [X] T028 [P] Update `CLAUDE.md` with a "Photo food log (feature 005)" section (routes, statuses, pending excluded from totals, `food-photos/` prefix and per-function grants, three MCP tools, Server Action 3 MB limit, never log captions or photos) and the 003 note that photo logging is now in feature 005; update `.specify` docs only if paths changed.
- [X] T029 [P] Update `specs/004-ai-coach-mcp/quickstart.md` or the README tool list to mention the three new tools, and make `specs/005-photo-food-log/quickstart.md` match any renamed fields.
- [ ] T030 Run `pnpm check` and `pnpm synth`; fix findings. Then deploy to `dev` and walk through [quickstart.md](quickstart.md) steps 3-6 with a real photo and a vision-capable agent; record the result, including whether the agent could view the MCP image.

## Dependencies & order

- Phase 1 → Phase 2 → stories. T002→T003; T004→T005; T006→T007; T008 after T005; T009 after T005/T007/T008; T010→T011.
- US1 needs Phase 2 (T013 after T012; T015→T016→T018; T017 [P] with T014/T015).
- US2 needs Phase 2 and T008/T013 (a pending entry must exist): T020→T021; T019 before T021.
- US3 needs US1's handlers/UI (T024 after T013; T025 after T018).
- US4 needs US1, US2 and US3; T026→T027.
- Polish last.

## Parallel examples

- Phase 2: T002, T004, T006, T010 together.
- US1: T012, T014, T017 together; then T013, T015.
- US2: T019, T020 together.
- US3: T023 while US2's UI-free work finishes.

## Implementation strategy

- **MVP**: Phase 1-4 (US1 + US2) gives the full loop: photo in, agent writes numbers back.
- Then US3 (edit/delete/manual fill) and US4 (privacy verification) before shipping; polish and the dev walkthrough last.
