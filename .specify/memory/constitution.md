<!--
Sync Impact Report
- Version change: 2.6.0 → 2.7.0 (MINOR: principle VI allows squad-wide raid totals that include hidden members' volume, feature 021)
- Modified principles: VI. Members-Only Visibility (a squad raid total sums every member's counted volume, hidden members included, but no other member's own kg is shown and hidden members are never named)
- Templates requiring updates: none ✅
- Previous: 2.5.0 → 2.6.0 (MINOR: principle VI allows an opt-in body weight trend as kg change only, feature 017)
- Modified principles: VI. Members-Only Visibility (members who opt in to "Share my weight trend" appear on the squad weight chart as kg change since their first weigh-in in the period; never absolute weight)
- Templates requiring updates: none ✅
- Previous: 2.4.0 → 2.5.0 (MINOR: principle VI allows sharing daily steps under "Share my steps", feature 012)
- Modified principles: VI. Members-Only Visibility (steps, step goal, goal hits, step-run feed items; active calories and distance on the profile only; no ranking by active calories)
- Templates requiring updates: none ✅
- Previous: 2.3.0 → 2.4.0 (MINOR: principle VI allows opt-in nutrition sharing at two levels, feature 011)
- Modified principles: VI. Members-Only Visibility (a member may share daily nutrition totals, or totals plus meals; exact fields listed)
- Templates requiring updates: none ✅
- Previous: 2.2.0 → 2.3.0 (MINOR: principle VI allows a leaderboard opt-out and opt-in body weight ratio, feature 010)
- Modified principles: VI. Members-Only Visibility (members may hide from the leaderboard; body weight may be shared only as an opt-in relative-strength ratio)
- Templates requiring updates: none ✅
- Previous: 2.1.0 → 2.2.0 (MINOR: principle VI names the only two anonymous aggregate figures, feature 009)
- Modified principles: VI. Members-Only Visibility (public landing page may show lifter count and 7-day workout count)
- Templates requiring updates: none ✅
- Previous: 2.0.0 → 2.1.0 (MINOR: "Lean tests" rule added under principle III)
- Modified principles: III. Test-First Domain Logic now caps test volume (owner request, 2026-11-12)
- Templates requiring updates: none (tasks are generated from this file) ✅
- Previous: 1.0.0 → 2.0.0 (MAJOR: principle VI redefined)
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

**Lean tests.** Test only what can silently break money-like math or access: new pure domain
functions, and a handler's or tool's authorization and edit-window rules. Per behavior, write one
happy-path test plus the one or two rejections that matter, never a table of every invalid input.
Do not add tests for UI components, copy, styling, schema field limits, or code that only moves
existing logic; rely on the existing suite and the typechecker there. Update an existing test only
when the behavior it checks changed. `/speckit-tasks` MUST generate test tasks under this rule.

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
There are no groups yet: every user with a completed profile belongs to one global community (one
squad) and appears on its leaderboard unless they turn off "Show me on the squad leaderboard";
hidden members still see the board but are excluded from what others see. Squad data is keyed by a
squad id so further squads can be added later. Community data (names, avatars, scores, streaks, activity)
is visible only to signed-in users; anonymous requests get no user data. The single exception is
the public landing page, which MAY show exactly two community-wide counts: the number of members
with a completed profile and the number of workout entries logged in the last 7 days. Nothing
else (no names, weights, streaks, food or per-member figures) is served to anonymous requests. Each user's own data
(food entries, calorie target, body weight, credentials) is visible only to them unless a spec explicitly
publishes a derived figure; body weight may be shown to other members only as an e1RM ÷ body weight
ratio or as kg change since the member's first weigh-in in a chart period (never absolute weight), and only for
members who opted in ("Share my weight trend with the squad", default off) and are on the leaderboard. Food may be shown to other members only through a member's own
"Share my nutrition with the squad" setting (default off), enforced on the server, per day, computed when requested
so a change applies to past days at once, and never for a member hidden from the leaderboard. **Daily totals** exposes
exactly: calories in, protein, carbs, fat, calories burned in workouts (with whether it includes an AI adjustment),
and the member's protein and calorie targets. **Totals + meals** adds exactly: meal names, items with servings,
per-meal macros, photo captions and food photos (expiring links only). Nothing else about food, and no rank or sort
by calories in, calories burned or deficit. Daily activity synced from a health source may be shown to other members only
while the member is visible on the leaderboard and has "Share my steps" on (default on), enforced on the server per
request: exactly daily steps, the step goal, whether it was hit, and step-goal streak feed items; active calories and
distance may appear only on the member's own profile page, as information, and are never ranked, sorted or compared. A squad raid
(feature 021) may show the squad's summed workout volume, which includes the volume of members hidden from the leaderboard; other
members appear on a raid only by name and avatar (never hidden members, never anyone's own kg), and each member sees their own kg
only. Personal data is never written to logs. Passwords are stored only as
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

**Version**: 2.7.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-27
