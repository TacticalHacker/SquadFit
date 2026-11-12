# Implementation Plan: AI Coach v2

**Branch**: `007-ai-coach-v2` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-ai-coach-v2/spec.md`

## Summary

Give the member's AI agent full read access and safe write access, show its verdict in a compact Pulse Bar on the Workouts screens, and remove the built-in activity list.

Approach:
- **Domain first** (`packages/shared/src/domain`, test-first): body weight schema and default, `logId` format, overall-note limits, `dayGymVolume`, exercise lookup by name, `buildDayView` without built-ins and with `aiNote`.
- **One write path** (research R1): extract `saveGymEntry`, `createFoodEntry`, `patchFoodEntry` from the handlers into `services/api/src/lib`, used by both the HTTP handlers and the new MCP tools. That way the AI is held to exactly the member's rules, including the 3-day edit window.
- **Storage**: new attributes only: `PROFILE.bodyWeightKg`, `ENTRY#….aiNote`, v2 fields on `COACH#<date>` (R3, R5). No new GSI or item type. Burned totals stay derived on read, so AI calorie changes reach the strip, ledger and history with no extra writes.
- **MCP**: `get_full_context`, `update_workout_calories` (conditional on `updatedAt`, R4), `upsert_workout_log`, `upsert_food_log`, `post_overall_coach_note`; `get_user_history` gains ids and body weight; `post_daily_coach_note` retired.
- **API**: `GET /coach-note` returns `{ note, metrics }`; new `PUT /coach-note/{date}/actions/{index}`; profile gains body weight; views gain `aiNote`.
- **Web**: `PulseBar` on both Workouts tabs (inline card or the 006 `BottomSheet`), `AiBadge`, Settings field, Food coach block and `react-markdown` removed, Activities empty state.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24

**Primary Dependencies**: Existing: Next.js 16 (App Router, Cache Components, Server Actions), React 19, Tailwind 4, zod 4, `@modelcontextprotocol/sdk`, AWS SDK v3 `lib-dynamodb`, AWS CDK v2. **No new dependencies**; `react-markdown` is removed (R15).

**Storage**: DynamoDB single table: new attributes on `PROFILE`, `ENTRY#<date>#<id>` and `COACH#<date>` items ([data-model.md](data-model.md)).

**Testing**: Vitest (shared domain; API handlers and MCP tools with `services/api/test/fakes.ts` extended for `setAiAdjustment`, note v2 and action ticks; web pure helpers), `aws-cdk-lib/assertions` for the new route, manual [quickstart.md](quickstart.md).

**Target Platform**: Phone browsers first → Vercel → API Gateway HTTP API → Lambda arm64; MCP clients over Streamable HTTP.

**Project Type**: Web application (monorepo: `apps/web`, `services/api`, `packages/shared`, `infra`)

**Performance Goals**: The Workouts pages add one parallel request (`/coach-note`), so no extra latency step. `get_full_context` makes ≤ 3 parallel queries (workouts over max(window, 62 days), food over the window, plus notes) and responds in under 1.5 s for 31 days.

**Constraints**: Collapsed bar 48–56 px; no horizontal scroll at 375 px; 44 px tap targets; status is not shown by colour alone; AI writes only on `today−2…today`; never log notes, reasons, entries or body weight; `PublicMemberSchema` unchanged.

**Scale/Scope**: ~3 members; ≤ 31 days × (≤ ~30 workout + ~20 food entries) per context call; 1 note per member per day.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Spec-Driven | ✅ | Spec clarified (5 Qs, no markers). The plan adds nothing beyond FR-001..FR-026. |
| II. End-to-End Types | ✅ | New/changed zod schemas in `contracts/coach.ts`, `me.ts`, `workouts.ts`, `gym.ts`; MCP shapes are zod raw shapes; the web parses `CoachPulseResponseSchema`. |
| III. Test-First Domain | ✅ | Body weight, `logId`, note limits, `dayGymVolume`, `buildDayView` changes get failing tests first; handlers/tools stay thin over the shared write services; CDK assertion for the new route. |
| IV. IaC, Serverless | ✅ | One new `route()` (`coach-action-put`, write). MCP function grants unchanged (already table write). No new stateful resource. |
| V. Server-Authoritative | ✅ | Today, edit window, gym math, food math and metrics are all computed on the server. AI calorie overrides change only the entry's `calories`, which every total is derived from. No scoring formula is introduced; the leaderboard stays out until the scoring feature. |
| VI. Members-Only Visibility | ✅ | Tools act only as the key's member; foreign `logId`s read as not found; body weight is never public; no logging of notes, reasons, entries or weights. |
| VII. Simplicity | ✅ | Reuses the existing keys, `BottomSheet`, `currentStreak`, `buildFoodDay`, `validateHistoryWindow`; merges the overlapping tool (Q5); removes `react-markdown` and the built-in list. |

**Post-design re-check**: ✅ unchanged after research, data model and contracts. The one structural change, extracting write services from handlers, keeps handlers thinner and is required for SC-005.

## Project Structure

### Documentation (this feature)

```text
specs/007-ai-coach-v2/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/mcp.md, contracts/api.md, contracts/web.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── domain/profile.ts          # CHANGED BodyWeightSchema, DEFAULT_BODY_WEIGHT_KG, effectiveBodyWeight
├── domain/log-id.ts           # NEW formatLogId, parseLogId
├── domain/coach-note.ts       # CHANGED v2 limits, CoachStatus, AI_NOTE_MAX
├── domain/gym.ts              # CHANGED dayGymVolume, findGymExerciseByName; GymEntryView.aiNote
├── domain/day-view.ts         # CHANGED own workouts only, aiNote on entries, drop isStandard
├── domain/workouts.ts         # CHANGED remove STANDARD_WORKOUTS/findStandardWorkout; isNameTaken own-only
├── contracts/coach.ts         # CHANGED OverallNote, PulseMetrics, CoachPulseResponse, action tick body, new MCP shapes; markdown note schemas removed
├── contracts/me.ts            # CHANGED bodyWeightKg in input and own profile
├── contracts/workouts.ts, gym.ts  # CHANGED aiNote, isStandard removed
└── index.ts
packages/shared/test/          # profile, log-id, coach-note, gym, day-view, contracts tests

services/api/src/
├── lib/gym-save.ts            # NEW saveGymEntry (from gym-entry-put)
├── lib/food-write.ts          # NEW createFoodEntry, patchFoodEntry (from food-entry-post/put)
├── lib/workout-repo.ts        # CHANGED aiNote in toEntry; setAiAdjustment (conditional); updateEntryMinutes REMOVE aiNote
├── lib/coach-repo.ts          # CHANGED v2 put/get, setActionDone (conditional)
├── lib/profile-repo.ts        # CHANGED bodyWeightKg in upsert/fromItem
├── lib/views.ts               # CHANGED own profile bodyWeightKg
├── lib/mcp/history.ts         # NEW buildHistoryDays shared by history + full context
├── lib/mcp/tools.ts           # CHANGED history ids/body weight; full context; retired markdown tool
├── lib/mcp/writes.ts          # NEW update_workout_calories, upsert_workout_log, upsert_food_log, post_overall_coach_note
├── lib/mcp/types.ts           # CHANGED ToolContext.bodyWeight
├── handlers/mcp.ts            # CHANGED pass body weight into context
├── handlers/gym-entry-put.ts, food-entry-post.ts, food-entry-put.ts  # CHANGED thin wrappers over services
├── handlers/entry-put.ts      # CHANGED no std-* creation
├── handlers/custom-post.ts, custom-put.ts  # CHANGED name check own-only (via isNameTaken)
├── handlers/coach-note-get.ts # CHANGED { note, metrics }
└── handlers/coach-action-put.ts  # NEW
services/api/test/             # fakes + tests for all of the above

infra/lib/api-stack.ts         # CHANGED + coach-action-put route; infra/test assertion

apps/web/src/
├── components/pulse-bar.tsx   # NEW
├── components/ai-badge.tsx    # NEW
├── server/actions/coach.ts    # NEW setCoachAction
├── app/(app)/workouts/gym/page.tsx, workouts/page.tsx  # CHANGED fetch pulse, render PulseBar
├── components/gym-screen.tsx / exercise-list.tsx       # CHANGED AiBadge on logged rows
├── components/workout-checklist.tsx                     # CHANGED no quick picks/hint, empty state, AiBadge
├── lib/workout-style.ts       # CHANGED drop std-* map and QUICK_PICK_IDS
├── app/(app)/food/page.tsx    # CHANGED no coach note
├── components/coach-card.tsx, lib/coach-markdown.ts(+test)  # DELETED
├── app/(app)/settings/page.tsx (+ profile form, server action)  # CHANGED body weight field
└── package.json               # CHANGED remove react-markdown

CLAUDE.md                      # CHANGED feature 007 section; feature 004 note-rendering line updated
```

**Structure Decision**: Extend the existing monorepo packages in the established order: domain → contracts → repos/services → handlers/tools → routes → web. New MCP write tools go in their own module (`lib/mcp/writes.ts`) beside `photos.ts`, so `tools.ts` stays readable.

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| Extracting write services out of three handlers (R1) | AI writes must be rejected wherever the member's are (FR-007, SC-005) | Duplicating validation in the tools would drift from the handlers; calling the HTTP API from MCP needs a member token the key model doesn't have |
| Conditional `updatedAt` write for AI calorie updates (R4) | FR-014: an agent working from stale data must not overwrite a newer member edit | Unconditional write could silently restore AI calories over a member's just-saved sets |
