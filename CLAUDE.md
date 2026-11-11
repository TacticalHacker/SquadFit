# SquadFit: agent guide

Social fitness & nutrition tracker for friend groups. The product input is [docs/prd.md](docs/prd.md);
the rules are in [.specify/memory/constitution.md](.specify/memory/constitution.md). Read both before
starting any feature.

## Workflow (Spec Kit)

Features are built only through the Spec Kit skills in `.claude/skills/`:

1. `/speckit-specify <one PRD feature area>`: creates branch `NNN-name` and `specs/NNN-name/spec.md`
2. `/speckit-clarify`: resolve open questions (PRD §5: scoring formula, streak rule)
3. `/speckit-plan`: research, data model (DynamoDB key patterns), contracts (zod), quickstart
4. `/speckit-tasks`, then `/speckit-analyze`
5. `/speckit-implement`

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 16 App Router + Tailwind 4. Deployed to Vercel. See `apps/web/AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code. |
| `services/api/src/handlers/*.ts` | One Lambda per file, exporting `handler`. Thin: parse with shared schema → domain → DynamoDB → `json()`. |
| `packages/shared/src/contracts` | zod request/response schemas (single source of truth for the API). |
| `packages/shared/src/domain` | Pure, test-first domain logic (scoring, streaks, day boundaries, nudge limits). |
| `infra/lib` | CDK stacks: `data-stack` (DynamoDB + private avatar bucket), `auth-stack` (Cognito, no self sign-up), `api-stack`. Add a route with `route("<handler-file>", HttpMethod.X, "/path", { write, avatars })` in `api-stack.ts`; routes require a valid Cognito token unless `auth: false`. |
| `infra/scripts/admin.ts` | Operator CLI: `pnpm admin create-user\|reset-password\|list-users`, and `pnpm admin ai-key issue\|revoke <user>` / `ai-key list` for AI client keys. |
| `apps/web/src/server` | Server-only code: Cognito `fetch` client, cookie helpers, API client (`apiFetch`), session DAL (`getMe`, `requireProfile`), Server Actions. `src/proxy.ts` gates routes and refreshes tokens. |

## Commands

```sh
pnpm dev            # Next.js on :3000
pnpm check          # typecheck + lint + test (all packages)
pnpm synth          # cdk synth for stage=dev
pnpm deploy:dev     # deploy Data + Api stacks to AWS (needs AWS creds)
```

## Auth model (feature 001)

- Accounts are created by the operator only; users sign in with username + password (Cognito).
- The browser never sees tokens or calls the AWS API: Server Actions / Server Components call Cognito and the API from the Next server, with tokens in httpOnly cookies (`sf_at`, `sf_rt`, `sf_ch`; see `specs/001-user-accounts/research.md` R3).
- Read the session only inside `<Suspense>` (Cache Components). `getMe()` is memoised per request with React `cache()`, never `use cache: private`.
- Handlers get the caller from verified JWT claims (`getCaller`), and are written as `handle(event, deps)` so tests inject in-memory fakes (`services/api/test/fakes.ts`).
- API responses for other users must never include calorie target, timezone or username (see `PublicMemberSchema`).

## Conventions

- ESM everywhere; relative imports without extensions (bundler resolution).
- `@calci/shared` is consumed as TypeScript source (no build step).
- DynamoDB single table `pk`/`sk` + `gsi1pk`/`gsi1sk`; document key patterns in each feature's `data-model.md`.
- Never compute "today" in UTC; use the user's timezone (constitution §V).

## Workouts (feature 002)

- Routes: `/workouts` (checklist, day nav, 7-day strip) and `/workouts/mine` (custom workouts); `/` redirects to `/workouts`. API: `GET /workouts`, `GET /workouts/summary`, `PUT|DELETE /workouts/entries/{date}/{workoutId}`, `POST|PUT|DELETE /workouts/custom[/{id}]`.
- "Today" and the edit window (today + 2 previous days, `DAY_LOCKED`) are computed only on the server from the profile timezone (constitution V); the client never decides what is editable.
- `buildDayView` / `applyChange` in `packages/shared/src/domain/day-view.ts` are used by the server and the optimistic client; keep them the single source of calorie and total math.
- Standard workouts are code (`STANDARD_WORKOUTS`); entries snapshot name and rate so later edits never change past days.

## Nutrition (feature 003)

- Routes: `/food` (day view: ledger, four meals, add panel) and `/food/mine` (own foods). API: `GET /food`, `GET /food/recent`, `POST|PUT|DELETE /food/entries/...`, `GET|POST|PUT|DELETE /food/foods[/{id}]`.
- Today, the 3-day edit window, calories and macro math are server-authoritative; list entries (built-in or own food) always follow servings × the entry's own rate snapshot, typed entries are free-form. Macros are all-or-none.
- `buildFoodDay` / `applyFoodChange` in `packages/shared/src/domain/food-day.ts` are shared by the server and the optimistic client. The ledger is derived on read: burned comes from the workout entries of the same day, remaining = target − (eaten − burned). It is informational; scoring is feature 004.
- Built-in foods are code (`STANDARD_FOODS`, 40 items); recent foods are derived from the last 90 days of entries.

## AI Coach / MCP (feature 004)

- `POST /mcp` (`services/api/src/handlers/mcp.ts`) is a stateless MCP server (Streamable HTTP, JSON responses) with **no Cognito authorizer**: the handler checks an operator-issued bearer key (`sfk_...`, only its SHA-256 is stored; helpers in `@calci/shared/ai-credential`, server/CLI only, never import in the web bundle). One key per member; `pnpm admin ai-key issue` rotates.
- Tools (`services/api/src/lib/mcp/tools.ts`): `get_user_history`, `post_daily_coach_note`, `update_user_targets`. They act only as the key's member and never take a user id. No leaderboard tool until the scoring feature exists.
- Items: `USER#<sub>/COACH#<date>` (one AI note per day, shown on `/food` via `GET /coach-note`), `MCPCRED` + `MCPTOKEN#<hash>` (keys), `MCPRATE#...` counters with a table `ttl` (60 requests/min per member).
- Profile gained an optional `dailyProteinTarget`; the food ledger carries `proteinTarget`.
- Notes are rendered with `react-markdown` (no raw HTML, no images); never use `dangerouslySetInnerHTML`.
- Never log the key, note text or entries.

## Photo food log (feature 005)

- A photo meal is a food entry with `source: "photo"` and `photo.status`: `pending` → `ai` (written by the member's AI agent through MCP) or `manual` (member fills it in) → `edited` (member corrects). Pending entries have `calories: 0`, count in **no** total (`buildFoodDay` skips them) and are reported as `ledger.pending`. Stored flat on the item as `photoKey`, `caption`, `photoStatus`; recent foods ignore photo entries.
- Add: `POST /food/photos/{date}` (the browser shrinks to JPEG ≤ 1.5 MB with `lib/photo-reduce.ts`, sends base64 through a Server Action; `next.config.ts` raises `serverActions.bodySizeLimit` to 3 MB). The API trusts magic bytes (`sniffImage`), not the declared type. Edit/delete use the existing `PUT|DELETE /food/entries/...`; delete also removes the picture.
- Pictures are private objects `food-photos/<sub>/<entryId>.jpg|webp` in the same bucket as avatars; each function gets S3 access to that prefix only (`photos: "read"|"readwrite"` in `api-stack.ts`). Views carry 1-hour signed URLs; the MCP agent receives the bytes as an MCP image, never a URL.
- MCP tools (feature 004 server): `list_pending_food_photos`, `get_food_photo` (image), `submit_food_estimate` (only while `pending`, only on editable days). Status changes use `FoodRepo.updateEntryIf` (conditional on `photoStatus`) so the member and the agent can never both win; a lost race is a 409 on the web.
- Never log captions, photos or estimates.
