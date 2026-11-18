---
description: "Task list for 011-squad-profiles-nutrition"
---

# Tasks: Squad Member Profiles and Shared Nutrition

**Input**: Design documents from `specs/011-squad-profiles-nutrition/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/web.md](contracts/web.md), [quickstart.md](quickstart.md)

**Tests**: Required by the spec's Tests list and constitution III under the **lean tests** rule: one happy path plus the one or two rejections that matter per behaviour; no UI/copy/schema-limit tests. Domain tests are written first and must fail before implementation.

**Organization**: Grouped by user story (US1–US7). Paths are repo-relative. Before writing Next.js code read the relevant parts of `apps/web/node_modules/next/dist/docs/` (apps/web/AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Amend `.specify/memory/constitution.md` principle VI to 2.4.0 (MINOR): another member may see, only if the owner opted in, per day at **Daily totals** exactly: calories in, protein, carbs, fat, calories burned (with adjusted flag), protein target, calorie target; at **Totals + meals** additionally meal names, items, per-meal macros, captions and food photos via expiring links; never email, keys, timezone, body weight (beyond 010). Update the Sync Impact Report.
- [X] T002 Read `apps/web/node_modules/next/dist/docs/` on dynamic route params (`[memberId]`), Server Actions for incremental loading and Suspense under Cache Components (scratch note only).

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: settings storage, the single visibility gate, the pure profile/day-card domain, and the nutrition shapes everything else serialises through.

- [X] T003 [P] Write failing tests `packages/shared/test/member-profile.test.ts`: (a) `buildDayCards` groups one gym session plus one session per activity, volume uses working sets, top set and PR badges per research R4; (b) `pageTimeline` returns 10 workout days newest first, cursor exclusive, a day is never split or repeated across pages (R3); (c) `heatmapLevels` gives level 0 none, 1 trained without volume, 2–4 by the member's own terciles (R5).
- [X] T004 [P] Write failing tests `packages/shared/test/nutrition-share.test.ts`: (a) `nutritionFor` returns `undefined` at `off`, totals-only keys at `totals` (no `meals`, no `photoUrl`), meals at `meals`; each validated against its strict schema (extra key rejected); (b) `burnedAdjusted` is true when any workout that day has `aiNote`; (c) `proteinHitDays` counts a day only with ≥ 1 counted entry and protein ≥ target, pending photos excluded; (d) `rankNutrition` gives ties the same rank and excludes `off` and no-target members, never reads calories.
- [X] T005 Implement `packages/shared/src/domain/member-profile.ts` (`buildDayCards`, `pageTimeline`, `heatmapLevels`, types per data-model "Workout day card"/"Heatmap") reusing `e1rm`/working-set rules from `packages/shared/src/domain/squad.ts`; export from `packages/shared/src/index.ts`. Make T003 pass.
- [X] T006 Implement `packages/shared/src/domain/nutrition-share.ts` (`NutritionLevel`, `nutritionFor`, `proteinHitDays`, `proteinRuns`, `rankNutrition`) per data-model "Derived" and research R1, R8, R9. Make T004 pass.
- [X] T007 [P] Create `packages/shared/src/contracts/squad-profile.ts` with strict schemas from contracts/api.md: `NutritionTotalsSchema`, `NutritionMealsSchema`, `DayCardSchema`, `DayLogSchema`, `MemberProfileSchema`, `TimelineSchema`, `TodaySchema`, `HeatmapSchema`; export from the package index.
- [X] T008 Update `packages/shared/src/contracts/squad.ts`: `SquadSettingsSchema` gains `nutritionSharing` (enum off|totals|meals, default off) and `dismissPrompt` (optional bool on the request); `SquadFeedItemSchema.kind` gains `protein_streak`; `DEFAULT_SQUAD_SETTINGS.nutritionSharing = "off"`.
- [X] T009 Update `services/api/src/lib/profile-repo.ts`: `ProfileItem` + `fromItem` read `nutritionSharing` (default off) and `nutritionPromptSeen` (default false); `squadSettingsOf` returns both; `setSquadSettings` writes them (setting a level or `dismissPrompt` sets `nutritionPromptSeen = true`); update in-memory fake in `services/api/test/fakes.ts`.
- [X] T010 Update `services/api/src/handlers/me-squad-put.ts` to accept the new fields (validated by T008) and return them; no other behaviour change yet.
- [X] T011 Create `services/api/src/lib/member-access.ts`: `resolveMember(viewerId, memberId, deps)` loads the profile; missing, malformed or hidden-and-not-owner → throw the single 403 `MEMBER_PRIVATE` (same body each case, research R7); returns `{ profile, isYou, level }` where `level` = owner's `nutritionSharing`, forced `off` when hidden and viewer ≠ owner, forced `meals` for the owner. Add `MEMBER_PRIVATE` to `services/api/src/lib/http.ts` helpers.
- [X] T012 (deviation: no `listEntriesBefore`; the timeline walks `listEntriesInRange` in 90-day windows) Update `services/api/src/lib/squad-repo.ts` (+ fake): `FeedItem` gains optional `listed` (false → write without `gsi1pk`/`gsi1sk`), `putFeed` honours it; add `listMemberFeed` filter helpers if needed. Extend `services/api/src/lib/workout-repo.ts` (+ fake) with `listEntriesBefore(userId, beforeDate, limit)` newest-first (research R3). Add `SquadEventKind` values `workout_day` and `protein_streak` in `packages/shared/src/domain/squad.ts`.
- [X] T013 Create `services/api/src/lib/member-view.ts`: `loadDayCard(owner, viewer, date, deps, { withSets })` — loads workout entries, food entries and burned, builds the card via T005/T006, attaches nutrition per level, signs photo URLs via `deps.photos.urlFor` only at `meals` for entries with a photo (research R10), loads `deps.squad.getStats` for PR badges (`lifts.*.prDays`), attaches day high-five state from the member's `FEED#day#` item. Never log content.

**Checkpoint**: shared domain and gate ready.

---

## Phase 3: User Story 1 — Member profiles (P1) 🎯 MVP

**Goal**: tap a name → profile with header, PRs, heatmap, paged timeline, lazy set log.

**Independent test**: quickstart step 4 (without nutrition or high-fives).

- [X] T014 [P] [US1] Write failing handler test `services/api/test/squad-member.test.ts`: profile returns header/streak/week/PRs/heatmap for a visible member; timeline pagination returns each day exactly once across 2+ pages with `nextCursor` null at the end; `days/{date}` returns full sets and `rest: true` for an empty day.
- [X] T015 [US1] Create `services/api/src/handlers/squad-member-get.ts` (strict `MemberProfileSchema`; uses `resolveMember`, `weeklyStreakOf`, stats PR best/bestE1rm for main lifts `DEFAULT_LIFT_IDS` plus any other built-in with sets, heatmap from 84 days of entries).
- [X] T016 [US1] Create `services/api/src/handlers/squad-member-timeline-get.ts` (cursor date, 10 workout days/page via `listEntriesBefore` + `pageTimeline`, milestones merged from `listMemberFeed` for `streak_week`/`first`, plus `protein_streak` only when the owner's level is not `off`; invalid cursor → 400).
- [X] T017 [US1] Create `services/api/src/handlers/squad-member-day-get.ts` (`DayLogSchema`, future date → 400, rest-day shape).
- [X] T018 [US1] Register routes in `infra/lib/api-stack.ts`: `GET /squad/members/{memberId}`, `/squad/members/{memberId}/timeline`, `/squad/members/{memberId}/days/{date}` (Cognito, `photos: "read"`); add a CDK assertion only if the stack tests already enumerate squad routes.
- [X] T019 [P] [US1] Create `apps/web/src/components/heatmap.tsx` (12×7 grid, `bg-line` + `bg-accent/20|40|70|100`, `aria-label` per cell, tabular legend).
- [X] T020 [P] [US1] Create `apps/web/src/components/day-card.tsx` (sessions listed separately, volume, top set, PR badges with Lucide icon, expand to set-by-set via a passed `loadDay` action; uses `cardClass`/`chipClass` from `form-bits.tsx`).
- [X] T021 [US1] Create `apps/web/src/components/timeline.tsx` (client: first page props, "Load more" + intersection observer calling a Server Action, milestone items) and `apps/web/src/components/member-profile.tsx` (header: Avatar, name, member-since, streak, target, week "2 / 3"; PR board; heatmap; own-profile "Edit sharing settings" link to `/settings#squad`).
- [X] T022 [US1] Create `apps/web/src/app/(app)/squad/[memberId]/page.tsx` (Server Component, `<Suspense>`, `requireProfile`, `apiFetch` with `MemberProfileSchema`/`TimelineSchema`; `MEMBER_PRIVATE` → "This member keeps their log private"), plus Server Actions `loadTimeline`, `loadDay` in `apps/web/src/server/actions/squad.ts`.
- [X] T023 [US1] Link names/avatars to `/squad/<userId>` in `apps/web/src/components/board-row.tsx`, `squad-boards.tsx` and `squad-feed.tsx` (FR-001).

**Checkpoint**: MVP — profiles work.

---

## Phase 4: User Story 2 — Privacy on profiles (P1)

**Goal**: hidden members unreachable; nothing sensitive ever returned.

**Independent test**: quickstart step 3.

- [X] T024 [P] [US2] Add to `services/api/test/squad-member.test.ts`: a hidden member's profile, timeline, day log and `/squad/today` (`/squad/today` is asserted in T027) all return 403 `MEMBER_PRIVATE` with identical bodies, an unknown id returns the same body, and the owner can still read their own; a profile response parsed with a key-allow-list contains no email/username/timezone/calorie-target/body-weight keys.
- [X] T025 [US2] Verify every new handler calls `resolveMember` before reading any data (add a lint-style grep step to quickstart) and that `TimelineSchema`/`MemberProfileSchema` stay strict; fix any handler that does not.
- [X] T026 [US2] Web: render the private-log state in `apps/web/src/app/(app)/squad/[memberId]/page.tsx` for 403 `MEMBER_PRIVATE` and a "Others can't see this profile" note on the owner's own hidden profile.

---

## Phase 5: User Story 3 — Workouts on the leaderboard (P2)

**Goal**: expandable rows with lazy set details and a "Today's workouts" view.

**Independent test**: quickstart step 5.

- [X] T027 [P] [US3] Write failing test `services/api/test/squad-today.test.ts`: only visible members who trained appear, ordered by latest workout update time descending; each card has `member`; hidden members absent.
- [X] T028 [US3] Create `services/api/src/handlers/squad-today-get.ts` (`TodaySchema`, `date` within last 30 days else 400, totals-only nutrition per level, no meals) and register `GET /squad/today` in `infra/lib/api-stack.ts`.
- [X] T029 (deviation: a top-level `trainedOn` id list and `today`, not a per-row `hasWorkout`) [US3] Update `services/api/src/handlers/squad-leaderboard-get.ts` + `SquadLeaderboardSchema`: accept `date`; every row gains `hasWorkout: boolean` for that date (computed from stats day data / one range query).
- [X] T029a [US3] Add a day selector to `apps/web/src/app/(app)/squad/page.tsx` (`?date=`, previous/next links, never beyond today or 30 days back, today computed server-side) and pass it to the leaderboard and today fetches.
- [X] T030 [US3] Update `apps/web/src/components/board-row.tsx` and a small client wrapper in `squad-boards.tsx`: row body is a button (`aria-expanded`) toggling an expansion, name/avatar stay links; single `expandedId` on viewports < 640 px; fetch via `loadDay` on first expand and cache; states "Rest day" (muted) and "Nothing logged yet" for today.
- [X] T031 [P] [US3] Create `apps/web/src/components/today-workouts.tsx` and add the `?view=today` segment in `apps/web/src/app/(app)/squad/page.tsx` (plain links like existing tabs), fetching `GET /squad/today`.

---

## Phase 6: User Story 4 — High-five a workout day (P2)

**Goal**: one toggleable high-five per member per day, without feed noise.

**Independent test**: quickstart step 4, high-five sub-step.

- [X] T032 [P] [US4] Write failing test `services/api/test/squad-hi5-day.test.ts`: PUT on `<author>~day#<date>` creates the unlisted target and counts once (repeat PUT idempotent), DELETE removes it, `GET /squad/feed` does not list it, own-day PUT rejected, a non-workout date returns 404, and when the day stops being a workout day `refreshSquadStats` removes the target and its high-fives.
- [X] T033 [US4] Update `services/api/src/handlers/squad-hi5-put.ts` / `squad-hi5-delete.ts`: parse `day#<date>` ids; PUT verifies viewer ≠ author, author visible (`resolveMember`), `<date>` is a workout day for the author, lazily `putFeed({ listed: false, kind: "workout_day", ... })` before `addHighFive`.
- [X] T034 [US4] Update `services/api/src/lib/squad-stats.ts`: in the feed diff treat `day#<date>` items as derived only if `<date>` is still a workout day; delete otherwise (with high-fives); never create them (research R6).
- [X] T035 [US4] Fill `highFives`, `highFivedByMe`, `canHighFive` on day cards (`member-view.ts`) and milestones (timeline handler) from `listMemberFeed` + `myHighFives`; web: reuse the existing high-five button/action from `apps/web/src/components/squad-feed.tsx` in `day-card.tsx` and timeline milestones; hidden for own.

---

## Phase 7: User Story 5 — Choose a sharing level (P2)

**Goal**: setting, one-time card, immediate effect.

**Independent test**: quickstart step 2.

- [X] T036 [P] [US5] Write failing test `services/api/test/squad-nutrition.test.ts` (sharing section): for one owner at `off`/`totals`/`meals`, the profile timeline day card has no `nutrition` key / totals-only keys / full meals with a photo URL; flipping the level changes a past day's response with no other action; a hidden owner shows no nutrition at any level; Totals responses never contain `photoUrl`, `photoKey` or `meals`.
- [X] T037 [US5] Wire `nutrition` into day cards/day log/today via `loadDayCard` using `level` from `resolveMember`; ensure the response is parsed with `DayCardSchema` before returning (strict).
- [X] T038 [US5] Leaderboard response: `viewer.nutritionPrompt` (= !`nutritionPromptSeen`) in `squad-leaderboard-get.ts` + schema.
- [X] T039 [P] [US5] Create `apps/web/src/components/nutrition-card.tsx` (three radio options with one-line explanations, Save and "Not now" which sends `dismissPrompt`) and render it on `/squad` when `viewer.nutritionPrompt`; Server Action `saveNutritionSharing` in `apps/web/src/server/actions/squad.ts`.
- [X] T040 [US5] Update `apps/web/src/components/squad-settings-form.tsx` and `apps/web/src/server/actions/squad.ts`: "Share my nutrition with the squad" segment (Off · Daily totals · Totals + meals) with explanations, anchor `id="squad"` on the section; revalidate `/squad` paths.

---

## Phase 8: User Story 6 — Nutrition on leaderboard and profiles (P3)

**Goal**: compact row, burned "adj." label, day card totals/meals.

**Independent test**: quickstart step 7.

- [X] T041 [P] [US6] Add to `services/api/test/squad-nutrition.test.ts`: leaderboard `nutritionToday` contains only members at ≥ totals with exactly the totals keys; `burnedAdjusted` true when any workout has `aiNote`, false otherwise; pending photo entries excluded from totals.
- [X] T042 [US6] Add `nutritionToday` to the leaderboard handler/schema (selected `date`, totals shape only, members at `off`/hidden absent).
- [X] T043 [P] [US6] Create `apps/web/src/components/nutrition-row.tsx` (protein `142 / 160 g` + progress bar with `bg-accent` on `bg-line`, no bar without target; calories in with target; burned `~420 kcal` + "adj." chip using `AiBadge` styling when `burnedAdjusted`; no net) and render it in `board-row.tsx`.
- [X] T044 [US6] Show daily totals and the expandable meal list (meals, items, per-meal macros, `<img>` from the signed URL with caption) in `day-card.tsx` per level.

---

## Phase 9: User Story 7 — Nutrition board (P3)

**Goal**: rank on hitting own protein target only; protein-streak feed line.

**Independent test**: quickstart step 6.

- [X] T045 [P] [US7] Add handler tests to `services/api/test/squad-nutrition.test.ts`: board ranks by hit days with ties sharing a rank; `off` and hidden members absent; shared member without target absent for others and `viewer.needsTarget` true for themselves; no row or field carries calories; `protein7#` feed item appears for a sharing author, disappears when the author goes to `off`.
- [X] T046 [US7] Add `nutrition` board to `squad-leaderboard-get.ts` + schema (period `week`|`30d`, else `week`): per sharing member with a target read `listEntriesInRange` for the period, compute with `proteinHitDays`, rank with `rankNutrition`.
- [X] T047 [US7] Create `services/api/src/lib/protein-events.ts` (`refreshProteinEvents`, `safeRefreshProtein` never throws, logs only error name): list 7-day runs, put/delete `FEED#protein7#<endDate>` (listed, `kind: "protein_streak"`) per research R9. Call it after food writes in `services/api/src/lib/food-write.ts` (create/patch), `services/api/src/handlers/food-entry-delete.ts`, photo estimate paths, `me-profile-put.ts`/`update_user_targets` (protein target changes) and `me-squad-put.ts` (level change).
- [X] T048 [US7] Update `services/api/src/handlers/squad-feed-get.ts`: drop `protein_streak` items whose author is hidden or at level `off` at read time; never return `workout_day`.
- [X] T049 [US7] Web: add `nutrition` to `BOARDS` in `apps/web/src/components/squad-boards.tsx` (hide "All time" for it, rows "6 / 7 days" + "logged N", note "Ranked on each member's own protein target", own "Set a protein target" link to Settings when `needsTarget`); render `protein_streak` text in `squad-feed.tsx`.

---

## Phase 10: Polish and cross-cutting

- [X] T050 [P] Document feature 011 in `CLAUDE.md` (new section: routes, sharing levels and the single `nutritionFor`/`resolveMember` choke points, unlisted `FEED#day#` items, protein events, never log food/photos) and add a short pointer in `specs/011-squad-profiles-nutrition/quickstart.md` for any new commands.
- [X] T051 Run `pnpm check` and fix typecheck, lint and test failures; run `pnpm synth` to confirm the CDK stack builds.
- [X] T052 Walk through `quickstart.md` steps 1–7 against the dev stack or fakes and record results; confirm the Story-share constraint (no food in any new response beyond the levels above).

---

## Dependencies and order

- Phase 1 → Phase 2 (blocks everything) → US1 (MVP) and US2 (both P1, US2 reuses US1 handlers) → US3, US4, US5 (independent of each other after US1) → US6 (needs US5's nutrition wiring) → US7 (needs US5; feed event after T012) → Polish.
- Within a story: failing tests first, then handlers, then web.
- T019/T020, T039/T043 and the test-writing tasks marked [P] touch different files and run in parallel.

## Parallel example (Phase 2)

T003, T004, T007 in parallel; then T005 and T006 in parallel; then T009–T013.

## Implementation strategy

MVP = Phases 1–4 (profiles and privacy). Then ship US3–US5 together (squad visibility and sharing choice), and US6–US7 last. Never ship US6/US7 UI without US5's one-time card.
