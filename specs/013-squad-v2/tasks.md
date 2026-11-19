---
description: "Task list for feature 013 Squad v2"
---

# Tasks: Squad v2 (Simpler Leaderboard)

**Input**: Design documents from `/specs/013-squad-v2/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Requested by the spec (SC-007) and kept lean (constitution III): domain tests first, handler tests only for privacy, reactions and migration.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Capture "before" screenshots of `/squad` at 390 px and 1280 px wide on the current build and save them to `specs/013-squad-v2/screenshots/before-mobile.png` and `before-desktop.png`

---

## Phase 2: Foundational (blocks all stories)

- [X] T002 Write failing tests in `packages/shared/test/squad.test.ts` for `months` (workout days and total weight lifted bucketed by `date.slice(0, 7)`) and `lifts[id].monthBests` (`{ e1rm, date }`, flagged sets excluded), and that `dayVolumeKg` is gone
- [X] T003 Extend `buildMemberStats` in `packages/shared/src/domain/squad.ts`: add `months: Record<"YYYY-MM", { workoutDays: number; volumeKg: number }>` (volume summed in tenths like today) and `monthBests: Record<"YYYY-MM", { e1rm: number; date: string }>` per lift; remove `dayVolumeKg`, `weekVolumeKg`, `consistency`, `buildBoards`, `Boards`, `Period` and `periodStart`; make T002 pass
- [X] T004 [P] Add `monthOf(date)`, `monthDates(month, today)` (1st of `month` to `min(today, last day)`) and `squadMonth(now, timezone)` to `packages/shared/src/domain/boards.ts` (new file) and export from `packages/shared/src/index.ts`
- [X] T005 [P] Add squad settings to `services/api/src/lib/squad-repo.ts`: `getSquadSettings(): Promise<{ timezone: string }>` reading `pk = "SQUAD#global", sk = "SETTINGS"` (absent → `{ timezone: "Asia/Kolkata" }`) and `putSquadSettings(timezone, nowIso)`; mirror both in `services/api/test/fakes.ts`
- [X] T006 Add `pnpm admin squad timezone <IANA>` to `infra/scripts/admin.ts` (validate with `isValidTimezone`, print only "Squad timezone set") and update the USAGE text
- [X] T007 Create `services/api/src/lib/squad-members.ts`: `loadSquadMembers(viewerId, deps)` returning visible profiles (`visibleTo`), their stats (`batchGetStats`), `SquadMember` views, each member's `today`, the squad month (`squadMonth` + `getSquadSettings`) and the viewer profile
- [ ] T008 [P] Create `apps/web/src/lib/plain.ts` with the shared formatters used by every story: `kg(n)`, `num(n)`, `stepsADay(n)`, `weeksInARow(n)` (hidden at 0), `bestWeeks(n)`, `workoutsThisWeek(days, target)` ("2 of 4 workouts this week"), `estMax(kg)` ("Estimated max: about 101 kg"), `monthName(ym)`, and `isDumbbell(id, name)` (name contains "Dumbbell", or id `gx-hammer-curl` / `gx-lateral-raises`)
- [ ] T009 [P] Create `apps/web/src/components/info-tip.tsx`: an (i) button (lucide `Info`, size 16, `strokeWidth={1.75}`, `iconButtonClass`) that opens one sentence in a `BottomSheet` with `<SheetClose />`

**Checkpoint**: stats carry months; squad month and member loader exist.

---

## Phase 3: User Story 2 - Monthly boards (P1)

**Goal**: seven boards ranked on the server. **Independent test**: entries on 30 Nov and 1 Dec → December-only monthly boards, unchanged streak.

- [X] T010 [US2] Write failing tests in `packages/shared/test/boards.test.ts`: month reset (30 Nov vs 1 Dec) for `workouts` and `volume` while `streak` is unchanged; `prJump` uses only earlier months, a lift first logged this month gives no jump, a jump ≤ 0 is not listed, `pctRank` can differ from `rank`; `strength` ranks Big 3, puts a member missing Deadlift last with `rank: null`, `big3: null`, `missing: ["Deadlift"]`, and `big4Rank` adds Overhead Press; ties share a rank
- [X] T011 [US2] Implement in `packages/shared/src/domain/boards.ts`: `BOARD_DEFS` (`workouts`, `streak`, `volume`, `steps`, `prJump`, `strength`, `protein`, each `{ id, group: "grind" | "strength" | "nutrition", monthly }`), `PR_JUMP_LIFTS` (`gx-bench-press`, `gx-barbell-squat`, `gx-deadlift`, `gx-overhead-press`, `gx-barbell-row`, `gx-pull-ups`), one rank function per board (reuse `rankRows`, `streakFigures`, `rankSteps`, `rankNutrition`), and `buildSquadBoards({ members, viewerId, month, steps, protein })` that drops hidden members before ranking and appends a hidden viewer's own row with `rank: null`; make T010 pass
- [X] T012 [P] [US2] Create `packages/shared/src/contracts/squad-boards.ts`: `ClubSchema` (`club225|club300|club400|club450|club500`), board row schemas and `SquadBoardsSchema` exactly as in `contracts/api.md` (strict, discriminated on `id`); export from `packages/shared/src/index.ts`; delete `SquadLeaderboardSchema`, `PeriodSchema` from `contracts/squad.ts` and `SquadLeaderboardFullSchema` from `contracts/squad-profile.ts`
- [X] T013 [US2] Create `services/api/src/handlers/squad-boards-get.ts` (`handle(event, deps)`): `loadSquadMembers`, steps per month through `stepsShared`/`stepsVisibleTo` + `deps.activity.listRange`, protein per month for members with `sharedLevel !== "off"`, a `dailyProteinTarget` and `targetsConfirmedAt` (via `proteinByDay`/`hitDays`), then `buildSquadBoards`; omit the protein board when it has no rows; `viewer: { hidden, nutritionPrompt, targetsPrompt }`; parse with `SquadBoardsSchema`; log nothing
- [X] T014 [US2] Write `services/api/test/squad-boards.test.ts`: a hidden member is absent from every board; an unconfirmed member is absent from `protein`; a member with steps sharing off is absent from `steps`
- [X] T015 [US2] In `infra/lib/api-stack.ts` add `route("squad-boards-get", HttpMethod.GET, "/squad/boards", { avatars: "read" })` and remove the `squad-leaderboard-get` route; delete `services/api/src/handlers/squad-leaderboard-get.ts` and `services/api/test/squad-leaderboard.test.ts`

---

## Phase 4: User Story 1 - At-a-glance page (P1)

**Goal**: one row of controls, cards with top 3 + you, full lists on their own page. **Independent test**: viewer 5th → card shows 3 rows + "You · #5 · 6 workouts".

- [ ] T016 [P] [US1] Add board copy to `apps/web/src/lib/plain.ts`: `BOARD_COPY[id] = { title, info, value(row), sub(row) }` with the (i) sentences (Streak: "Weeks in a row you hit your workout goal. Rest days don't break it."; Current strength: "Your estimated max on bench press, squat and deadlift, added together. Uses your best ever, so it doesn't reset."; etc.)
- [ ] T017 [US1] Create `apps/web/src/components/board-card.tsx`: title + `InfoTip`, top 3 rows (rank, `Avatar`, name, `ClubBadge` slot, big value, ≤ 1 muted line), "You · #N · value" when the viewer's rank > 3 (or "You · not ranked (hidden)"), the whole card a `Link` to `/squad/boards/<id>` with member names linking to `/squad/<memberId>`; empty board sentence from `BOARD_COPY`
- [ ] T018 [US1] Create `apps/web/src/components/board-list.tsx` and `apps/web/src/app/(app)/squad/boards/[board]/page.tsx`: full ranked list from `GET /squad/boards`; `prJump` gets a "kg | %" segmented link (`?sort=pct`, ordering by `pctRank`), `strength` gets "Big 3 | Big 4" (`?lifts=4`, ordering by `big4Rank`), unranked members muted at the bottom with "missing: Deadlift"; 404 for an unknown board id
- [ ] T019 [US1] Rewrite `apps/web/src/app/(app)/squad/page.tsx`: title, `NutritionCard`/targets prompt/hidden notice, latest 5 feed items + "See all" (`/squad/feed`) + "See today's workouts →" (`/squad/today`), one segmented control "This month | Hall of Fame" (`?view=fame`), then the board cards; remove the date picker, period toggle, Boards/Today switch, tab row and notes
- [ ] T020 [P] [US1] Create `apps/web/src/app/(app)/squad/today/page.tsx` moving the Today's workouts view and its day picker (from the old squad page) onto its own route, using `GET /squad/today`
- [ ] T021 [US1] Delete `apps/web/src/components/squad-boards.tsx` and `apps/web/src/components/board-row.tsx` (move anything still used into `board-card.tsx`/`board-list.tsx`)

---

## Phase 5: User Story 3 - Feed with reactions (P1)

**Goal**: 🔥 💪 👑 replace high-fives; migration. **Independent test**: toggle 🔥/💪 counts; 3 high-fives → 💪 3.

- [X] T022 [US3] Replace high-fives in `services/api/src/lib/squad-repo.ts`: `FeedItem.reactions: { fire, muscle, crown }` from `rxFire`/`rxMuscle`/`rxCrown`; `addReaction(author, type, reactor, nowIso)` / `removeReaction(...)` as one transaction each (Put `RX#<eventId>#<type>#<reactor>` with `attribute_not_exists(sk)` + `ADD rx<Type> :1` with `attribute_exists(sk)`; Delete with `attribute_exists(sk)` + `ADD rx<Type> :-1` with `rx<Type> > :zero`), idempotent; `myReactions(viewerId, items)` (BatchGet 3 keys per item); `deleteFeed` removes `RX#<eventId>#` items; `migrateHighFives()` per research R5; update `services/api/test/fakes.ts`
- [X] T023 [US3] Write `services/api/test/squad-reactions.test.ts`: toggle 🔥 on/off and counts, two reactors count exactly, own item → 404, `day#<date>` created lazily only for a workout day, unknown type → 400; migration turns 3 high-fives into 💪 3 and a second run changes nothing
- [X] T024 [US3] Create `services/api/src/lib/reaction.ts` (from `high-five.ts`, adding the `type` path parameter `fire|muscle|crown`) and handlers `services/api/src/handlers/squad-reaction-put.ts` / `squad-reaction-delete.ts` returning `{ reactions }`; delete `high-five.ts`, `squad-hi5-put.ts`, `squad-hi5-delete.ts`, `services/api/test/squad-hi5-day.test.ts` (fold its day cases into T023)
- [X] T025 [US3] In `infra/lib/api-stack.ts` add `PUT|DELETE /squad/feed/{id}/reactions/{type}` (`{ write: true }`) and remove the high-five routes
- [X] T026 [US3] Update contracts: `ReactionsSchema` (`{ fire: { count, mine }, muscle: …, crown: … }`) in `contracts/squad-boards.ts`; feed item in `contracts/squad.ts` gets `reactions`, `canReact`, kind `"badge"`, `club`, and `pr.gainKg: number | null`; day cards in `contracts/squad-profile.ts` replace `highFives`/`highFivedByMe`/`canHighFive` with `reactions`/`canReact`; delete `HighFiveResultSchema`
- [X] T027 [US3] Update `services/api/src/handlers/squad-feed-get.ts` (`?limit=5|20`, reactions, badge and `gainKg`), `services/api/src/lib/member-view.ts` (`loadHighFives` → `loadReactions`), `squad-today-get.ts`, `squad-member-timeline-get.ts`, `squad-member-day-get.ts`, `protein-events.ts`, `step-events.ts`, `squad-stats.ts` to the reaction shape
- [X] T028 [US3] Add `gainKg` to PR event payloads in `buildMemberStats` (`packages/shared/src/domain/squad.ts`): estimate gain over the previous best estimate, `null` for a weight-only PR
- [X] T029 [US3] Add `pnpm admin squad migrate-reactions` to `infra/scripts/admin.ts` (prints counts only)
- [ ] T030 [US3] Create `apps/web/src/components/reactions.tsx` (three toggle buttons with emoji + count, `aria-pressed`, optimistic with `useOptimistic`, disabled when `!canReact`) and `toggleReaction(id, type, on)` in `apps/web/src/server/actions/squad.ts`; replace `HighFiveButton` in `squad-feed.tsx`, `day-card.tsx`, `timeline.tsx`; delete `high-five-button.tsx`
- [ ] T031 [US3] Create `apps/web/src/app/(app)/squad/feed/page.tsx` (20 items) and add `feedLine(item)` to `apps/web/src/lib/plain.ts` ("Nikhil hit a new PR (personal best) on Bench Press: about 95 kg (+2.5 kg)", "Swathi hit the workout goal 4 weeks in a row", "Roshan joined the 300 kg Club 👑", steps and protein lines); use it in `squad-feed.tsx`

---

## Phase 6: User Story 4 - Hall of Fame (P2)

**Goal**: all-time records. **Independent test**: two months of history → right holder, value, date per record.

- [X] T032 [US4] Write failing tests in `packages/shared/test/boards.test.ts` for `buildHallOfFame`: each record id from `data-model.md`, earliest date wins a tie, hidden members never hold a record, empty → `holder: null`
- [X] T033 [US4] Implement `buildHallOfFame({ members, viewerId, stepMonths })` in `packages/shared/src/domain/boards.ts` (lift records from `bestE1rm`, `big3` with the date the three bests were all reached, `longestStreak` from `streakFigures().best` with its week-end date, month records from `months`/`monthBests`/step averages); make T032 pass
- [X] T034 [US4] Add `HallOfFameSchema` to `contracts/squad-boards.ts`, handler `services/api/src/handlers/squad-hall-of-fame-get.ts` (steps history only through `stepsShared`), route `GET /squad/hall-of-fame` (`{ avatars: "read" }`) in `infra/lib/api-stack.ts`
- [ ] T035 [US4] Create `apps/web/src/components/hall-of-fame.tsx` (one row per record: plain label from `plain.ts`, holder link, value with unit, date or month, "No record yet") and render it on `/squad?view=fame`

---

## Phase 7: User Story 5 - Club badges (P2)

**Goal**: 225–500 kg Clubs, once to the feed. **Independent test**: 290 → 310 kg est. Big 3 → 225 and 300 held, one 300 feed item.

- [X] T036 [US5] Write failing tests in `packages/shared/test/squad.test.ts`: `badges` records each club with the first date the best-so-far Big 3 met it; events `badge#club300` (kind `badge`, payload `{ club, totalKg }`) appear once and are identical across rebuilds; an edit below the threshold removes the badge and event; seeded backfill events are filtered
- [X] T037 [US5] Implement `CLUBS` (`club225` 225, `club300` 300, `club400` 400, `club450` 450, `club500` 500) and `clubOf(stats)` in `packages/shared/src/domain/boards.ts`, and badge computation in `buildMemberStats` (timeline of best-so-far estimates for the three lifts, kept internal to `walkLift`); add `"badge"` to `SquadEventKind`; make T036 pass
- [X] T038 [US5] Include `club` on every board row (`buildSquadBoards`) and Hall of Fame holder, and `badges: { club, date }[]` on `GET /squad/members/{id}` (`contracts/squad-profile.ts`, `squad-member-get.ts`)
- [ ] T039 [US5] Create `apps/web/src/components/club-badge.tsx` (small chip, `chipClass`, label "300 kg Club (est.)", 450 shows "1000 lb") used in `board-card.tsx`, `board-list.tsx`, `hall-of-fame.tsx`, and the badge list in `member-profile.tsx`

---

## Phase 8: User Story 6 - Confirmed targets (P2)

**Goal**: unconfirmed targets never reach other members. **Independent test**: other member sees totals with no goals until confirm.

- [X] T040 [US6] In `services/api/src/lib/profile-repo.ts` add `targetsConfirmedAt?: string` (set in `upsert` and `setTargets`) and `targetsPromptDismissed?: boolean` (`dismissTargetsPrompt(userId, nowIso)`); expose `targetsConfirmed` and `targetsPromptDismissed` in `contracts/me.ts` and `me-get.ts`; update `fakes.ts`
- [X] T041 [US6] Change `nutritionOn(owner, viewerId, level, …)` in `services/api/src/lib/member-view.ts` to set `target`/`proteinTarget` to `null` when `viewerId !== owner.userId` and `!owner.targetsConfirmedAt`; update all callers; in `services/api/src/lib/protein-events.ts` treat unconfirmed members as having no target
- [X] T042 [US6] Extend `services/api/test/squad-boards.test.ts`: another member's day card has `calorieTarget: null` and `proteinTarget: null` until the owner confirms; the owner always sees their own
- [X] T043 [US6] Add `TargetsInputSchema` (`{ dailyCalorieTarget, dailyProteinTarget | null }` or `{ dismiss: true }`, same ranges as profile) to `contracts/me.ts`, handler `services/api/src/handlers/me-targets-put.ts` (calls `setTargets` then `safeRefreshProtein`), route `PUT /me/targets` (`{ write: true }`)
- [ ] T044 [US6] Create `apps/web/src/components/targets-prompt.tsx` ("Set your daily goals", calorie and protein inputs prefilled, Save and Not now) with Server Actions `saveTargets` / `dismissTargetsPrompt` in `apps/web/src/server/actions/me.ts`; show it on `/squad` and `/food` when `!targetsConfirmed && !targetsPromptDismissed`; in Settings show "Not confirmed yet: save to share your goals" while unconfirmed

---

## Phase 9: User Story 7 - Plain wording (P2)

**Goal**: every squad-area screen uses `plain.ts`. **Independent test**: no "e1RM", "adj.", "0-week" or unit-less numbers.

- [ ] T045 [P] [US7] Add set formatters to `apps/web/src/lib/plain.ts`: `setSummary(sets, perDumbbell)` ("3 sets of 10 reps at 15 kg" / "3 sets · 25 kg → 30 kg → 35 kg · 10 reps each" / "· 12, 10, 8 reps"), `bestSet` ("Best: 15 kg × 10 reps"), `heaviestLift`, `cardioLine` ("Incline treadmill walk · 5 min"), `sessionLine` ("69 min · 8 exercises · lifted 6,225 kg in total"), `burned` ("Burned about 433 calories"), `ate` ("Ate 120 of 2,000 calories" / "Ate 120 calories" when no target), `protein` ("Protein: 7 g of 150 g goal" / "Protein: 7 g"), `prLabel(first)` ("PR (personal best)" then "PR"); info sentences for estimated max, total weight lifted and the burned adjustment
- [ ] T046 [US7] Apply the formatters in `day-card.tsx`, `timeline.tsx`, `today-workouts.tsx`, `nutrition-view.tsx`, `member-profile.tsx` (session line once, `InfoTip` instead of the "adj." pill only when adjusted, `estMax` with its (i), "per dumbbell" via `isDumbbell`, streak hidden at 0)
- [ ] T047 [US7] Grep `apps/web/src` for user-visible "e1RM", "adj.", "-week streak", "top " and fix any remaining text

---

## Phase 10: Polish

- [ ] T048 Hide the body-weight-ratio switch in `apps/web/src/components/squad-settings-form.tsx` (feature 014 brings it back); keep the stored value
- [ ] T049 Update `CLAUDE.md`: replace the feature 010/011 leaderboard routes that changed and add a "Squad v2 (feature 013)" section (boards endpoint, registry, months/squad timezone, reactions + migration, badges, targets confirmed, `plain.ts`, rollout commands)
- [ ] T050 Run `pnpm check` and fix every failure; grep the new/changed handlers for `console.` and confirm only error names are logged (FR-029)
- [ ] T051 On dev: deploy, `pnpm admin squad migrate-reactions`, `pnpm admin squad backfill`; then capture "after" screenshots at 390 px and 1280 px to `specs/013-squad-v2/screenshots/after-mobile.png` and `after-desktop.png`, and run the manual checks in `quickstart.md`

---

## Dependencies & Execution Order

- Phase 2 blocks everything. US2 (boards API) before US1 (page) since the cards render its response. US3 is independent of US1/US2 on the API side; its web part (T030–T031) edits the new page, so after T019. US4 and US5 need T011/T012. US6 needs T013 (protein board) and is otherwise independent. US7 last (touches the same components).
- Within a story: tests → domain → contracts → handler → infra → web.

## Parallel Opportunities

- T004, T005, T008, T009 in parallel; T012 alongside T011; T016 and T020 alongside T017; T045 any time after T008.

## Implementation Strategy

MVP = Phases 2–5 (boards, new page, reactions + migration): shippable on its own. Then Hall of Fame, badges, targets, wording, polish. Commit after each phase.
