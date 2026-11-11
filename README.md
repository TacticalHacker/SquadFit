# SquadFit (Tactical Calories)

Social fitness & nutrition tracker for friend groups: check off workouts, log meals, compete on
a global leaderboard, keep streaks alive, and nudge friends who slack off.

- **Product requirements:** [docs/prd.md](docs/prd.md)
- **Engineering principles:** [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Stack

```
apps/web           Next.js 16 (App Router, Tailwind 4)   → Vercel
services/api       TypeScript Lambda handlers            → AWS Lambda + API Gateway (HTTP API, JWT-protected)
packages/shared    zod contracts + pure domain logic     → used by web, api
infra              AWS CDK v2 (Data, Auth, Api stacks)   → DynamoDB, S3, Cognito, Lambda, HTTP API
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
export CDK_DEFAULT_REGION=ap-south-1   # the app defaults to us-east-1 if unset
pnpm cdk bootstrap            # once per account/region; skip if CDKToolkit already exists there
pnpm deploy:dev               # deploys Calci-dev-Data, -Auth, -Api
```

Note the stack outputs: `ApiUrl` (Api stack) and `UserPoolClientId` (Auth stack).

### Create user accounts (there is no public sign-up)

```sh
pnpm admin create-user alice          # prints a temporary password; send it to Alice privately
pnpm admin reset-password alice       # forgotten password: issues a new temporary password
pnpm admin list-users                 # username, status, created date
# add --stage prod for production
```

On first sign-in the user must choose their own password, then complete their profile.

### Run / deploy the frontend (Vercel)

Server-only environment variables (nothing is exposed to the browser). Copy `.env.example` to
`apps/web/.env.local` locally, and set the same names in Vercel:

| Variable | Value |
|---|---|
| `API_URL` | `ApiUrl` stack output |
| `COGNITO_REGION` | AWS region of the Auth stack |
| `COGNITO_CLIENT_ID` | `UserPoolClientId` stack output |

1. Import the repo in Vercel and set **Root Directory** to `apps/web`.
2. Add the three variables above.
3. The API has no CORS configuration: only the Next.js server calls it, never the browser.

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

Suggested feature order: **001 user accounts → 002 workout tracker → 003 nutrition tracker →
004 global leaderboard → 005 streaks & nudges.**

## Deploying the web app (Amplify Hosting)

The Next.js app runs on AWS Amplify Hosting (SSR, `WEB_COMPUTE`), built by [amplify.yml](amplify.yml).

1. Amplify console → **Create new app → GitHub** → authorize → pick `TacticalHacker/calci`, branch `main`. Tick "My app is a monorepo" and enter `apps/web`.
2. Region `ap-south-1`. Under **Environment variables** add `API_URL`, `COGNITO_REGION=ap-south-1`, `COGNITO_CLIENT_ID` (values from the Api and Auth stack outputs) and `AMPLIFY_MONOREPO_APP_ROOT=apps/web`.
3. Deploy; sign in at the `*.amplifyapp.com` URL.
