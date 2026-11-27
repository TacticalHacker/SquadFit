# Tasks: Squad Volume Raid (021)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/raids.md](contracts/raids.md)

**Tests**: lean (constitution III): failing domain tests first for the new pure rules; handler tests only for admin authorization, edit rules, win/sticker and privacy. No UI or copy tests.

## Phase 1: Setup

- [X] T001 Confirm `pnpm check` passes on the branch before any change (baseline)

## Phase 2: Foundational (blocks all stories)

- [X] T002 Write failing tests in `packages/shared/src/domain/raid.test.ts` for: `raidStatus` (draft/scheduled/live/won/ended/cancelled; won stays won), `raidDays` (squad tz Mon 1 Dec 00:00 – Mon 8 Dec 00:00 IST → 2026-12-01…2026-12-07), `isCounting` (stops at end + 12 h), `raidContribution` (80 kg × 8 × 3 ticked bench = 1,920; unticked, cardio and held sets add 0; 0 kg × 10 adds 0 but counts as a set; legs-only filter drops bench; late joiner off excludes `createdAt > startsAt`), `countedKg` (raw 18,000 at cap 40% of 40,000 → 16,000, capped)
- [X] T003 Implement `packages/shared/src/domain/raid.ts`: types `Raid` (fields per data-model: name 3–40, tagline ≤ 120, targetKg 1,000–10,000,000, capPct 10–100 default 40, `filter: { groups, exerciseIds } | null`, `lateJoiners`, `showContributors`, `stickerId: "raid_cleared"`, `draft`, `wonAt?`, `cancelledAt?`, `cancelReason?`), `raidStatus`, `raidDays`, `isCounting` (`GRACE_MS = 12 h`), `raidContribution(entries, raid, held, profileCreatedAt)`, `capKg`, `countedKg`, `raidPct`, `pace`, `daysLeft`; export from `packages/shared/src/index.ts`
- [X] T004 In `packages/shared/src/domain/squad.ts` make `walkLift` record held set indexes per date and `buildMemberStats` return `held: Record<string /* date|exerciseId */, number[]>` (stats shape unchanged)
- [X] T005 Create `packages/shared/src/contracts/raids.ts` (strict zod): `RaidInputSchema`, `RaidUpdateSchema` (+ `expectedUpdatedAt`), `RaidCancelSchema` (reason ≤ 120), `AdminRaidSchema`, `AdminRaidsResponseSchema`, `RaidSuggestResponseSchema`, `RaidCardSchema`, `RaidCardResponseSchema`, `RaidHistoryResponseSchema` per contracts/raids.md; add `RAID_RULE` to error codes in `contracts/errors.ts`; export
- [X] T006 Create `services/api/src/lib/raid-repo.ts` (`RaidRepo`: `listRaids`, `getRaid`, `putRaid(raid, expectedUpdatedAt|null)` → ok|conflict, `deleteRaid`, `listContributions(raidId)` consistent, `putContribution` conditional on increasing `statsVersion`, `getContribution`, `setWon(raidId, wonAt)` conditional `attribute_not_exists(wonAt)`, `setTotal`, `putSticker` ifAbsent, `listStickers(userId)`) with keys `RAID#<id>/META` (gsi1 `SQUADRAIDS#global` / `<startsAt>#<id>`), `RAID#<id>/CONTRIB#<sub>`, `USER#<sub>/RAIDSTICKER#<raidId>`; add `raids` to `Deps` in `lib/deps.ts` and `InMemoryRaidRepo` + `makeDeps` in `services/api/test/fakes.ts`
- [X] T007 Add `raids` to `StatsDeps` in `services/api/src/lib/squad-stats.ts` and provide `DynamoRaidRepo` in `infra/scripts/admin.ts` and `infra/scripts/gym-merge.ts` deps

## Phase 3: User Story 1 — the squad fills a live raid (P1) 🎯 MVP

**Independent test**: seed a live raid in fakes, save/edit/delete gym sets as two members, check card total, own figures and `raidKg`.

- [X] T008 [US1] Create `services/api/src/lib/raid-refresh.ts`: `refreshRaids(userId, profile, entries, held, statsVersion, deps)` → for each counting raid compute contribution, write it, sum all contributions (`countedKg`), `setTotal`, set `wonAt` when total ≥ target (and award stickers to every `setCount ≥ 1` contributor), award own sticker on a won raid; returns `raidKg` = Σ max(0, newCounted − oldCounted)
- [X] T009 [US1] Call `refreshRaids` from `refreshSquadStats` after a successful `putStats` (return `{ raidKg }`), make `safeRefresh` return `raidKg` (0 on error), and thread it through `saveGymEntry` (`services/api/src/lib/gym-save.ts`) to `gym-entry-put.ts` → `GymSaveResult.raidKg` (add to `contracts/gym.ts`, default 0)
- [X] T010 [US1] Create `services/api/src/lib/raid-view.ts`: `pickRaidCard(raids, now)` (pure, put in `domain/raid.ts` with a test row in T002 if trivial) and `buildRaidCard(raid, contributions, viewer, profiles, deps)` — contributors ≤ 5, visible to viewer only, newest `lastCountedAt` first, `null` when `showContributors` off; `you` own figures only
- [X] T011 [US1] Handler `services/api/src/handlers/squad-raid-get.ts` (`GET /squad/raid`): list raids, pick card, one partition query, lazy own-sticker repair, `canManage`/`canCreate`; route in `infra/lib/api-stack.ts` (`write: true`, `avatars: "read"`)
- [X] T012 [US1] Handler tests in `services/api/test/raids.test.ts`: save 80 × 8 × 3 → `raidKg` 1,920 and card total; hidden member's kg in total but not in contributors, own `you` intact; other members' responses never carry kg
- [X] T013 [P] [US1] Web: `apps/web/src/components/raid-card.tsx` (bar with `bg-accent-fill` fill on `bg-surface-2` track, pace tick, "28,400 / 40,000 kg · 71%", days left, "You: 6,200 kg (22%) · capped", avatars) and render it first on `apps/web/src/app/(app)/squad/page.tsx` (fetch `/squad/raid`, failure → no card)
- [X] T014 [P] [US1] Toast: add `raidKg` part ("+1,920 kg to raid") to `prToast` in `apps/web/src/lib/plain.ts` and pass it from `apps/web/src/components/gym-screen.tsx`

## Phase 4: User Story 2 — winning (P1)

- [X] T015 [US2] Tests in `services/api/test/raids.test.ts`: crossing the target sets won once, stickers for each contributor, later contributor gets one, deleting below target stays won, edit after end + 12 h leaves total unchanged
- [X] T016 [US2] Card won/ended/cancelled states + stamp shown once per device (`localStorage sf:raidstamp:v1:<raidId>`, fade only, `prHaptic`) in `apps/web/src/components/raid-card.tsx`
- [X] T017 [US2] Profile stickers: `raidsCleared` on `MemberProfile` (`contracts/squad-profile.ts`), filled in `services/api/src/handlers/squad-member-get.ts` from `listStickers`, shown in `apps/web/src/components/member-profile.tsx` ("Raid Cleared ×2")

## Phase 5: User Story 3 — admin create and schedule (P2)

- [X] T018 [US3] Tests first in `raid.test.ts` for `validateRaid` (overlap "Dates overlap Leg Day Siege", end > 31 days, start > 90 days ahead, > 3 scheduled, second live via Start now; drafts ignored) and `suggestTarget` (30,000/week, 7 days → 33,000; none → null)
- [X] T019 [US3] Implement `validateRaid` and `suggestTarget` in `packages/shared/src/domain/raid.ts`
- [X] T020 [US3] Handlers `admin-raid-post.ts` (`POST /admin/raids`), `admin-raids-get.ts` (`GET /admin/raids`), `admin-raid-suggest-get.ts` (`GET /admin/raids/suggest`) with `requireAdmin`; routes in `api-stack.ts`
- [X] T021 [US3] Tests: non-admin gets 403 on POST; overlapping schedule → 409 `RAID_RULE` with message
- [X] T022 [US3] Web: `apps/web/src/components/raid-form.tsx` (fields per FR-007, live preview with `RaidCard`, inline field errors), pages `apps/web/src/app/(app)/squad/raids/new/page.tsx` (`notFound()` unless admin), Server Actions `apps/web/src/server/actions/raids.ts`; "+ New raid" on the card for admins

## Phase 6: User Story 4 — edit or cancel (P3)

- [X] T023 [US4] Tests first in `raid.test.ts` for `lockedChanges` (live: start/filter/cap/lateJoiners/sticker locked; target below progress; end before now; final states read-only)
- [X] T024 [US4] Implement `lockedChanges`; handlers `admin-raid-put.ts`, `admin-raid-cancel-post.ts`, `admin-raid-delete.ts` (409 `STALE` on old `expectedUpdatedAt`; delete draft/scheduled only); routes
- [X] T025 [US4] Test: lowering target below 28,400 → 409; stale update → 409 `STALE`
- [X] T026 [US4] Web: edit page `apps/web/src/app/(app)/squad/raids/[raidId]/page.tsx` (locked fields disabled), cancel with reason, delete; actions in `server/actions/raids.ts`

## Phase 7: User Story 5 — history (P3)

- [X] T027 [US5] Handler `squad-raids-get.ts` (`GET /squad/raids`, final raids newest first ≤ 20, own `youKg` via `getContribution`); route
- [X] T028 [US5] Web: `apps/web/src/app/(app)/squad/raids/page.tsx` (history list; admin section with drafts/scheduled and "+ New raid"), "Raid history" link on the card

## Phase 8: Polish

- [X] T029 Document feature 021 in `CLAUDE.md` (keys, rules, routes, privacy, no scheduler)
- [X] T030 Run `pnpm check` and `pnpm synth`; fix failures

## Dependencies

Phase 2 → US1 → US2. US3 (needs Phase 2) can run alongside US1/US2; US4 after US3; US5 after US1. Within a story: tests → domain → handlers → web.

## Parallel examples

- US1: T013 and T014 (web) in parallel once T009–T011 land.
- US3: T018/T019 (domain) in parallel with US1 handler work.

## Implementation strategy

MVP = Phase 2 + US1 (seeded raid counts and shows). Then US2 (win), US3 (create), US4, US5, polish.
