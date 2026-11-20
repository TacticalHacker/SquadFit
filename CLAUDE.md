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

AWS runs only in **ap-south-1** (`AWS_REGION` in `infra/lib/config.ts`): CDK stacks and every operator CLI client use it explicitly, never a region from the environment. `pnpm admin` defaults to `AWS_PROFILE=macmini-raj` when none is set and prints AWS's own error (e.g. an expired login) instead of guessing.

## Auth model (feature 001)

- Accounts are created by the operator (CLI) or an admin (panel, feature 015) only; no public sign-up. Users sign in with username + password (Cognito).
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
- Tools (`services/api/src/lib/mcp/tools.ts`, writes in `writes.ts`): see feature 007 for the current list. They act only as the key's member and never take a user id. No leaderboard tool: the squad boards (feature 010) are for members in the app only.
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
- Ids: built-in `gx-<slug>` (`GYM_EXERCISES`, 54 items), own `gc-<uuid>`. Feature 002's entry routes return 404 for these ids.
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

## Squad leaderboard (feature 010)

- The `/squad` page, boards, `GET /squad/leaderboard` and high-fives described in 010/011 were replaced by feature 013 (below); the rules, stats rebuild and jump rule here still apply. API kept: `GET /squad/feed`, `PUT /me/squad`, `PUT /workouts/gym/entries/{date}/{exerciseId}/confirm`.
- Rules live in `packages/shared/src/domain/squad.ts` + `week.ts` (pure, test-first): weeks are Mon–Sun on the member's local entry dates; a week is hit when workout days ≥ its target (ended weeks keep the target they were stored with); a workout day = gym strength with a completed set, gym cardio, or any activity entry; working set = completed, reps ≥ 1, weight > 0; e1RM (Epley) only for 1–10 reps; first log of an exercise is a baseline, not a PR; at most one PR per exercise per day.
- **Jump rule**: a set more than 50% **and** more than 20 kg above the previous best is excluded and flagged (`stats.flags`, `jumpFlag` on the gym entry view, "Unusual jump" note + **Looks right** in the drawer). `PUT …/confirm` sets `jumpConfirmedAt` (conditional on `updatedAt`); a full gym save never copies it, so an edit re-evaluates. The backfill trusts history (`trustedBefore`).
- **Compute on write**: `refreshSquadStats` (`services/api/src/lib/squad-stats.ts`) rebuilds a member's `USER#<sub>/SQUADSTATS` item and diffs their `FEED#<eventId>` items from *all* their entries. `safeRefresh` is called after `saveGymEntry` (HTTP and MCP `upsert_workout_log`), gym delete, activity create/delete, jump confirm and `PUT /me/squad`; it never throws (the write already succeeded) and logs only the error name. Anything that depends on "today" (current streak, in-progress week, consistency, period filters) is computed on read from the stored weeks/day bests.
- Items: `SQUADSTATS` (versioned put, one retry), `FEED#<eventId>` with `gsi1pk = SQUADFEED#global`; reactions per feature 013. Event ids: `pr#<exerciseId>#<date>`, `wk#<weekStart>`, `first`. An event that is no longer true is deleted with its high-fives. `squadId` ("global") is in every key so more squads can be added later.
- Profile gained `weeklyTarget` (1–7, default 3), `leaderboardVisible` (default true), `shareBodyWeight` (default false); Settings "Squad" section. Hidden members are dropped on the server before ranking (they still see the page, unranked, with a notice). Responses use the strict `SquadMemberSchema` (userId, displayName, avatarUrl, isYou): never body weight (only an opt-in e1RM ÷ weight ratio, from a *saved* weight), timezone, username or calories. Constitution VI 2.3.0 allows this.
- The weekly streak (`{ current, best, weekDays, target }`) replaced the daily one: `weeklyStreak` on `GET /workouts/summary` (shown in `DayNav`) and `streak` in MCP `get_full_context`.
- Operator: `pnpm admin squad backfill` builds stats for every member from history, trusts it, creates **no** feed items, and is safe to re-run (run it once after deploying). Never log entries, sets, weights, names or feed text.

## Member profiles + shared nutrition (feature 011)

- Routes: `/squad/[memberId]` (header, PR board, 12-week heatmap, paged timeline; own profile links to Settings), a one-time sharing card on `/squad`, and Today's workouts (now `/squad/today`, feature 013). API (all Cognito): `GET /squad/members/{id}`, `/timeline?cursor=`, `/days/{date}`, `GET /squad/today?date=`; `PUT /me/squad` also takes `nutritionSharing` and `dismissPrompt`.
- **Two choke points, never bypass them**: `lib/member-access.ts` `resolveMember` (missing, malformed and hidden members all return the same 403 `MEMBER_PRIVATE`; yields the nutrition level) and `nutritionFor` in `packages/shared/src/domain/nutrition-share.ts` (level `off` → the `nutrition` key is absent; `totals` → fixed totals shape; `meals` → adds meals and photo URLs). Every response goes through a strict schema in `contracts/squad-profile.ts`. Photo links are signed only at `meals`, and the list endpoints (`/squad/today`, leaderboard rows) never carry meals.
- Profile attributes `nutritionSharing` (`off` default, `totals`, `meals`) and `nutritionPromptSeen`. Nutrition is computed on read, so a level change applies to past days at once; a member hidden from the leaderboard shows no nutrition at any level.
- Day cards: `buildDayCard` / `pageTimeline` / `heatmapCells` in `domain/member-profile.ts`. A day has one gym session (all gym exercises) plus one session per activity entry. Timeline pages are 10 workout days, cursor = the oldest date shown (exclusive).
- Workout-day reactions (feature 013) use a feed item with event id `day#<date>` (`<author>~day#<date>` in the reaction endpoints). The item is created lazily on the first reaction, written without `gsi1pk` (so it never lists in the feed) and removed by `refreshSquadStats` when the date stops being a workout day.
- Protein days board (feature 013): ranks only on days hitting the member's own *confirmed* protein target (`hitDays`, `rankNutrition`); members at `off`, hidden, unconfirmed or without a target are absent. Never rank, sort or label by calories in, burned or deficit. Burned calories always show `~`, plus "adj." when any workout that day has an `aiNote`.
- Feed: `protein_streak` items (`FEED#protein7#<endDate>`) are kept true by `lib/protein-events.ts` (`safeRefreshProtein`, called after food writes, protein target and sharing changes); the feed also drops them at read time for hidden or `off` authors.
- Never log meals, captions, photo keys, sets or names.

## Health activity sync (feature 012)

- Daily steps (+ optional active kcal, distance km) from Apple Health: item `USER#<sub>/ACTIVITY#<date>` (member's local date), written with a full put so the latest write wins and values are never added. One save path, `lib/activity-write.ts` (`saveActivity`), used by both routes; parsing, validation, the board and the 7-day run are pure in `packages/shared/src/domain/activity.ts` (steps 0–100,000, kcal 0–5,000, distance 0–150 km, date ≤ today and ≥ today − 30 in the member's timezone; any bad day refuses the whole request with "18 Nov: …" messages).
- Routes: MCP tools `upsert_daily_activity` / `get_daily_activity` (source `mcp`), and `POST /integrations/activity` (no authorizer) for an iPhone Shortcut or Health Auto Export (detected by `data.metrics`; samples summed per day within one request, mi/kJ converted). That route accepts only a member's `sfh_` Health sync token (`parseHealthBearer`); the MCP route accepts only `sfk_`, so neither works on the other. 60 requests/hour per member (`HEALTHRATE#<sub>#<hour>`), 1 MB body, 401/413/422/429.
- Tokens are member self-service from Settings: `POST|DELETE /me/health-token` (shown once; `HEALTHTOKEN#<hash>` + `USER#<sub>/HEALTHCRED` with `lastUsedAt`), status `GET /me/health-sync`. Profile gained `dailyStepGoal` (default 8,000) and `shareSteps` (default on) via `PUT /me/steps`. Web env `HEALTH_SHORTCUT_URL` (optional, https only) shows the "Add the SquadFit Shortcut" button.
- Privacy gate: `stepsShared` / `stepsVisibleTo` in `lib/member-access.ts` (visible on the leaderboard AND sharing steps), and squad handlers get steps only through `stepsFor` in `lib/member-view.ts` (or the `stepsShared`/`stepsVisibleTo` gate). Steps appear on day cards, Today's rest-day cards (`restDays`) and the monthly Steps board (average over synced days, no-data members absent). Active kcal and distance appear only in `MemberProfile.steps` (profile chart) and are never ranked (constitution VI 2.5.0).
- Feed `step_streak` items (`FEED#steps7#<endDate>`) are kept true by `lib/step-events.ts` (`safeRefreshSteps`, after activity writes, `PUT /me/steps` and `PUT /me/squad`); `refreshSquadStats` leaves them alone.
- Never log tokens, request bodies, steps, calories or distances.

## Squad v2 (feature 013)

- `/squad`: targets/nutrition prompts and hidden notice, latest 5 feed items (`GET /squad/feed?limit=5`, "See all" → `/squad/feed`, "See today's workouts" → `/squad/today`), one segmented control **This month | Hall of Fame** (`?view=fame`), then board cards (top 3 + "You · #N"). Full list: `/squad/boards/[board]` (`?sort=pct` for PR jump, `?lifts=4` for Big 4). No date picker, period row, tab row or explanation paragraphs: use `InfoTip` ((i) → one sentence in a `BottomSheet`).
- API (all Cognito): `GET /squad/boards` (every board's **full** ranked list; alternate orders carry their own server rank `pctRank`/`big4Rank`), `GET /squad/hall-of-fame`, `PUT|DELETE /squad/feed/{id}/reactions/{fire|muscle|crown}`, `PUT /me/targets` (`{ dailyCalorieTarget, dailyProteinTarget|null }` confirms, `{ dismiss: true }` hides the prompt). Removed: `GET /squad/leaderboard`, the high-five routes.
- Board registry: `packages/shared/src/domain/boards.ts` (`BOARD_DEFS`, one rank function each, `buildSquadBoards`, `buildHallOfFame`, `clubOf`, `monthDates`, `squadMonth`). Adding a board = one `BOARD_DEFS` entry + rank function + `SquadBoardSchema` variant (`contracts/squad-boards.ts`) + `BOARD_COPY` entry. Boards: workouts, streak (not monthly), improved (sessions whose top set beat the previous session of that exercise: more weight at ≥ reps or more reps at the same weight; first sessions and cardio never count), steps (ranked from 3 synced days), prJump (built-in bench/squat/deadlift/OHP/row/pull-ups; this month's best estimate − best before this month; first-ever logs are not jumps), strength (best-ever Big 3; missing a lift = unranked, listed last), protein.
- Months: `SQUADSTATS.months["YYYY-MM"] = { workoutDays, liftsImproved }` and `lifts[id].monthBests` cover all history, bucketed by the entry's own local date; the *current* month comes from the squad timezone (`SQUAD#global / SETTINGS.timezone`, default Asia/Kolkata, `pnpm admin squad timezone <IANA>`). Streaks and day boundaries keep each member's timezone.
- Club badges (225/300/400/450/500 kg, est. Big 3): `SQUADSTATS.badges` (club → date first reached); feed events `badge#<club>` go through the normal feed diff, so they post once and disappear if no longer true; the backfill seeds them.
- Reactions: `RX#<eventId>#<type>#<reactorSub>` + counts `rxFire|rxMuscle|rxCrown` on the feed item, one transaction per toggle; never on your own items. `reactionsView` (`lib/member-view.ts`) builds the response shape. `pnpm admin squad migrate-reactions` turned `HI5#` items into 💪 (safe to re-run).
- Targets confirmed: profile `targetsConfirmedAt` (set by every profile save, `setTargets`, MCP `update_user_targets`) and `targetsPromptDismissed`. `nutritionOn(owner, viewerId, …)` nulls an unconfirmed member's targets for everyone else; unconfirmed members are off the Protein days board and earn no protein streak.
- Wording: every squad-area phrase and formatter lives in `apps/web/src/lib/plain.ts` (no "e1RM", always units, "per dumbbell", zero streak hidden). Change wording there, not in components.
- Rollout: deploy, `pnpm admin squad migrate-reactions`, then `pnpm admin squad backfill`.
- Total weight lifted is never a board: profiles show this week vs last week (`weekVolumes`, `weightLifted` on `GET /squad/members/{id}`).
- The body-weight ratio switch is hidden until feature 014 (relative strength, bodyweight log and privacy).

## Exercise admin (feature 015)

- Admin = Cognito group `admin` (CDK `CfnUserPoolGroup` in `auth-stack.ts`), managed with `pnpm admin admins add|remove <username>` / `admins list`. The access token's `cognito:groups` (string `"[admin]"` from the HTTP API authorizer, or an array) becomes `Caller.isAdmin` (`isAdminClaim`); `GET /me` returns the caller's own `isAdmin`. Members sign in again to pick it up; removal takes effect on the next token refresh (≤ 1 h).
- Web: `/settings/admin` (`notFound()` unless `me.isAdmin`; link in Settings only for admins), `components/admin-exercises.tsx`, Server Actions in `server/actions/admin.ts` (`refresh()` after writes). API (Cognito + `requireAdmin` → 403 `FORBIDDEN`): `GET|POST /admin/exercises`, `PUT /admin/exercises/{id}` (rename/regroup/retire/restore, conditional on `updatedAt` → 409 `STALE`), `POST /admin/exercises/{id}/merge`.
- Items: `GYMCATALOG / EX#<gx-id>` (status `active|retired`, created/updated by + at; max 200) and name guard `GYMCATALOGNAME#<normalized name> / N`, written in one transaction. Ids are `gx-<slug>[-n]` and never change; retired = hidden, never deleted, name stays reserved. Built-ins are not editable (404).
- The library = `GYM_EXERCISES` + active catalog (`buildLibrary`), read through `getLibrary(deps)` (`lib/gym-library.ts`, 2-minute per-container cache, built-ins only on a read error). Always pass the library to `findGymExercise`, `isExerciseNameTaken`, `findGymExerciseByName` and `buildGymView`; only `boards.ts` keeps `GYM_EXERCISES` (Big 3 / PR-jump lifts are built-ins). Catalog exercises show `isBuiltIn: true`; a retired one saves only on a day that already has its entry (snapshot fallback).
- Merge: `lib/gym-merge.ts` (`findOwnMatches`, `mergeInto`) is shared by the panel and `pnpm admin gym merge` (which now accepts catalog targets). Days move with sets/`updatedAt`/`aiNote`/`jumpConfirmedAt` kept; a day that already has the target is skipped and the own exercise kept; squad stats are refreshed. The panel only ever sees counts.
- Members (Story 5): `POST /admin/users` `{ username }` creates a Cognito account (`AdminCreateUser`, no message) and returns `{ username, temporaryPassword }` once; the panel's Members section shows it with a Copy button. Only that function has `USER_POOL_ID` and a `cognito-idp` permission (`AdminCreateUser` on this pool; stack test enforces it). `generateTempPassword` lives in `services/api/src/lib/temp-password.ts` (the CLI re-exports it). Password resets stay on the CLI.
- Member-made (Story 6): `GET /admin/exercises` also returns `memberExercises` (own exercises not taken by the library or any catalog row, grouped by `exerciseNameKey`: name, group, member and day counts, never who). Each row carries a `suggestion` from `suggestLibraryMatch` (`domain/exercise-match.ts`, deliberately cautious: equipment/angle clashes, weak overlap and ties give none). **Add to library** (`promoteExercise`) = `POST /admin/exercises` with that name, then the merge; **Merge**/**Merge into…** (`mergeMemberExercise`) = `POST /admin/exercises/{target}/merge` with `{ sourceName }`. Never show member usernames there. Gym name matching everywhere uses `exerciseNameKey` (case, spacing and punctuation ignored), not `normalizeWorkoutName`.
- Never log member ids, usernames, temporary passwords, own-exercise names, sets or weights from admin code.
