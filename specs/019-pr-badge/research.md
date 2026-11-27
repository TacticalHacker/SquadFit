# Research: Live PR Badge (019)

## R1. One PR definition, in `domain/squad.ts`

- **Decision**: Add a pure `classifySet(bests, set)` → `{ type: "weight" | "reps" | "e1rm", value, previous, gain } | null` plus `pickTopPr(candidates)` to `packages/shared/src/domain/pr.ts`, and make `walkLift` (`squad.ts`) call them for every eligible set of a day against the bests *before* that day. The drawer calls the same functions. Order: weight > reps > e1rm, then the larger gain (kg for weight/e1rm, reps for reps), then the earlier set.
- **Rules**: weight PR = `w > bestWeight.w`. Rep PR = `w ≥ 0.8 × bestWeight.w` and `r > maxRepsAtOrAbove(w)` (a frontier lookup; when no history set is at `≥ w` it is already a weight PR). e1RM PR = `e1rm(w, r)` (existing helper, 1–10 reps) `> bestE1rm`. Baseline: no counted history → never a PR. Strict `>` everywhere (ties don't count). Server-side eligibility is unchanged: `isWorkingSet` (completed, reps ≥ 1, weight > 0) and the jump exclusion (`suspicious`, `JUMP_RATIO` 1.5 / `JUMP_MIN_KG` 20, `jumpConfirmedAt`, `trustedBefore`).
- **Rationale**: Clarification Q1 asks for one set of rules everywhere. Putting the comparison in one pure module used by both the server walk and the device makes SC-004 (badge = stored PR) true by construction. The existing day-level PR (`prDays`, feed `pr#<id>#<date>`, at most one per exercise per day) stays; its shown set becomes the top record instead of "estimate first".
- **Alternatives**: a separate badge-only rule set (rejected by Q1); computing PRs on the device and sending them on save (violates constitution V, server-authoritative).

## R2. Where the drawer gets its bests

- **Decision**: `refreshSquadStats` already walks the member's full history on every gym write. `walkLift` also records a compact `PrBests` snapshot (`sessions`, `bestWeight {weightKg, reps, date}`, `bestE1rm`, `frontier: {weightKg, reps}[]`) **before each of the exercise's latest 3 entry dates** (`GYM_LAST_KEEP`) plus `all` (everything). These are stored as `SQUADSTATS.lifts[id].prBase = { all, before: { [date]: PrBests } }`. `loadGymView` already reads `SQUADSTATS` (`flaggedOn`), so it reuses that read and adds `bests: PrBests | null` to each `GymExerciseView` through `bestsBefore(prBase, date)`.
- **Why the latest 3 dates are enough**: only editable days (today, −1, −2) need a badge. Entries dated on or after an editable day D are at most 3, and they are the exercise's newest entries, so they are all in the kept set. `bestsBefore(D)` = `before[D]` when D has an entry; otherwise `before[next kept date after D]` (no entry lies between D and it); otherwise `all` when D is after every entry; otherwise `null` (unknown, which only happens for locked days).
- **Frontier**: the non-dominated `(weight, reps)` points of the counted history (weight descending, reps strictly increasing), so `maxRepsAtOrAbove(w)` = the reps of the lightest point with `weightKg ≥ w`. Its size is bounded by the number of distinct weights a member has used at a new rep high, typically under 15 points. Item-size check: ~60 lifts × 4 snapshots × ~15 points ≈ 30 KB, well inside 400 KB.
- **`null` cases**: missing stats, stats written before this feature (until the next write or the backfill), the 15-minute gap after an MCP write that failed `safeRefresh`. `null` = no badge and no "Baseline set" (normal line), never a wrong badge.
- **Alternatives**: a `gsi1` query of the exercise's whole history on drawer open (an extra request; violates FR-009); bests in `GYMLAST` (that item is built by `buildGymLastIndex` without the jump/trust walk, so it would disagree with the server's eligibility); storing every day's bests (unbounded).

## R3. Stored PR records

- **Decision**: no new item type. Extend `PrDay` (`SQUADSTATS.lifts[id].prDays`) with `type`, `previous`, `gainReps`, `setIndex` and `records: PrRecord[]` (every PR set that day, top first). The top-level fields stay those of the top record, so `member-view.ts` (profile PR board), `share-card.ts` and the feed keep working. `prDays` is already rebuilt from full history on every write, merge, confirm and delete (FR-016/019) and backfilled.
- **Rationale**: constitution VII. The spec's "personal_records table" columns map 1:1 onto `PrRecord` + the stats item key (`USER#<sub>`, lift id). `achieved_at` = the entry's `updatedAt` (when the member logged it).
- **Alternatives**: separate `PR#<exerciseId>#<date>#<set>` items (extra writes and deletes on every refresh, plus a diff, for no reader in this feature).

## R4. Feed and wording for Rep PRs

- **Decision**: the feed payload gains `type` and `gainReps` (`SquadFeedItemSchema.pr`, both `.nullable().default(null)` so old items parse). `plain.ts` gets `prBadgeText`, `prAnnounce`, `prToast` and the feed's Rep PR line ("80 kg × 10 (+2 reps)"). Share cards read `prDays` and so include Rep PRs (consistent with Q1; their copy uses `sharePrValue`, which shows "80 kg × 10" with no kg gain).
- **Backfill**: `pnpm admin squad backfill` (`seed: true`) adds historical Rep PR event ids to `seededEventIds`, so no old Rep PR posts. Existing PR items whose shown set changes (estimate → weight first) are updated in place by the diff (`updateFeed`), keeping reactions.

## R5. Save result and toast

- **Decision**: `GymSaveResult` gains `prs: number` (records on that date for that exercise, after the refresh; a held jump isn't counted) and `streakWeeks: number` (`streakFigures(...).current`). `loadGymSaveResult` already reads `SQUADSTATS` after `saveGymEntry` awaited `safeRefresh`. If the refresh failed, `prs` is 0 (the toast shows no PR rather than a wrong one).
- **Toast**: new `components/toast.tsx` (one `role="status"` region in `GymScreen`, fixed above the bottom nav, `pointer-events-none` except the toast itself, closes on tap or after 3 s). The drawer still closes on save, so the existing "Unusual jump" note + **Looks right** appear on the next open, as today (spec Story 2 scenario 4).

## R6. Haptics, motion, announcement

- **Haptic**: computed in the event handler, not in an effect: the drawer's `dispatch` runs `previewPr(bests, drawerReducer(s, action))` and compares the new top-PR key (`setIndex:type:value`) with the shown one. Android: `navigator.vibrate?.([15, 40, 15])`. iOS: a visually hidden `<label><input type="checkbox" switch></label>` in the drawer; `label.click()` inside the same tap handler gives one system tick on iOS 18+ Safari; elsewhere it's a no-op. Feature-detect via `"vibrate" in navigator`; no user-agent sniffing. Not fired for a restored draft on open.
- **Motion**: opacity + background colour transition (~200 ms); `globals.css` already zeroes transitions under `prefers-reduced-motion`, so the fade is "plain". No scale (theme rule).
- **Announcement**: the footer line is already `aria-live="polite"`; the badge text replaces it, and a separate visually hidden polite region receives `prAnnounce` only when the PR key changes, so stepping the same PR set doesn't repeat it.

## R7. Unticked sets in the preview

- **Decision**: `previewPr` counts sets with `reps ≥ 1` and `weightKg > 0`, ticked or not (spec edge case); the server counts completed sets only. The badge shows for a set as soon as its numbers are typed.
