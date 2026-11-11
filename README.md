# SquadFit (Tactical Calories)

Social fitness & nutrition tracker for friend groups: check off workouts, log meals, compete on
a shared scoreboard, keep streaks alive, and nudge friends who slack off.

- **Product requirements:** [docs/prd.md](docs/prd.md)
- **Engineering principles:** [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Stack

```
apps/web           Next.js 16 (App Router, Tailwind 4)   → Vercel
services/api       TypeScript Lambda handlers            → AWS Lambda + API Gateway (HTTP API)
packages/shared    zod contracts + pure domain logic     → used by web, api
infra              AWS CDK v2 (Data + Api stacks)        → DynamoDB, Lambda, HTTP API
```

## Getting started

```sh
nvm use                       # Node 24
pnpm install
pnpm check                    # typecheck + lint + tests
pnpm dev                      # http://localhost:3000
```

### Deploy the backend (AWS)

```sh
export AWS_PROFILE=...        # credentials for the target account
pnpm cdk bootstrap            # once per account/region
pnpm deploy:dev               # prints ApiUrl
```

### Deploy the frontend (Vercel)

1. Import the repo in Vercel and set **Root Directory** to `apps/web` (Vercel detects Next.js and pnpm).
2. Set `NEXT_PUBLIC_API_URL` to the `ApiUrl` output for the matching stage.
3. Add the production domain to `allowedOrigins` in [infra/lib/config.ts](infra/lib/config.ts) and redeploy the API.

For local dev, copy `.env.example` → `apps/web/.env.local`.

## Spec-driven development

Built with [Spec Kit](https://github.com/github/spec-kit). In Claude Code:

```
/speckit-specify  Workout tracker: checklist of workouts with duration and calories burned (PRD §3.1)
/speckit-clarify
/speckit-plan
/speckit-tasks
/speckit-analyze
/speckit-implement
```

Suggested feature order: **001 auth & groups → 002 workout tracker → 003 nutrition tracker →
004 scoreboard → 005 streaks & nudges.**
