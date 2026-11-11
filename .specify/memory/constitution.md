<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR: principle VI redefined)
- Modified principles: VI. Privacy Within the Squad → VI. Members-Only Visibility (no groups; one global community and leaderboard)
- Prior: template → 1.0.0
- Added principles: I. Spec-Driven Delivery; II. End-to-End Type Safety; III. Test-First Domain Logic;
  IV. Infrastructure as Code, Serverless by Default; V. Server-Authoritative, Fair Scoring;
  VI. Privacy Within the Squad; VII. Simplicity
- Added sections: Technology Constraints; Development Workflow & Quality Gates; Governance
- Templates requiring updates: none (plan-template "Constitution Check" reads this file) ✅
- Follow-up TODOs: none
-->

# SquadFit Constitution

## Core Principles

### I. Spec-Driven Delivery
Every feature goes through the Spec Kit flow: `/speckit-specify` → `/speckit-clarify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Product behavior comes from
`docs/prd.md` and the feature's `spec.md`; code that implements behavior absent from a spec
MUST NOT be merged. Every `[NEEDS CLARIFICATION]` marker MUST be resolved before `/speckit-plan`.

### II. End-to-End Type Safety
All code is TypeScript in `strict` mode. Every request and response crossing the network is
defined once as a zod schema in `packages/shared` and validated at both ends: the Lambda handler
parses input, and the web client parses output. `any` is forbidden outside generated code; use
`unknown` and narrow it.

### III. Test-First Domain Logic (NON-NEGOTIABLE)
Scoring, calorie aggregation, streak transitions, day-boundary and timezone math, and nudge
rate limiting are pure functions in `packages/shared/src/domain`. Each one gets failing Vitest
tests before it is implemented. Handlers stay thin: parse → call domain → persist → respond.
CDK stacks get assertion tests for every resource that holds data or controls access.

### IV. Infrastructure as Code, Serverless by Default
Every AWS resource is defined in `infra/` with CDK. Changes made in the console are drift and
MUST be reverted. The defaults are API Gateway HTTP API, Lambda on Node.js 24 / arm64, and
single-table DynamoDB on-demand. Adding a stateful or always-on service (RDS, ECS, ElastiCache)
needs a justification in the plan's Complexity Tracking table. IAM grants are least-privilege
and per function. Stages (`dev`, `prod`) are isolated stacks; prod data is retained and protected
from deletion.

### V. Server-Authoritative, Fair Scoring
The backend is the source of truth for scores, streaks, and leaderboard ranks; the client only
displays them. A "day" is computed in the user's IANA timezone, never server UTC. The scoring
formula MUST NOT reward overeating, and it MUST be documented in the spec together with
worked examples. Rate limits, such as one nudge per sender→receiver per day, are enforced
server-side and atomically.

### VI. Members-Only Visibility
There are no groups: every user with a completed profile belongs to one global community and
appears on the global leaderboard. Community data (names, avatars, scores, streaks, activity)
is visible only to signed-in users; anonymous requests get no user data. Each user's own data
(food entries, calorie target, credentials) is visible only to them unless a spec explicitly
publishes a derived figure. Personal data is never written to logs. Passwords are stored only as
slow salted hashes. Rate limits (sign-in attempts, nudges) are enforced server-side.

### VII. Simplicity
Build only what the current spec requires (YAGNI). Prefer platform primitives over libraries
and one package over several. Any deviation goes in the plan's Complexity Tracking table along
with the simpler option that was rejected.

## Technology Constraints

- **Monorepo:** pnpm workspaces, Node.js ≥ 24, TypeScript 6.0.
- **Frontend:** `apps/web`, Next.js 16 App Router + Tailwind CSS 4, deployed on Vercel (Root Directory `apps/web`).
- **Backend:** `services/api`, Lambda handlers bundled by CDK `NodejsFunction` (esbuild, ESM).
- **Shared:** `packages/shared`, zod contracts and pure domain logic, consumed as TS source.
- **Infra:** `infra`, AWS CDK v2, one app with `-c stage=dev|prod`.
- **Testing:** Vitest everywhere; `aws-cdk-lib/assertions` for infra.

## Development Workflow & Quality Gates

1. One feature per branch, created by `/speckit-specify` (`NNN-short-name`), with specs under `specs/NNN-short-name/`.
2. `pnpm check` (typecheck + lint + test) and `pnpm synth` MUST pass before merge; CI enforces both.
3. `/speckit-analyze` runs before `/speckit-implement` for any feature that touches scoring, streaks, or data access.
4. Every PR links its spec and states which constitution principles it touches.

## Governance

This constitution overrides other conventions in the repository. Amendments go through a PR
that updates this file, bumps the version (MAJOR: a principle is removed or redefined; MINOR: a
principle or section is added; PATCH: wording only), and propagates the change to
`.specify/templates/*`. Reviewers check plans against the "Constitution Check" gate. Runtime
guidance for agents lives in `CLAUDE.md`.

**Version**: 2.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
