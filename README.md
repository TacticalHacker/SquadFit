# SquadFit (Tactical Calories)

Social fitness & nutrition tracker for friend groups: check off workouts, log meals, compete on
a global leaderboard, keep streaks alive, and nudge friends who slack off.

- **Product requirements:** [docs/prd.md](docs/prd.md)
- **Engineering principles:** [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Stack

```
apps/web           Next.js 16 (App Router, Tailwind 4)   → AWS Amplify Hosting
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
pnpm admin ai-key issue alice         # AI client key (shown once) + Cursor/Claude snippets; issuing again rotates it
pnpm admin ai-key revoke alice        # the key stops working immediately
pnpm admin ai-key list                # who has a key (never shows secrets)
# add --stage prod for production
```

On first sign-in the user must choose their own password, then complete their profile.

### Run the frontend locally

Server-only environment variables (nothing is exposed to the browser). Copy `.env.example` to
`apps/web/.env.local`; the same names are set in Amplify (see below):

| Variable | Value |
|---|---|
| `API_URL` | `ApiUrl` stack output |
| `COGNITO_REGION` | AWS region of the Auth stack |
| `COGNITO_CLIENT_ID` | `UserPoolClientId` stack output |

The API has no CORS configuration: only the Next.js server calls it, never the browser.

## Connect your AI agent (MCP)

SquadFit runs an MCP server, so your own AI assistant can read your logs, fix entries, set targets
and post your daily coach note (the Pulse Bar on Workouts). It acts only as you and only edits
today and the 2 previous days.

**1. Get your key.** Ask the operator to run `pnpm admin ai-key issue <your-username>`. You get an
`sfk_...` key once; keep it like a password. One key per member: issuing again replaces it, so
every client using the old key must be updated.

**2. Connect a client.** `<ApiUrl>` is the Api stack output (e.g.
`https://xxxx.execute-api.ap-south-1.amazonaws.com`). There are two ways to pass the key:

| Client | Server URL | Key |
|---|---|---|
| Claude Code, Cursor, anything that can send headers | `<ApiUrl>/mcp` | Header `Authorization: Bearer sfk_...` |
| ChatGPT, claude.ai, anything that can't | `<ApiUrl>/mcp/sfk_...` | In the URL, no auth |

### Claude Code

```sh
claude mcp add --transport http squadfit <ApiUrl>/mcp --header "Authorization: Bearer sfk_..."
```

Then in Claude: *"Use squadfit: get my full context and post today's coach note."*

### Claude (web / desktop app)

Settings → **Connectors** → **Add custom connector** → Name `SquadFit`, URL `<ApiUrl>/mcp/sfk_...`,
leave the OAuth fields empty.

### ChatGPT

Use **chatgpt.com in a browser** (paid plan; the phone app can't add servers).

1. **Plugins** → **+** → **Add custom MCP server** (on older layouts: Settings → Apps → Advanced
   settings → turn on **Developer mode** → **Create**).
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `SquadFit` |
   | MCP Server URL | `<ApiUrl>/mcp/sfk_...` |
   | Authentication | **No authentication** |
   | I trust this application | ticked |

3. In a chat, enable SquadFit and ask: *"Call get_full_context from squadfit."*

### Cursor (`~/.cursor/mcp.json`)

```json
{ "mcpServers": { "squadfit": { "url": "<ApiUrl>/mcp", "headers": { "Authorization": "Bearer sfk_..." } } } }
```

### Check the connection

```sh
curl -s -X POST <ApiUrl>/mcp/sfk_... \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A tool list means it works; `Invalid or missing access key` means a wrong or rotated key.

**What the agent can do:** `get_full_context`, `get_user_history`, `upsert_workout_log`,
`upsert_food_log`, `update_workout_calories`, `post_overall_coach_note`, `update_user_targets`, and
estimate photo meals (`list_pending_food_photos`, `get_food_photo`, `submit_food_estimate`).
Limit: 60 requests a minute per member, shared across all your clients.

**Turn it into a coach:** paste [docs/ai-coach-instructions.md](docs/ai-coach-instructions.md) into a
Claude or ChatGPT Project's instructions, then say "daily review". It estimates photo meals, fixes
gym calories for your body weight, and posts your coach note.

**Lost or leaked key?** The operator runs `pnpm admin ai-key revoke <user>` (stops it now) or
`ai-key issue` (new key), then you update each client.

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
2. Region `ap-south-1`. Under **Environment variables** add `API_URL`, `COGNITO_REGION=ap-south-1`, `COGNITO_CLIENT_ID` (values from the Api and Auth stack outputs, see the table above) and `AMPLIFY_MONOREPO_APP_ROOT=apps/web`.
3. Deploy; sign in at the `*.amplifyapp.com` URL.
