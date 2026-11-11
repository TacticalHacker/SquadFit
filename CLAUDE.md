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
| `infra/scripts/admin.ts` | Operator CLI: `pnpm admin create-user\|reset-password\|list-users`. |
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
