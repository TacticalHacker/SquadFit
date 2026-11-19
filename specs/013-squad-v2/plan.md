# Implementation Plan: Squad v2 (Simpler Leaderboard)

**Branch**: `013-squad-v2` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-squad-v2/spec.md`

## Summary

Mostly a restructure. `buildMemberStats` gains per-month workout days and total weight lifted, per-lift monthly best
estimated max, and club badges with their earned date (badge feed events ride the existing feed diff, so they post once).
A new pure board registry (`domain/boards.ts`) ranks seven boards from those stats plus the month's steps and protein,
and a Hall of Fame builder derives all-time records. Two new read endpoints (`GET /squad/boards`, `GET /squad/hall-of-fame`)
replace `GET /squad/leaderboard`. Reactions (🔥 💪 👑) replace high-fives with the same transactional item pattern, and
an operator migration converts high-fives to 💪. A `targetsConfirmedAt` profile flag hides unconfirmed targets from
others inside the one nutrition choke point. The web `/squad` page is rebuilt as feed → one segmented control → board
cards, with full lists, the full feed and Today's workouts on their own pages. All wording comes from one phrases file.

## Technical Context

**Language/Version**: TypeScript 6 (ESM, strict), Node.js 24 Lambdas (arm64), Next.js 16 App Router, Tailwind 4

**Primary Dependencies**: zod 4, AWS SDK v3 (DynamoDB document client), `lucide-react` (existing; nothing new)

**Storage**: Existing DynamoDB single table; one new item type (`SQUAD#global/SETTINGS`), reactions replace high-fives, SQUADSTATS and profile gain attributes; no new index

**Testing**: Vitest; domain tests in `packages/shared/test`, handler tests with in-memory fakes in `services/api/test`; lean (constitution III)

**Target Platform**: API Gateway HTTP API + Lambda; Amplify-hosted Next.js

**Project Type**: Web application monorepo (`apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: `GET /squad/boards` in < 1 s for 30 members (one BatchGet of stats + ≤ 2 month Queries per sharing member); Hall of Fame < 1.5 s

**Constraints**: Months bucket by entry local date, current month from the squad timezone; ranks are server-side; no new logs of personal data

**Scale/Scope**: A friend squad (tens of members); 7 boards, 10 records, 5 badges

## Constitution Check

| Principle | Status |
|---|---|
| I Spec-driven | Pass: spec 013, Spec Kit flow |
| II Type safety | Pass: new strict schemas in `contracts/squad-boards.ts`; changed feed/day-card/me schemas stay strict |
| III Test-first, lean | Pass: board ranking, PR jump, Big 3, months, badges test-first in `packages/shared`; handler tests only for privacy, reactions and migration |
| IV IaC, serverless | Pass: four new Lambdas via `route()`, three removed; least privilege (reaction routes `write`, read routes read-only) |
| V Server-authoritative | Pass: all ranks (incl. % and Big 4 alternates) computed on the server; days stay in each member's timezone; the squad month is one shared server-side instant; nothing rewards eating more |
| VI Members-only visibility | Pass, no amendment: boards, records and badges are derived from lifts, workout days, steps and protein hits that VI already allows members to see; steps and protein keep their existing gates; unconfirmed targets are withheld (stricter); no body weight (relative strength is feature 014, which will amend VI) |
| VII Simplicity | Pass: one boards endpoint returns full lists for card and list pages; registry is a const array + functions; no new library. Complexity Tracking empty |

Re-check after design: still passes.

## Project Structure

### Documentation (this feature)

```text
specs/013-squad-v2/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md            # /speckit-tasks
```

### Source Code

```text
packages/shared/src/
├── domain/squad.ts            # + months, monthBests, badges, badge events, gainKg; − buildBoards, consistency, weekVolumeKg, dayVolumeKg
├── domain/boards.ts           # NEW: BOARD_DEFS, rank functions, buildSquadBoards, buildHallOfFame, CLUBS, clubOf, monthDates
├── domain/nutrition-share.ts  # (unchanged API; callers null targets before calling)
├── contracts/squad-boards.ts  # NEW: SquadBoardsSchema, HallOfFameSchema, ReactionsSchema, ClubSchema
├── contracts/squad.ts         # feed item: reactions, canReact, badge kind, gainKg; − leaderboard schemas, PeriodSchema
├── contracts/squad-profile.ts # day cards: reactions/canReact; member profile: badges; − SquadLeaderboardFullSchema
└── contracts/me.ts            # targetsConfirmed, targetsPromptDismissed, TargetsInputSchema
packages/shared/test/          # boards.test.ts (new), squad.test.ts (extend)

services/api/src/
├── handlers/squad-boards-get.ts        # NEW
├── handlers/squad-hall-of-fame-get.ts  # NEW
├── handlers/squad-reaction-put.ts      # NEW
├── handlers/squad-reaction-delete.ts   # NEW
├── handlers/me-targets-put.ts          # NEW
├── handlers/squad-feed-get.ts          # reactions, badge, limit
├── handlers/squad-member-*.ts, squad-today-get.ts  # reactions; badges on member
├── handlers/squad-leaderboard-get.ts, squad-hi5-*.ts  # DELETED
├── lib/reaction.ts            # NEW (replaces high-five.ts)
├── lib/squad-repo.ts          # reactions, squad settings, migration helpers; − high-five methods
├── lib/member-view.ts         # nutritionOn(owner, viewerId, …) nulls unconfirmed targets; reactions on cards
├── lib/protein-events.ts      # skip unconfirmed members
├── lib/profile-repo.ts        # targetsConfirmedAt, targetsPromptDismissed
└── lib/squad-members.ts       # NEW: shared loader (visible profiles + stats + avatars + month dates) for boards and Hall of Fame
services/api/test/             # squad-boards.test.ts, squad-reactions.test.ts; fakes.ts updated; old leaderboard/hi5 tests replaced

infra/lib/api-stack.ts         # routes added/removed
infra/scripts/admin.ts         # squad timezone | migrate-reactions

apps/web/src/
├── lib/plain.ts                         # NEW: all phrases and formatters
├── components/info-tip.tsx              # NEW: (i) → one sentence (BottomSheet on phones)
├── components/board-card.tsx            # NEW: top 3 + you
├── components/board-list.tsx            # NEW: full ranked list (+ kg|% and Big 3|4 links)
├── components/hall-of-fame.tsx          # NEW
├── components/reactions.tsx             # NEW (replaces high-five-button.tsx)
├── components/club-badge.tsx            # NEW
├── components/targets-prompt.tsx        # NEW
├── components/squad-feed.tsx, day-card.tsx, timeline.tsx, today-workouts.tsx, member-profile.tsx, nutrition-view.tsx  # wording + reactions
├── components/squad-boards.tsx, board-row.tsx  # DELETED/replaced
├── app/(app)/squad/page.tsx             # feed + segmented control + cards | Hall of Fame
├── app/(app)/squad/boards/[board]/page.tsx  # NEW
├── app/(app)/squad/feed/page.tsx        # NEW
├── app/(app)/squad/today/page.tsx       # NEW (moved Today's workouts + day picker)
├── app/(app)/food/…                     # targets prompt
├── app/(app)/settings/…                 # "Not confirmed yet" note; hide body-weight-ratio switch until 014
└── server/actions/squad.ts, me.ts       # toggleReaction, saveTargets, dismissTargetsPrompt
```

**Structure Decision**: Existing monorepo layout; one new domain module, one new contracts module, five new handlers.

## Rollout

1. Deploy API + web together (the web only calls the new endpoints).
2. `pnpm admin squad migrate-reactions` immediately (high-fives read as 0 until it runs).
3. `pnpm admin squad backfill` (fills months, month bests and badges; seeds badge events so the launch posts nothing).
4. Update CLAUDE.md with a "Squad v2 (feature 013)" section.

## Complexity Tracking

None.
