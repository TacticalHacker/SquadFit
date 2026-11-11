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
| `infra/lib` | CDK stacks. Add a route with `route("<handler-file>", HttpMethod.X, "/path", { write })` in `api-stack.ts`. |

## Commands

```sh
pnpm dev            # Next.js on :3000
pnpm check          # typecheck + lint + test (all packages)
pnpm synth          # cdk synth for stage=dev
pnpm deploy:dev     # deploy Data + Api stacks to AWS (needs AWS creds)
```

## Conventions

- ESM everywhere; relative imports without extensions (bundler resolution).
- `@calci/shared` is consumed as TypeScript source (no build step).
- DynamoDB single table `pk`/`sk` + `gsi1pk`/`gsi1sk`; document key patterns in each feature's `data-model.md`.
- Never compute "today" in UTC; use the user's timezone (constitution §V).
