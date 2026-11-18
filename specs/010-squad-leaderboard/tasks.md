---
description: "Task list for 010-squad-leaderboard"
---

# Tasks: Squad Leaderboard

**Input**: Design documents from `specs/010-squad-leaderboard/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md)

**Tests**: Required by the spec (SC-003) and constitution III, under the **lean tests** rule: one happy path plus the one or two rejections that matter per behaviour; no UI, copy or schema-limit tests. Domain tests are written first and must fail before implementation.

**Organization**: Grouped by user story (US1–US7 from spec.md). Paths are repo-relative. Before writing Next.js code, read the relevant parts of `apps/web/node_modules/next/dist/docs/` (apps/web/AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US7 from spec.md

---

## Phase 1: Setup

- [X] T001 Read `apps/web/node_modules/next/dist/docs/` on `searchParams` in Server Components, Server Actions with `useOptimistic`, and Suspense under Cache Components (scratch note only, no repo file).

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: week math, the stats rebuild (research R1–R6, R13), squad settings storage, the repo, and the hooks that keep stats fresh after every workout write (HTTP and MCP).

### Tests first (must fail before implementation)

- [X] T002 [P] Write `packages/shared/test/week.test.ts`: `weekStart("2026-11-18")` (Wed) → `"2026-11-16"`; `weekStart` of a Monday is itself and of a Sunday is the previous Monday; timezone boundary: `weekStart(localDate(new Date("2026-11-15T23:30:00Z"), "Asia/Kolkata"))` → `"2026-11-16"` while the same instant in `"Europe/London"` → `"2026-11-09"`.
- [X] T003 [P] Write `packages/shared/test/squad.test.ts` (streak part) using small entry fixtures: target 3; three hit weeks then the current week with 1 day → `streakFigures` current 3, week `{days:1,target:3}` (in-progress week does not break it); a missed ended week between runs → current counts only the latest run, best keeps the longer one; two entries on one day count as one workout day; an ended week keeps its stored target when the profile target changes (stored 3, now 4, 3 days → still hit).

### Implementation

- [X] T004 [P] Create `packages/shared/src/domain/week.ts`: `weekStart(date)` (Monday on/before, string math with `addDays`; derive weekday via `Date.UTC`), `isWeekEnded(weekStart, today)` (`addDays(weekStart, 6) < today`); export from `packages/shared/src/index.ts`. Make T002 pass.
- [X] T005 Create `packages/shared/src/domain/squad.ts` (part 1): constants `SQUAD_ID = "global"`, `DEFAULT_WEEKLY_TARGET = 3`; types `SquadStats` exactly as in data-model.md; `isWorkoutDay` rule (gym strength with ≥ 1 completed set, gym cardio, or any non-gym entry); `buildMemberStats(entries, prev, { weeklyTarget, today, nowIso, trustedBefore?, seed? })` returning `{ stats, events }` with `weeks` (only weeks with ≥ 1 day; ended weeks already in `prev.weeks` keep their `target`, others use `weeklyTarget`), `firstWorkoutDate`, `dayVolumeKg` (last 14 days, working sets only); `streakFigures(stats.weeks, today, weeklyTarget)` → `{ current, best, weekDays, target }` per data-model "Read-time figures". Export from `packages/shared/src/index.ts`. Make T003 pass.
- [X] T006 [P] Create `packages/shared/src/contracts/squad.ts` with `SquadSettingsSchema` (`weeklyTarget` int 1–7, `leaderboardVisible` bool, `shareBodyWeight` bool; strict), `SquadMemberSchema`, `PeriodSchema` (`"week" | "30d" | "all"`), `RankSchema`, `WeeklyStreakSchema` (`{ current, best, weekDays, target }`), `SquadLeaderboardSchema`, `SquadFeedSchema`, `HighFiveResultSchema`, `JumpConfirmSchema` (`{ updatedAt: z.iso.datetime() }` strict) exactly as in contracts/api.md; export from `packages/shared/src/index.ts`.
- [X] T007 [P] Extend `packages/shared/src/contracts/me.ts`: `OwnProfileSchema` gains `squad: SquadSettingsSchema.default({ weeklyTarget: 3, leaderboardVisible: true, shareBodyWeight: false })`.
- [X] T008 Extend `services/api/src/lib/profile-repo.ts`: `ProfileItem` gains optional `weeklyTarget`, `leaderboardVisible`, `shareBodyWeight` (read in `fromItem`); new `setSquadSettings(userId, settings, nowIso)` (one `UpdateItem`, `attribute_exists(pk)`, returns the item or null); helper `squadSettingsOf(profile)` applying defaults 3 / true / false. Mirror in `InMemoryProfileRepo` in `services/api/test/fakes.ts`.
- [X] T009 Create `services/api/src/lib/squad-repo.ts` (`SquadRepo` + `DynamoSquadRepo`): `getStats(userId)`, `putStats(userId, stats, expectedVersion | null)` → `"ok" | "conflict"` (condition `version = :v` or `attribute_not_exists(sk)`), `batchGetStats(userIds)` (chunks of 100), `listMemberFeed(userId)` (`begins_with(sk,"FEED#")`), `putFeed(userId, item)`, `deleteFeed(userId, eventId)` (also deletes `HI5#<eventId>#*` via Query + BatchWrite), `listSquadFeed(squadId, pageSize, startKey?)` (gsi1 `SQUADFEED#<squadId>`, `ScanIndexForward: false`), `addHighFive`/`removeHighFive(authorId, eventId, reactorId)` (TransactWrite per research R7; treat `TransactionCanceledException` with `ConditionalCheckFailed` as no-op, return current count), `getHighFiveCount`, `batchGetMyHighFives(viewerId, keys)`. Keys exactly as data-model.md. Add `squad: SquadRepo` to `services/api/src/lib/deps.ts` and an `InMemorySquadRepo` to `services/api/test/fakes.ts`.
- [X] T010 Extend `services/api/src/lib/workout-repo.ts` `toEntry` to carry `jumpConfirmedAt` when present, and add `confirmJump(userId, date, workoutId, expectedUpdatedAt, nowIso)` → `"ok" | "missing" | "conflict"` (`SET jumpConfirmedAt = :now`, condition `attribute_exists(pk) AND updatedAt = :seen`; does not change `updatedAt`). Add `jumpConfirmedAt?: string` to `StoredEntry` in `packages/shared` where the entry type lives. Mirror in the fake. Never copy `jumpConfirmedAt` when `saveGymEntry` builds an entry (a full save must drop it).
- [X] T011 Create `services/api/src/lib/squad-stats.ts`: `refreshSquadStats(userId, deps, { seed?: boolean } = {})`: load profile (skip if none), today via `localDate(deps.now(), profile.timezone)`, all entries (`listEntriesInRange(userId, "0000-01-01", today)`), previous stats; call `buildMemberStats`; when `seed`, set `trustedBefore = nowIso` and `seededEventIds = prev.seededEventIds ∪ (derived ids − existing feed ids)` and write no feed; otherwise diff derived events (minus `seededEventIds`) against `listMemberFeed`: put new (createdAt now, `hi5Count` 0, gsi keys per data-model), update changed payloads keeping `createdAt`/`hi5Count`, `deleteFeed` the rest. Versioned `putStats` with one retry on conflict (R13). Export `safeRefresh(userId, deps)` that catches, logs only `"squad-stats refresh failed"` + error name, and never throws (R2).
- [X] T012 Call `safeRefresh` after the successful write in `services/api/src/lib/gym-save.ts` (covers HTTP gym PUT and MCP `upsert_workout_log`), `services/api/src/handlers/entry-put.ts`, `services/api/src/handlers/entry-delete.ts`, `services/api/src/handlers/gym-entry-delete.ts` (research R2 table).
- [X] T013 Add a server-side visibility helper in `services/api/src/lib/squad-view.ts`: `squadMember(profile, viewerId, avatarUrl)` → `SquadMemberSchema` object (only userId, displayName, avatarUrl, isYou) and `visibleTo(profile, viewerId)` (`leaderboardVisible !== false || userId === viewerId`).

**Checkpoint**: `pnpm check` passes; saving any workout writes a `SQUADSTATS` item.

---

## Phase 3: User Story 7 - Control my visibility and target (Priority: P1)

**Goal**: Settings for weekly target, leaderboard visibility and body weight sharing (FR-003, FR-004, FR-006).

**Independent Test**: Change the three settings, reload Settings: saved; target change shows in the current week's "d/t".

- [X] T014 [US7] Create `services/api/src/handlers/me-squad-put.ts`: `requireProfile`, parse `SquadSettingsSchema`, `profiles.setSquadSettings`, `safeRefresh`, return the settings. Add `route("me-squad-put", HttpMethod.PUT, "/me/squad", { write: true })` in `infra/lib/api-stack.ts`.
- [X] T015 [US7] Return `squad: squadSettingsOf(profile)` in `services/api/src/handlers/me-get.ts` (and wherever `OwnProfile` is built in `services/api/src/lib/views.ts`).
- [X] T016 [P] [US7] Create `apps/web/src/server/actions/squad.ts` with `saveSquadSettings(prev, formData)` (parse with `SquadSettingsSchema`, `apiFetch` `PUT /me/squad`, `revalidatePath`/refresh as the profile action does).
- [X] T017 [US7] Create `apps/web/src/components/squad-settings-form.tsx` (weekly target `Stepper` 1–7; two toggles with help text from contracts/web.md; share toggle disabled with a note when `bodyWeightKg` is null) and add a "Squad" section to `apps/web/src/app/(app)/settings/page.tsx`.

**Checkpoint**: Settings round-trip works.

---

## Phase 4: User Story 1 - Weekly streak board (Priority: P1) 🎯 MVP

**Goal**: `/squad` page with the Streaks board, period toggle shell, nav item; weekly streak on Workouts screens and in MCP (FR-001, FR-002, FR-009–FR-011, FR-023–FR-026, FR-032).

**Independent Test**: quickstart §3 and §5.1.

### Tests first

- [X] T018 [P] [US1] Write `packages/shared/test/squad.test.ts` (ranking part): `rankRows` with keys `[current, best]` on rows (3,5),(3,5),(2,9) → ranks 1,1,3; equal rows ordered by display name.
- [X] T019 [P] [US1] Write `services/api/test/squad-leaderboard.test.ts`: (a) caller without a profile → 409 `PROFILE_REQUIRED` (the codebase's existing convention); (b) member B with `leaderboardVisible: false` is absent from A's `streaks`, while B's own response contains B with `rank: null` and `viewerHidden: true`; a member with no `SQUADSTATS` item still appears with current streak 0; (c) serialized response contains no `bodyWeightKg`, `timezone`, `username` or `dailyCalorieTarget` substrings.

### Implementation

- [X] T020 [US1] Add `rankRows(rows, keyFns, nameOf)` (descending keys, tie → same rank, competition ranking, then display name) and `buildBoards(input)` skeleton producing `streaks` rows (current, best, week) to `packages/shared/src/domain/squad.ts`; hidden viewer appended with `rank: null`. Make T018 pass.
- [X] T021 [US1] Create `services/api/src/handlers/squad-leaderboard-get.ts`: `requireProfile`, parse `period` (default `week`) and `exercise`; `listCommunity`, filter `visibleTo`, `batchGetStats`, per-member today from their timezone, signed avatar URLs as `people-get.ts` does, a missing stats item treated as empty stats (member shows 0 / "—"), each member's join date as `localDate(createdAt, timezone)` for consistency (FR-018), `buildBoards`, respond `SquadLeaderboardSchema`. Route `route("squad-leaderboard-get", HttpMethod.GET, "/squad/leaderboard", { avatars: "read" })`. Make T019 (a, b-streaks, c) pass.
- [X] T022 [US1] Add `weeklyStreak` (from `squad.getStats` + `streakFigures`, null if no stats) to `services/api/src/handlers/workouts-summary-get.ts` and `WeeklyStreakSchema.nullable().default(null)` to the summary response schema in `packages/shared/src/contracts/workouts.ts`.
- [X] T023 [US1] In `services/api/src/lib/mcp/tools.ts` `get_full_context`, replace the daily `currentStreak` with the weekly object (or null) and update the tool description; drop the 62-day streak lookback if the window no longer needs it. Update the expectation in `services/api/test/mcp-full-context.test.ts` only where it asserts the streak.
- [X] T024 [US1] Remove `currentStreak` from `packages/shared/src/domain/streak.ts` (keep `DAILY_GOAL_MINUTES`, `goalProgress`) and its test cases; change `apps/web/src/components/day-nav.tsx` `streak` prop to `{ current, weekDays, target }` rendering "{n}-week streak · d/t" / "No streak yet · d/t"; update `apps/web/src/app/(app)/workouts/page.tsx` and `apps/web/src/app/(app)/workouts/gym/page.tsx` to read `weeklyStreak` from the summary and drop the 62-day streak request.
- [X] T025 [P] [US1] Create `apps/web/src/components/board-row.tsx` (rank or "—", `Avatar` with initials, truncating name, large `tabular-nums` main figure, muted secondary, optional progress bar, `isYou` → `bg-accent-soft`).
- [X] T026 [US1] Create `apps/web/src/components/squad-boards.tsx` (server component: tabs, period toggle and the lift exercise picker are plain links/GET form with `?board=&period=&exercise=&rel=`, so no client state; PR rows expand with native `<details>`).
- [X] T027 [US1] Create `apps/web/src/app/(app)/squad/page.tsx`: Server Component reading `searchParams`, period segment links, hidden notice, `<Suspense>` with skeleton, fetch leaderboard via `apiFetch` and parse with `SquadLeaderboardSchema`; add **Squad** (`Trophy`) to `apps/web/src/components/nav-links.tsx` between Food and People.

**Checkpoint**: MVP: Streaks board works end to end, privacy respected.

---

## Phase 5: User Story 2 - Personal records (Priority: P1)

**Goal**: PR detection and the PRs board (FR-012–FR-015, FR-017).

**Independent Test**: quickstart §4.1–4.2, §4.4.

### Tests first

- [X] T028 [P] [US2] Extend `packages/shared/test/squad.test.ts`: `e1rm(100, 10)` → 133.3, `e1rm(100, 11)` → null; first-ever day of an exercise → no PR; a later heavier completed set → one PR on that day; a later set with lower weight but higher e1RM → PR; non-completed and 0 kg sets ignored; an 11-rep set can set a heaviest-weight PR.

### Implementation

- [X] T029 [US2] In `packages/shared/src/domain/squad.ts` add `e1rm(weightKg, reps)` (`reps <= 10 ? round1(w * (1 + reps/30)) : null`), working-set filter (`completed && reps >= 1 && weightKg > 0`), per-exercise date-ordered walk producing `lifts[exerciseId]` (`name`, `builtIn` = id starts with `gx-`, `best`, `bestE1rm`, `prDays`, `dayBests` last 31 days) and `pr#<exerciseId>#<date>` events; at most one PR per exercise per day. Make T028 pass.
- [X] T030 [US2] Add the `prs` board to `buildBoards`: per member, `prDays` within the period (week = `weekStart(today)..today`, 30d = `today−29..today`, all) using each member's own today; rank by count; members with 0 omitted; `lifts` list newest first.
- [X] T031 [US2] Add the PRs tab to `apps/web/src/components/squad-boards.tsx`: rows expand (button with `aria-expanded`) to list lifts "Exercise · w kg × r · e1RM e kg · date"; empty state per period.

**Checkpoint**: PRs counted and shown per period.

---

## Phase 6: User Story 3 - Suspicious jumps (Priority: P2)

**Goal**: Jump rule, flags in the gym drawer, "Looks right" (FR-016, clarifications).

**Independent Test**: quickstart §4.3.

### Tests first

- [X] T032 [P] [US3] Extend `packages/shared/test/squad.test.ts`: best 80 → set 125 × 1 is flagged, gives no PR and is excluded from bests; best 20 → 32.5 × 5 is not flagged and is a PR; the same 125 set with `jumpConfirmedAt` counts as a PR; the same set with `updatedAt` before `trustedBefore` counts and is not flagged.
- [X] T033 [P] [US3] Add to `services/api/test/gym-entry.test.ts`: confirm with a stale `updatedAt` → 409; confirm on another member's entry id → 404.

### Implementation

- [X] T034 [US3] Implement the jump rule in `packages/shared/src/domain/squad.ts` (`x > prev * 1.5 && x - prev > 20` for weight or e1RM; skip when no previous best, when the entry has `jumpConfirmedAt`, or when `updatedAt < trustedBefore`); collect `flags`. Make T032 pass.
- [X] T035 [US3] Create `services/api/src/handlers/gym-entry-confirm-put.ts` (parse `JumpConfirmSchema`, `workouts.confirmJump`, map missing → 404, conflict → 409 `fields: { _: "This entry changed; refresh" }`, then `safeRefresh`); route `route("gym-entry-confirm-put", HttpMethod.PUT, "/workouts/gym/entries/{date}/{exerciseId}/confirm", { write: true })`. Make T033 pass.
- [X] T036 [US3] Add `jumpFlag: z.boolean().default(false)` to `GymEntryViewSchema` in `packages/shared/src/contracts/gym.ts` and set it in `services/api/src/handlers/gym-get.ts` (or `lib/gym-view-loader.ts`) from the member's stats `flags`.
- [X] T037 [US3] Add `confirmJump(date, exerciseId, updatedAt)` to `apps/web/src/server/actions/squad.ts` and the "Unusual jump" notice with a **Looks right** secondary button to `apps/web/src/components/gym-drawer.tsx` (`noticeWarnClass`, `AlertTriangle`), refreshing on success.

**Checkpoint**: Flagged sets excluded until confirmed.

---

## Phase 7: User Story 4 - Activity feed and high-fives (Priority: P2)

**Goal**: Feed of 20 items with toggleable high-fives (FR-027–FR-029).

**Independent Test**: quickstart §6 and the feed checks in §3–§4.

### Tests first

- [X] T038 [P] [US4] Extend `packages/shared/test/squad.test.ts`: events — first workout → `first`; a week reaching its target → `wk#<weekStart>` with `n` equal to its position in the run; rebuilding from the same entries yields the same event ids; events in `seededEventIds` are not returned.
- [X] T039 [P] [US4] Add to `services/api/test/squad-leaderboard.test.ts`: a hidden member's feed items are absent from another member's `GET /squad/feed`; high-five PUT twice → count 1; DELETE → 0; a feed item whose PR is edited away (entry re-saved lighter) disappears from `GET /squad/feed`.

### Implementation

- [X] T040 [US4] Emit `first` and `wk#<weekStart>` events (payload `{ week: n }`) from `buildMemberStats`; filter `seededEventIds`. Make T038 pass.
- [X] T041 [US4] Create `services/api/src/handlers/squad-feed-get.ts` (page `listSquadFeed` 50 at a time, drop items of members not `visibleTo` the viewer, stop at 20; join profiles for `SquadMemberSchema`; `batchGetMyHighFives`; id `"<authorUserId>~<eventId>"`), `squad-hi5-put.ts` and `squad-hi5-delete.ts` (parse id, 404 if missing or author hidden and not the caller). Routes per contracts/api.md. Make T039 pass.
- [X] T042 [US4] Create `apps/web/src/components/squad-feed.tsx` (sentences from contracts/web.md, relative date, `Hand` button with count, `aria-pressed`, `useOptimistic` + `toggleHighFive(id, on)` action in `apps/web/src/server/actions/squad.ts`, revert on error; empty state) and render it below the boards in `apps/web/src/app/(app)/squad/page.tsx` (fetched in parallel, parsed with `SquadFeedSchema`).

**Checkpoint**: Feed and reactions work; edits retract items.

---

## Phase 8: User Story 5 - Consistency board (Priority: P3)

**Goal**: Consistency % and weekly volume (FR-018–FR-020).

**Independent Test**: quickstart (Story 5 independent test in spec.md).

- [X] T043 [P] [US5] Extend `packages/shared/test/squad.test.ts`: hit 3 of the last 4 ended weeks → 75; joined 2 weeks ago with 2 of 2 hit → 100; no ended week → null.
- [X] T044 [US5] Add `consistency(weeks, today, joinedDate)` and the `consistency` board (rank by percent then `weekDays`, null last) plus `weekVolumeKg` from `dayVolumeKg` to `packages/shared/src/domain/squad.ts`. Make T043 pass.
- [X] T045 [US5] Add the Consistency tab (main "%"/"—", secondary "d/t this week · v kg", "Not affected by the period" note, empty state) to `apps/web/src/components/squad-boards.tsx`.

---

## Phase 9: User Story 6 - Lift board with relative strength (Priority: P3)

**Goal**: Per-exercise e1RM ranking and opt-in relative strength (FR-021, FR-022).

**Independent Test**: spec Story 6 independent test.

- [X] T046 [US6] Add the `lift` board to `buildBoards` in `packages/shared/src/domain/squad.ts`: options = Bench Press, Barbell Squat, Deadlift, Overhead Press (`gx-bench-press`, `gx-barbell-squat`, `gx-deadlift`, `gx-overhead-press`) + other built-in strength exercises where ≥ 2 visible members have a best; own `gc-` never offered; best e1RM in period (`dayBests` for week/30d, `bestE1rm` for all); `relative = round2(e1rm / bodyWeightKg)` only when `shareBodyWeight && bodyWeightKg` is saved; `relativeRank` ranks only non-null relatives. Never put body weight in the output.
- [X] T047 [US6] Add one case to `services/api/test/squad-leaderboard.test.ts`: a member who did not opt in has `relative: null` and `relativeRank: null`; an opted-in member with 80 kg and e1RM 100 has `relative: 1.25`.
- [X] T048 [US6] Add the Lifts tab to `apps/web/src/components/squad-boards.tsx` (exercise `<select>` updating `?exercise=`, Absolute | Relative segment as client state, "—" rows after ranked ones, empty state).

---

## Phase 10: Polish & Cross-Cutting

- [X] T049 Add `squad backfill` to `infra/scripts/admin.ts`: for each `listCommunity` member call `refreshSquadStats(userId, deps, { seed: true })`; print only counts (members, stats written, feed items 0).
- [X] T050 [P] Add CDK assertions in `infra/test/stacks.test.ts` that the six new routes exist and use the Cognito authorizer.
- [X] T051 [P] Add one case to `services/api/test/mcp-upserts.test.ts`: `upsert_workout_log` with a heavier set on an existing exercise creates a PR feed item for that member.
- [X] T052 [P] Remove the "Coming soon" tag from the Squad tab in `apps/web/src/app/_landing/product-preview.tsx`.
- [X] T053 [P] Add a "Squad leaderboard (feature 010)" section to `CLAUDE.md` (routes, item keys `SQUADSTATS`/`FEED#`/`HI5#`, `refreshSquadStats` call sites, jump rule, backfill command, privacy rules, never log entries/feed text) and update the MCP line that says there is no leaderboard tool.
- [X] T054 Run `pnpm check` and `pnpm synth`; fix failures.
- [ ] T055 Walk through quickstart.md §2–§8 against dev (needs AWS deploy and the backfill run), including a page-load time check on a phone connection (SC-001).

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** → all stories. Phase 2's T005 depends on T004; T011 depends on T005, T008, T009, T010; T012 depends on T011.
- **US7** (Phase 3) needs only Phase 2.
- **US1** (Phase 4) needs Phase 2; uses settings defaults so it does not need US7.
- **US2** needs US1's `buildBoards`/page. **US3** needs US2 (PR walk). **US4** needs US2 (PR events) and US1 page. **US5** needs US1. **US6** needs US2 (`dayBests`).
- Polish after the stories it touches (T049 after T011; T051 after T029).

## Parallel Examples

- Phase 2: T002, T003, T006, T007 together; then T004 ∥ T008 ∥ T009 ∥ T010.
- US1: T018 ∥ T019 ∥ T025 first; then T020 → T021; T022 ∥ T023 ∥ T024 independent of the page.
- US3: T032 ∥ T033, then T034 ∥ T035.
- Polish: T050 ∥ T051 ∥ T052 ∥ T053.

## Implementation Strategy

1. **MVP** = Phases 1–4 (foundation, settings, Streaks board): deployable on its own and already replaces the daily streak.
2. Add US2 (PRs) → US3 (jump guard) → US4 (feed) so feed items only start after PRs are trustworthy.
3. Add US5 and US6, then Polish; run the backfill once after deploy (T049, T055).
