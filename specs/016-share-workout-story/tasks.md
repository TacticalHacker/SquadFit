---
description: "Task list for feature 016: Share a Workout Day (Story Card)"
---

# Tasks: Share a Workout Day (Story Card)

**Input**: Design documents from `/specs/016-share-workout-story/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Constitution III lean rule: failing tests first for the new pure domain functions (`buildShareSummary`, `improvedDays`), and per handler only access rules + one happy path. No UI, canvas, copy or schema-limit tests.

**Organization**: US1+US2 (P1) are the MVP: figures, Card + Photo templates, share/download. US3/US4 (P2) finish the sheet. US5 (P3) is the feed post.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Confirm no share code exists yet (`grep -ri "navigator.share" apps/web/src`), and that `pnpm check` is green on the branch before changes

---

## Phase 2: Foundational (blocks every story)

- [ ] T002 [P] Failing test in `packages/shared/test/squad.test.ts`: `buildMemberStats` sets `lifts[id].improvedDays` to the dates whose top set beat the previous session (first session never counts; same weight more reps counts)
- [ ] T003 Add `improvedDays: string[]` to `LiftStats` in `packages/shared/src/domain/squad.ts` from `walkLift`'s `improved`; make T002 pass; keep existing tests green (update fixtures that build `LiftStats` literals only where the type requires it)
- [ ] T004 [P] Failing tests in `packages/shared/test/share-card.test.ts` for `buildShareSummary`: top set per strength entry (heaviest working set, ties → more reps; bodyweight sets → `top` with 0 kg); `label` = top two muscle groups by working sets (one group; `null` for activity-only); `exerciseCount`/`durationMin` over workout entries only; rows capped at 5 with `moreCount` (10 entries → 5 + 5) in `createdAt` order; `liftsImproved` counts entries whose id lists the date in `improvedDays` (missing field → 0); `prs` from `prDays` on the date only; `streak` from `streakFigures` at the date; `volumeKg` of a row (working sets only)
- [ ] T005 Implement `packages/shared/src/domain/share-card.ts` (`buildShareSummary`, `sessionLabel`, `SHARE_MAX_ROWS = 5`) and `packages/shared/src/contracts/share.ts` (`ShareRowSchema`, `ShareSummarySchema` strict incl. `post`, `SharePostInputSchema`, `SharePostResultSchema`, `FeedWorkoutSchema`); export from `packages/shared/src/index.ts`; make T004 pass

**Checkpoint**: `pnpm --filter @calci/shared test` green.

---

## Phase 3: User Story 1 – Share today's workout as a story image (P1) 🎯 MVP

**Independent Test**: quickstart rows 1–5.

### Tests (write first)

- [ ] T006 [P] [US1] `services/api/test/me-share.test.ts`: `GET /me/share/{today}` with a logged gym entry → 200 strict `ShareSummary` with no calorie/body-weight keys; future date → 400; day with no workout entry → 404 `NOT_A_WORKOUT_DAY`; works for a member hidden from the leaderboard

### Implementation

- [ ] T007 [US1] `services/api/src/lib/share-summary.ts`: `loadShareSummary(owner, date, deps, { withSteps })` (entries of the day, stats, own steps via `deps.activity.listRange`) → `buildShareSummary`; `services/api/src/handlers/me-share-get.ts` (profile required, `resolveReadDate` with the member's today, 404 when not a workout day, adds `post` state from `deps.squad.getFeed`); route in `infra/lib/api-stack.ts` `route("me-share-get", HttpMethod.GET, "/me/share/{date}")`; make T006 pass
- [ ] T008 [P] [US1] Wording in `apps/web/src/lib/plain.ts`: `shareHeadline` parts (`minutes`, `exercisesCount`, `liftsImproved`), `shareRow(row)` ("Shoulder Press · 60 kg × 10", per dumbbell, "Pull-ups · 12 reps", "Lat Pulldown · 3 sets", "Incline Treadmill Walk · 5 min"), `sharePr(pr)` ("Bench Press · 82.5 kg (+2.5 kg)" or estimated max form), `shareStreak(streak)`, `shareDate(date)` ("Wed, 18 Nov"), `moreRows(n)`; `stepsCount(n)`
- [ ] T009 [US1] `apps/web/src/lib/share-render.ts`: `SHARE_W/H`, safe zone constants, dark palette, `resolveFonts()` (CSS vars → family names, `document.fonts.load` 400/500/600 + `ready`), `fitText` (shrink to 85% then ellipsis), `drawShare(ctx, { template, summary, options, photo })` for Card (and Photo/Sticker shared block), Trophy icon via `Path2D` from lucide path data, `exportShare(canvas, template, date) → File`
- [ ] T010 [US1] `apps/web/src/server/actions/share.ts`: `loadShare(date)` → `apiFetch("/me/share/<date>", { schema: ShareSummarySchema })` returning `{ ok, summary } | { ok: false, message }`
- [ ] T011 [US1] `apps/web/src/components/share-sheet.tsx`: full-screen `BottomSheet` with preview canvas (CSS-scaled), loading state, error + retry, template segment (Card/Photo/Sticker), Share (`canShare` files → `share`, ignore `AbortError`) and Download (object URL `<a download>`); file regenerated (debounced) after each change so Share runs synchronously inside the tap
- [ ] T012 [US1] `apps/web/src/components/share-button.tsx` (Lucide `Share`, `iconButtonClass`/secondary style, opens the sheet lazily) and place it in `apps/web/src/components/gym-screen.tsx` summary row when any exercise has an entry

**Checkpoint**: Card shares/downloads from the Gym tab.

---

## Phase 4: User Story 2 – Add my own photo (P1)

- [ ] T013 [US2] `apps/web/src/lib/share-photo.ts`: `loadSharePhoto(file)` (`createImageBitmap` with `imageOrientation: "from-image"`, `<img>` fallback, downscale to ≤ 2160 px long side, friendly error), `coverTransform`, `clampTransform`, `panBy`, `zoomTo`
- [ ] T014 [US2] Photo template in `share-render.ts` (cover-fit with transform; solid scrim band only behind the bottom stats block) and in `share-sheet.tsx`: Add/Change/Remove photo (`<input type="file" accept="image/*">`), template auto-switch, drag (pointer events, `touch-action: none`), pinch, zoom slider, "Your photo stays on your phone."

---

## Phase 5: User Story 3 – Sticker and what to show (P2)

- [ ] T015 [US3] Sticker template (transparent, white text, soft shadow, PNG) in `share-render.ts`; toggles in `share-sheet.tsx` (exercise list, personal bests, streak, duration, lifts improved, steps; steps off; toggles hidden when the content is absent); headline row drops hidden/zero figures and disappears when empty

---

## Phase 6: User Story 4 – Download on desktop (P2)

- [ ] T016 [US4] In `share-sheet.tsx`: when `canShare` with files is false, Download is the primary button with the hint "Save the image, then add it to your Instagram Story."; Download always available as secondary otherwise

---

## Phase 7: User Story 5 – Post to the squad feed (P3)

### Tests (write first)

- [ ] T017 [P] [US5] `services/api/test/squad-post.test.ts`: `PUT /squad/posts/{date}` `{ photo: "remove" }` on a workout day → 200 and `GET /squad/feed` (as another member) lists one `workout_day` item with a `workout` block; posting twice → still one item with the same `createdAt`; hidden member → 403 `HIDDEN`; non-workout day → 404; `DELETE` → item gone from the feed but its reactions still counted on the member's timeline; a JPEG photo is stored and the feed item has `photoUrl`, a non-image body → 400
- [ ] T018 [P] [US5] In the same file: deleting the day's only gym entry removes the post and deletes its photo (via `refreshSquadStats`)

### Implementation

- [ ] T019 [US5] `services/api/src/lib/squad-repo.ts`: `FeedItem.postedAt?`, `photoKey?` (read in `toFeed`); `postDay(userId, date, nowIso, photoKey | null | "keep")` (one `UpdateCommand` upsert per research R11), `unpostDay(userId, date)`; `putFeed(item, { ifAbsent })`; mirror in `services/api/test/fakes.ts`
- [ ] T020 [US5] `services/api/src/lib/share-photo-store.ts` (`share-photos/<sub>/<date>.<ext>`, put/delete/urlFor) + `sharePhotos` in `Deps` and fakes; `reaction.ts` lazy create with `ifAbsent`
- [ ] T021 [US5] Handlers `squad-post-put.ts` (profile; `visibleTo`/leaderboard check → 403 `HIDDEN`; date ≤ today; workout day; photo via `sniffImage` ≤ 1.5 MB; old key deleted when replaced/removed) and `squad-post-delete.ts`; routes in `api-stack.ts` with a new `sharePhotos?: "read" | "readwrite" | "delete"` option (`readwrite` on post PUT/DELETE, `read` on `squad-feed-get`, `delete` on every function that calls `safeRefresh`: gym-entry-put/delete, entry-put/delete, gym-entry-confirm-put, me-squad-put, mcp, admin-exercise-merge-post); stack test asserts only the post route can `PutObject` on `share-photos/*`
- [ ] T022 [US5] `squad-stats.ts`: when deleting a `day#` item with `photoKey`, call `deps.sharePhotos?.delete(key)` (`StatsDeps` gains optional `sharePhotos`); make T018 pass
- [ ] T023 [US5] `squad-feed-get.ts` + `contracts/squad.ts`: include listed `workout_day` items, build `workout` with `buildShareSummary` (no steps/streak; own-exercise PRs dropped) from a per-author stats batch and that day's entries, sign `photoUrl`; make T017 pass
- [ ] T024 [US5] Web: `postShare(date, photo)` / `removePost(date)` Server Actions (photo reduced with `lib/photo-reduce.ts` from the oriented bitmap), sheet section "Post to squad feed" (+ "Also post this photo to your squad" checkbox when a photo is picked; disabled with the hidden message; "Posted to squad feed" + Remove post), `squad-feed.tsx` renders the workout card (photo, label, headline, rows, PRs, reactions) and `plain.ts` `feedLine` handles `workout_day`

---

## Phase 8: Own profile timeline + polish

- [ ] T025 Share button on the member's own timeline day cards (`apps/web/src/components/day-card.tsx` / `timeline.tsx`, only when `isYou`)
- [ ] T026 Update `CLAUDE.md` with a "Share a workout day (feature 016)" section (routes, items, rollout: deploy then `pnpm admin squad backfill`, never log photos/entries)
- [ ] T027 `pnpm check` and `pnpm synth` green; export sample images of each template (headless browser) for the summary

## Dependencies

Phase 2 → US1 → US2 → US3/US4 (parallel) ; US5 after Phase 2 + T005 (independent of the canvas work); T025 after US1.
