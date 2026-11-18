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
| `apps/web` | Next.js 16 App Router + Tailwind 4. Deployed to AWS Amplify Hosting (`amplify.yml`). See `apps/web/AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code. |
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

## Theme ("Training Log")

- Colours exist only as CSS variables in `apps/web/src/app/globals.css` (light + OS dark mode). Tailwind's default palette is removed (`--color-*: initial`), so use the token utilities: `bg-paper|surface|surface-2`, `text-ink|muted|faint`, `border-line|line-strong`, `accent`, `accent-soft`, `success|warning|danger` (with `/10`-style opacity for tints).
- Reuse the class strings in `components/form-bits.tsx` (`buttonClass` = the one primary per section, `secondaryButtonClass`, `inputClass`, `cardClass`, `chipClass`, `segmentClass`, `notice*Class`, `iconButtonClass`). Focus rings are global (`:focus-visible`); don't add per-element outlines.
- Icons are `lucide-react` (size 16–20, `strokeWidth={1.75}`); no emoji as icons, no gradients, glows, blur or scale animations. Radius is 6–8 px (`rounded-md`/`rounded-lg`); `rounded-full` only for tiny badges/chips and avatars.
- Press feedback is colour on `:active` (touch has no hover). `BottomSheet` motion runs through the spring in `lib/spring.ts` (interruptible, velocity hand-off, momentum projection); close buttons in a sheet header must be `<SheetClose />` so the sheet slides out before `onClose`.

## Workouts (feature 002)

- Routes: `/workouts` (checklist, day nav, 7-day strip) and `/workouts/mine` (custom workouts); `/` redirects to `/workouts`. API: `GET /workouts`, `GET /workouts/summary`, `PUT|DELETE /workouts/entries/{date}/{workoutId}`, `POST|PUT|DELETE /workouts/custom[/{id}]`.
- "Today" and the edit window (today + 2 previous days, `DAY_LOCKED`) are computed only on the server from the profile timezone (constitution V); the client never decides what is editable.
- `buildDayView` / `applyChange` in `packages/shared/src/domain/day-view.ts` are used by the server and the optimistic client; keep them the single source of calorie and total math.
- Entries snapshot name and rate so later edits never change past days. Feature 007 removed the built-in activity list: activities are the member's own only, and old `std-*` entries show as removed rows that still count.

## Nutrition (feature 003)

- Routes: `/food` (day view: ledger, four meals, add panel) and `/food/mine` (own foods). API: `GET /food`, `GET /food/recent`, `POST|PUT|DELETE /food/entries/...`, `GET|POST|PUT|DELETE /food/foods[/{id}]`.
- Today, the 3-day edit window, calories and macro math are server-authoritative; list entries (built-in or own food) always follow servings × the entry's own rate snapshot, typed entries are free-form. Macros are all-or-none.
- `buildFoodDay` / `applyFoodChange` in `packages/shared/src/domain/food-day.ts` are shared by the server and the optimistic client. The ledger is derived on read: burned comes from the workout entries of the same day, remaining = target − (eaten − burned). It is informational; scoring is feature 004.
- Built-in foods are code (`STANDARD_FOODS`, 40 items); recent foods are derived from the last 90 days of entries.

## AI Coach / MCP (feature 004)

- `POST /mcp` (`services/api/src/handlers/mcp.ts`) is a stateless MCP server (Streamable HTTP, JSON responses) with **no Cognito authorizer**: the handler checks an operator-issued bearer key (`sfk_...`, only its SHA-256 is stored; helpers in `@calci/shared/ai-credential`, server/CLI only, never import in the web bundle). One key per member; `pnpm admin ai-key issue` rotates.
- Tools (`services/api/src/lib/mcp/tools.ts`, writes in `writes.ts`): see feature 007 for the current list. They act only as the key's member and never take a user id. No leaderboard tool until the scoring feature exists.
- Items: `USER#<sub>/COACH#<date>` (one AI note per day; v2 format since feature 007), `MCPCRED` + `MCPTOKEN#<hash>` (keys), `MCPRATE#...` counters with a table `ttl` (60 requests/min per member).
- Profile gained an optional `dailyProteinTarget`; the food ledger carries `proteinTarget`.
- Never use `dangerouslySetInnerHTML` for AI text; render it as plain text.
- Never log the key, note text or entries.

## Photo food log (feature 005)

- A photo meal is a food entry with `source: "photo"` and `photo.status`: `pending` → `ai` (written by the member's AI agent through MCP) or `manual` (member fills it in) → `edited` (member corrects). Pending entries have `calories: 0`, count in **no** total (`buildFoodDay` skips them) and are reported as `ledger.pending`. Stored flat on the item as `photoKey`, `caption`, `photoStatus`; recent foods ignore photo entries.
- Add: `POST /food/photos/{date}` (the browser shrinks to JPEG ≤ 1.5 MB with `lib/photo-reduce.ts`, sends base64 through a Server Action; `next.config.ts` raises `serverActions.bodySizeLimit` to 3 MB). The API trusts magic bytes (`sniffImage`), not the declared type. Edit/delete use the existing `PUT|DELETE /food/entries/...`; delete also removes the picture.
- Pictures are private objects `food-photos/<sub>/<entryId>.jpg|webp` in the same bucket as avatars; each function gets S3 access to that prefix only (`photos: "read"|"readwrite"` in `api-stack.ts`). Views carry 1-hour signed URLs; the MCP agent receives the bytes as an MCP image, never a URL.
- MCP tools (feature 004 server): `list_pending_food_photos`, `get_food_photo` (image), `submit_food_estimate` (only while `pending`, only on editable days). Status changes use `FoodRepo.updateEntryIf` (conditional on `photoStatus`) so the member and the agent can never both win; a lost race is a 409 on the web.
- Never log captions, photos or estimates.

## Gym logger (feature 006)

- Route `/workouts/gym` is the default Workouts tab ("Gym | Activities" in `WorkoutsTabs`; `/` and the Workouts nav link land there; `?date=` kept; `?open=<exerciseId>` opens a drawer). API: `GET /workouts/gym`, `PUT|DELETE /workouts/gym/entries/{date}/{exerciseId}`, `POST|PUT|DELETE /workouts/gym/exercises[/{id}]`.
- A gym entry is a workout entry: `USER#<sub>/ENTRY#<date>#<exerciseId>` with `kind: "gym"`, so day totals, the strip, the food ledger's burned and AI history include it automatically. It also sets `gsi1pk = GYM#<sub>#<exerciseId>`, `gsi1sk = <date>` for "last time" lookups. Own exercises: `GYMEX#gc-<uuid>` (max 50, never Cardio).
- Ids: built-in `gx-<slug>` (`GYM_EXERCISES`, 28 items), own `gc-<uuid>`. Feature 002's entry routes return 404 for these ids.
- `gymTotals` / `cardioTotals` in `packages/shared/src/domain/gym.ts` are the only gym math (2.5 min/set, 15 kcal/set, every set counts); the server recomputes and rejects client totals. `drawerReducer` (`gym-drawer.ts`) drives the steppers.
- Save/remove return `GymSaveResult` (no per-exercise "last" fan-out); the client keeps its `last` values.
- Unsaved drawer values are drafts in `localStorage` (`sf:gymdraft:v1:<username>:<date>:<id>`, `lib/gym-draft.ts`), read via `useSyncExternalStore`, never sent to the server.
- Never log sets, weights or exercise names.

## AI Coach v2 (feature 007)

- MCP tools: `get_full_context` (profile incl. body weight, all logs with `logId`, totals incl. gym volume, streak, `leaderboard: null`), `get_user_history`, `update_workout_calories`, `upsert_workout_log`, `upsert_food_log`, `post_overall_coach_note`, `update_user_targets`, plus the photo tools. `post_daily_coach_note` is retired (always errors). AI writes are limited to the member's edit window (today + 2 previous days).
- `logId = "<date>#<id>"` (`formatLogId` / `parseLogId` in `@calci/shared`), id = workout `workoutId` or food `entryId`.
- AI writes go through the same services as the HTTP handlers: `lib/gym-save.ts` (`saveGymEntry`) and `lib/food-write.ts` (`createFoodEntry`, `patchFoodEntry`). Don't duplicate validation in tools.
- Workout entries may carry `aiNote` (≤ 120 chars): set by `update_workout_calories` through `WorkoutRepo.setAiAdjustment`, conditional on the `updatedAt` the agent read. Any member edit clears it (`updateEntryMinutes` removes it; gym saves are full puts). Totals are derived on read, so nothing else needs updating.
- Coach note v2 at `COACH#<date>` with `format: 2`: headline (≤ 65), status `on_track|needs_attention|pr_alert`, ≤ 3 highlights, ≤ 3 actions `{text, done}`. Items without `format: 2` read as no note. Ticks: `PUT /coach-note/{date}/actions/{index}` with `noteUpdatedAt` (409 if the note was replaced). `GET /coach-note` returns `{ note, metrics }` (net kcal, protein, gym volume computed live).
- Web: `PulseBar` under `DayStrip` on both Workouts tabs (inline card ≥ 640 px, `BottomSheet` on phones); `AiBadge` next to AI-adjusted calories. Food has no coach block.
- Profile `bodyWeightKg` (20–400, 1 decimal; 75 default via `effectiveBodyWeight`), edited in Settings only; never in public views.
- Never log notes, reasons, action items, body weight or entries.

## ChatGPT connector (feature 008)

- ChatGPT custom connectors can't send headers, so `ANY /mcp/{key}` (same Lambda, no authorizer) accepts the member's `sfk_` key as the last path segment (`parsePathKey`). The header still wins when present. Use "No authentication" in ChatGPT with URL `<api>/mcp/<sfk_key>`.
- The URL is a secret: never log request paths in the MCP function, and don't add API Gateway access logs without redacting `/mcp/{key}`.

## Public landing page (feature 009)

- `/` is public and static (`apps/web/src/app/page.tsx`, parts in `app/_landing/`). The proxy sends anyone with a session from `/` and `/sign-in` to `/workouts/gym` before rendering, so the page never reads cookies. Members-only pages still redirect to `/sign-in?next=...`. Link to `/workouts/gym`, not `/`, from inside the app.
- Anonymous API routes (no authorizer), called only from the Next server via `publicFetch` (`server/public-api.ts`): `GET /public/pulse` returns only `{ lifters, workoutsLast7Days, computedAt }` (constitution VI 2.2.0 allows exactly these; `PulseResponseSchema` is strict; last 7 days in each member's timezone). `POST /public/waitlist` takes `{ name, email, primaryGoal, website }`.
- Waitlist items: `WAITLIST` / `<iso>#<email>` plus guard `WAITLISTEMAIL#<email>` / `E` (one transaction, dedupe). Honeypot `website`, and rate counters `PUBRATE#ip#<sha256>#<hour>` (5/h) and `PUBRATE#all#<hour>` (30/h) with `ttl`. New, duplicate and honeypot submissions all get the same 202. The Server Action forwards the visitor address as `x-sf-client-ip`.
- Operator: `pnpm admin waitlist list`. Never log names, emails, goals or addresses.
- The preview mockups are static copy; the Squad tab stays tagged "Coming soon" until scoring/streaks/nudges ship.
