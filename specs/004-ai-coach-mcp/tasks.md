# Tasks: AI Coach (Remote MCP)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution III requires failing tests first for domain logic, and CDK assertions for access-controlling resources.

**Format**: `- [ ] T### [P?] [US?] Description with file path`. `[P]` = different files, no dependency on unfinished tasks.

## Phase 1: Setup

- [X] T001 Add `@modelcontextprotocol/sdk@^1.32` to `services/api/package.json` and `react-markdown` to `apps/web/package.json`; run `pnpm install`. Confirm the SDK's web-standard Streamable HTTP transport export name (research R1) and note it in `research.md` if it differs.
- [X] T002 Add `.env.example` note that `/mcp` needs no new env vars (uses `TABLE_NAME`); no secrets are added to env.

## Phase 2: Foundational (blocks all stories)

**Credential, rate limit and MCP skeleton: every tool depends on these.**

- [X] T003 [P] Write failing tests `packages/shared/test/ai-credential.test.ts`: token format `sfk_` + 43 base64url chars (32 random bytes); `hashToken` returns SHA-256 hex; `parseBearer` accepts only `Bearer <token>` with the `sfk_` prefix and rejects anything else.
- [X] T004 Implement `packages/shared/src/domain/ai-credential.ts` (`generateToken`, `hashToken`, `parseBearer`) and export from `packages/shared/src/index.ts`.
- [X] T005 [P] Write failing tests `packages/shared/test/coach-note.test.ts` for limits: `summaryMarkdown` trimmed 1-4,000 chars; `recommendations` 1-10 items, each trimmed 1-280 chars; note `date` within today and the 30 days before (never future); history window `startDate ≤ endDate ≤ today`, at most 31 days.
- [X] T006 Implement `packages/shared/src/domain/coach-note.ts` (limit constants, `validateNoteDate`, `validateHistoryWindow`) and export.
- [X] T007 [P] Add zod schemas in `packages/shared/src/contracts/coach.ts`: `CoachNoteInputSchema`, `CoachNoteSchema` (`generatedBy: "AI"`), `CoachNoteResponseSchema` (`{ note: CoachNote | null }`), `HistoryInputSchema`, `TargetsInputSchema` (at least one field; `dailyCalorieTarget` int 500-10,000; `dailyProteinTarget` int 10-500 or null); add `RATE_LIMITED` to `ApiErrorCodeSchema` in `contracts/errors.ts`; export.
- [X] T008 [P] Write failing tests `services/api/test/mcp-auth.test.ts` (fakes from `services/api/test/fakes.ts`, add in-memory credential repo and rate counter): missing/malformed/unknown/revoked key → 401 with the identical message; member without profile → 409 `PROFILE_REQUIRED`; 61st request in a minute → 429 with `Retry-After`; body over 64 KB → 413; `GET`/`DELETE` → 405; `OPTIONS` → 204 with CORS headers (contracts/mcp-tools.md).
- [X] T009 Implement `services/api/src/lib/credential-repo.ts`: `CredentialRepo` interface and DynamoDB impl. `getByHash(hash)` reads `pk=MCPTOKEN#<hash>, sk=MCPTOKEN`; `issue(userId, hash, now)` transactionally writes `MCPTOKEN#<hash>` and `USER#<sub>/MCPCRED` and deletes the previous lookup item; `revoke(userId)` deletes both; `hit(userId, nowMs)` atomic `ADD count` on `MCPRATE#<sub>#<epochMinute>` with `ttl` = window end + 120 s and returns the new count. Add it to `Deps` in `services/api/src/lib/deps.ts` and the test fakes.
- [X] T010 Implement `services/api/src/handlers/mcp.ts` (`handle(event, deps)`): method gating, auth via `parseBearer` → `hashToken` → `getByHash`, profile check, rate limit (60/min), size limit, then the SDK stateless transport with `enableJsonResponse` over an event→`Request`/`Response` adapter in `services/api/src/lib/mcp/server.ts`. Tools are registered by `buildMcpServer(caller, deps)` in `services/api/src/lib/mcp/tools.ts` (empty for now). Caller identity comes only from the credential. Never log the key, body or entries.
- [X] T011 [P] Write failing CDK assertions in `infra/test/stacks.test.ts`: table has TTL attribute `ttl`; `ANY /mcp` route exists with **no** authorizer; the mcp function has read/write table access and no S3 access; a `TableName` stack output exists.
- [X] T012 Update `infra/lib/data-stack.ts` (`timeToLiveAttribute: "ttl"`, `CfnOutput` `TableName`) and `infra/lib/api-stack.ts` (extend `route()` to accept `HttpMethod.ANY`; `route("mcp", HttpMethod.ANY, "/mcp", { auth: false, write: true })`; memory 512 MB, timeout 15 s for this function only).

**Checkpoint**: an authenticated `initialize` and `tools/list` (empty) work against fakes.

## Phase 3: User Story 1: Assistant coaches me, I see it in the app (P1) 🎯 MVP

**Independent test**: with a seeded credential, call `get_user_history` and `post_daily_coach_note`, then load `/food` and see the AI-badged card.

- [X] T013 [P] [US1] Write failing tests `services/api/test/mcp-history.test.ts`: window validation per T005 (start after end, > 31 days, future end → `isError`); returns one object per day including empty days, oldest first, with food entries (meal, name, servings, calories, optional macros), workouts (name, minutes, calories) and day totals (eaten, burned, net, protein, carbs, fat) from the shared `buildFoodDay`; only the caller's data; days use the profile timezone.
- [X] T014 [P] [US1] Write failing tests `services/api/test/mcp-note.test.ts`: post saves `COACH#<date>` with `generatedBy: "AI"`; second post same date replaces and keeps `createdAt`; empty summary, 0 or 11 recommendations, 281-char item, 4,001-char summary, future date and date older than 30 days → `isError` and nothing stored; caller-supplied extra `userId` argument is ignored/rejected.
- [X] T015 [P] [US1] Write failing tests `services/api/test/coach-note-get.test.ts`: `GET /coach-note` returns `{ note: null }` when absent, the note when present, never another member's note, 400 for future date, 409 without profile.
- [X] T016 [US1] Implement `services/api/src/lib/coach-repo.ts` (`CoachRepo`: `get(userId, date)`, `put(userId, note, nowIso)` preserving `createdAt`; DynamoDB `COACH#<date>` per data-model.md; add to `Deps` and fakes).
- [X] T017 [US1] Implement `services/api/src/lib/mcp/history.ts` (reuse `food.listEntriesInRange`, `workouts.listEntriesInRange`, `buildFoodDay`/`buildDayView`) and register `get_user_history` and `post_daily_coach_note` in `services/api/src/lib/mcp/tools.ts` with the schemas from T007; tool errors return `isError: true` with a message naming the rule.
- [X] T018 [US1] Implement `services/api/src/handlers/coach-note-get.ts` (uses `loadDayContext`, `resolveReadDate`); add `route("coach-note-get", HttpMethod.GET, "/coach-note")` in `infra/lib/api-stack.ts` and a CDK assertion in `infra/test/stacks.test.ts`.
- [X] T019 [P] [US1] Build `apps/web/src/components/coach-card.tsx`: AI badge, summary via `react-markdown` (no raw HTML, images disabled, links `rel="noopener noreferrer nofollow"` and opening in a new tab), recommendations as a list; dark card styling matching `food-ledger.tsx`. Add `apps/web/src/lib/coach-markdown.test.ts` covering that `<script>` and `<img onerror>` in a summary render as inert text.
- [X] T020 [US1] Fetch `/coach-note` in parallel with the day view in `apps/web/src/app/(app)/food/page.tsx` (validate with `CoachNoteResponseSchema`; a note-fetch failure must not break the page) and render `<CoachCard>` above the ledger only when a note exists, on editable and locked days.

**Checkpoint**: US1 works end to end with a fake-seeded credential.

## Phase 4: User Story 2: Assistant adjusts my targets (P2)

**Independent test**: set targets through the tool; `/food` shows remaining against the new calorie target and protein against the protein target.

- [X] T021 [P] [US2] Write failing tests in `packages/shared/test/profile.test.ts` and `packages/shared/test/food-day.test.ts`: `ProteinTargetSchema` is an integer 10-500; `ledger.proteinTarget` is the passed value or `null`.
- [X] T022 [P] [US2] Write failing tests `services/api/test/mcp-targets.test.ts`: only calorie, only protein, both; `null` clears protein; out-of-range or non-integer or empty input → `isError`, nothing changes; response states new values; the next `GET /food` ledger reflects them; `me-profile-put.test.ts` accepts optional `dailyProteinTarget` and clears it when null/absent; `me-get.test.ts` returns `dailyProteinTarget: number | null`.
- [X] T023 [US2] Add `ProteinTargetSchema` to `packages/shared/src/domain/profile.ts`; `dailyProteinTarget` (optional, nullable) to `ProfileInputSchema` and (nullable) to `OwnProfileSchema` in `contracts/me.ts`; `proteinTarget` to `FoodLedger` and `buildFoodDay` in `domain/food-day.ts` (+ `FoodDayViewSchema` in `contracts/food.ts`).
- [X] T024 [US2] Update `services/api/src/lib/profile-repo.ts` (`dailyProteinTarget` read/write, removed when null; new `setTargets(userId, partial, nowIso)` conditional on `attribute_exists(pk)`), `lib/views.ts`, `lib/day-context.ts` (carry `proteinTarget`), `lib/food-day-loader.ts`, and the in-memory fakes.
- [X] T025 [US2] Register `update_user_targets` in `services/api/src/lib/mcp/tools.ts` per contracts/mcp-tools.md (at least one field; names `dailyCalorieTarget`, `dailyProteinTarget`).
- [X] T026 [P] [US2] Add the optional protein-target field to `apps/web/src/components/profile-form.tsx` and `apps/web/src/server/actions/profile.ts`, and show `grams / target g` (with a progress bar) in `apps/web/src/components/food-ledger.tsx` only when `proteinTarget` is set; adjust `food-screen.tsx` optimistic ledger to carry `proteinTarget` through `applyFoodChange`.

## Phase 5: User Story 3: Operator issues and revokes access (P2)

**Independent test**: issue a key, run the quickstart curl calls, revoke, get 401.

- [X] T027 [P] [US3] Write failing tests `infra/test/ai-key.test.ts` for the pure helpers in `infra/scripts/ai-key.ts`: `formatSnippet(url, token)` returns the Cursor, Claude Code and `mcp-remote` snippets; username must pass `UsernameSchema`.
- [X] T028 [US3] Implement `infra/scripts/ai-key.ts` and wire `pnpm admin ai-key issue|revoke|list <username> [--stage]` in `infra/scripts/admin.ts`: resolve username → `sub` with `AdminGetUser`; read `TableName` and `ApiUrl` from the stack outputs; `issue` generates a token with `generateToken`, stores only the hash through the same item layout as `credential-repo.ts`, prints the secret once plus the snippets, and says issuing again rotates; `revoke` deletes both items; `list` shows username, created date, never secrets. Update the usage text and `README.md` command list.
- [X] T029 [US3] Add `services/api/test/mcp-revoke.test.ts`: after `revoke` the same key gets 401 on the very next request; after rotation the old key fails and the new one works.

## Phase 6: Polish & cross-cutting

- [X] T030 [P] Update `CLAUDE.md` with an "AI Coach (feature 004)" section (routes, `/mcp`, key CLI, `COACH#`, protein target, privacy notes) and make `specs/004-ai-coach-mcp/quickstart.md` match any renamed exports.
- [X] T031 [P] Add a privacy test `services/api/test/mcp-privacy.test.ts`: two members, member A's key can never return or alter member B's entries, notes or targets, and no tool response contains `username`, other members' `timezone` or `dailyCalorieTarget`; error/log output never contains the key.
- [ ] T032 Run `pnpm check` and `pnpm synth`; fix findings. Deploy to `dev` and walk through [quickstart.md](quickstart.md) steps 2-6 with curl and Cursor or Claude Code; record the result of the Claude Desktop/mobile check from research R6.

## Dependencies & order

- Phase 1 → Phase 2 → stories. T003→T004, T005→T006, T008→T009→T010, T011→T012.
- US1 needs Phase 2. US2 needs Phase 2 and T016's registration pattern (T017) only for `tools.ts` edits (T025 after T017). US3 needs T004, T009, T012. US2 and US3 are independent of each other.
- Within a story: tests first (must fail), then repo/schema, then handler/tool, then web.
- Polish last.

## Parallel examples

- Phase 2: T003, T005, T007, T008, T011 together (different files).
- US1: T013, T014, T015, T019 together; then T016-T018; T020 last.
- US2: T021, T022, T026 together before T023-T025 (T026 after T023 for types).
- US3: T027 while US2 is in progress.

## Implementation strategy

- **MVP**: Phase 1-3 (US1): the loop works with `get_user_history` and `post_daily_coach_note`, but real use needs a way to issue keys, so ship US3 (T027-T029) right after as the minimum usable slice.
- Then US2 (targets + protein), then polish and the dev walkthrough.
