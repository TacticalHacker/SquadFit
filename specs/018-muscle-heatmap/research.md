# Research: Daily Muscle Heatmap (018)

No `NEEDS CLARIFICATION` items were left in the Technical Context; the decisions below settle the open design points.

## R1. Where the load is computed

- **Decision**: In the browser, from the `GymView` the Gym tab already holds, with a pure function in `packages/shared/src/domain/muscle-map.ts` (`dayMuscleLoad`). No API, schema or storage change.
- **Rationale**: `GymView.exercises[].entry` already carries `exerciseId`, `muscleGroup` and `sets[].completed`/`reps` for the selected day, and `onSaved` already swaps in server-truth entries, so the figure follows saves for free (FR-010). The figure is the member's own display-only data, not a score, rank or streak, so constitution V (server-authoritative scoring) is not in play; the math is still shared, pure and tested (III).
- **Alternatives**: a `muscles` block on `GET /workouts/gym` (extra contract and handler work for data the client already has; would still need client recomputation for optimistic updates). Rejected.

## R2. Mapping storage and lookup

- **Decision**: A code table `MUSCLE_MAP: Record<builtInExerciseId, { primary: Region[]; secondary?: Region[] }>` covering every built-in strength exercise (R6), plus `GROUP_FALLBACK: Record<MuscleGroup, Region[]>` (spec FR-004). `musclesFor(exerciseId, group)` returns the table row when present, else `{ primary: GROUP_FALLBACK[group], secondary: [] }`.
- **Rationale**: Built-in ids never change (feature 006), so keying on id is stable. Admin catalog ids are also `gx-…` but are never in the table, so they fall back to their group (FR-003). Own (`gc-`) and orphaned entries use `entry.muscleGroup`. Nothing is stored, so the table can be refined later with no migration (spec Assumptions).
- **Alternatives**: adding mapping fields to catalog/own exercises (needs admin/member UI and data changes; out of scope by FR-003); name-based matching (fragile). Rejected.

## R3. What counts as a set

- **Decision**: Count `sets` where `completed && reps >= 1`, only for `exerciseKind === "strength"`. Weight is ignored (bodyweight counts). Jump-flagged sets count.
- **Rationale**: Matches the squad "completed set" rule (feature 010) and the spec Assumption; cardio has no muscle mapping (FR-004).

## R4. Intensity steps and colours

- **Decision**: `heatStep(score)`: `0` → none, `(0, 3)` → 1, `[3, 6)` → 2, `≥ 6` → 3. Colours are new derived tokens in `globals.css`, defined once for light and dark:
  - `--heat-0: var(--surface-2)` with outline `--line`
  - `--heat-1: color-mix(in oklab, var(--accent) 28%, var(--surface))`
  - `--heat-2: color-mix(in oklab, var(--accent) 60%, var(--surface))`
  - `--heat-3: var(--accent)`
  exposed as `--color-heat-0..3` in `@theme` so components use `fill-heat-1` etc.
- **Rationale**: The request asks for `--accent` scaled in 3 steps; `color-mix` keeps the single accent hue in both modes (dark amber in light, turmeric in dark) and keeps colours in `globals.css` only (CLAUDE.md theme rule). `--accent-soft` was considered for step 1 but in light mode (`#fff6dd`) it is too close to `--surface-2` (`#f1ede4`) to read as "worked". Percentages are tuned visually during implementation; the three steps must stay distinguishable in both modes.
- **Alternatives**: opacity on one fill (outlines and overlaps bleed through); `--accent-fill` (turmeric) in light mode (CLAUDE.md reserves solid fill for the primary CTA). Rejected.

## R5. Figure artwork and interaction

- **Decision**: Hand-written inline SVG (`components/muscle-figure.tsx`): an original, simple stylised outline per side (front, back) in one `viewBox` each, with one `<path>` per region (left and right halves share a region id and are drawn as one path with two sub-paths). Two figures side by side, about 112 px tall, inside a `cardClass` card. The neutral body silhouette is drawn under the regions in `--surface-2`/`--line`.
- **Interaction**: Worked regions are focusable (`tabIndex=0`, `role="button"`, `aria-label` = "Chest, 4 sets"); neutral regions get `pointer-events: none`. Hover/focus/tap selects a region; the detail is shown as **one line below the figures** inside the card ("Triceps · 2 sets · 4 indirect" + a `Show exercises` text button) rather than a floating tooltip. The line is reserved only while a region is selected. Escape, tapping the same region again or tapping outside the card clears it. The figure `<svg>`s have `role="group"` and the card an `aria-label` summary ("Worked: chest, triceps, front delts").
- **Rationale**: A detail line needs no positioning logic, works the same on touch and mouse, never covers the figure, and needs no extra library (VII). Touch has no hover, so tap is the primary path (CLAUDE.md).
- **Alternatives**: floating tooltip (positioning, clipping at 320 px, extra code); `BottomSheet` (too heavy for one line). Rejected.

## R6. Built-in exercise mapping (FR-002)

Side/lateral delts are not a separate region; they count toward **front delts** (the region visible from the front). Cardio built-ins have no row (none).

| Exercise id | Primary | Secondary |
|---|---|---|
| gx-bench-press | chest | front-delts, triceps |
| gx-incline-dumbbell-press | chest, front-delts | triceps |
| gx-cable-flyes | chest | front-delts |
| gx-chest-dips | chest, triceps | front-delts |
| gx-machine-chest-press | chest | front-delts, triceps |
| gx-machine-pec-fly | chest | front-delts |
| gx-flat-dumbbell-press | chest | front-delts, triceps |
| gx-dumbbell-fly | chest | front-delts |
| gx-dumbbell-pullover | chest, lats | triceps |
| gx-deadlift | hamstrings, glutes, lower-back | quads, traps, upper-back, forearms |
| gx-lat-pulldown | lats | biceps, upper-back, rear-delts |
| gx-barbell-row | upper-back, lats | rear-delts, biceps, lower-back |
| gx-seated-cable-row | upper-back, lats | rear-delts, biceps |
| gx-pull-ups | lats | biceps, upper-back, forearms |
| gx-t-bar-row | upper-back, lats | rear-delts, biceps, lower-back |
| gx-straight-arm-pulldown | lats | triceps |
| gx-single-arm-dumbbell-row | lats, upper-back | rear-delts, biceps |
| gx-dumbbell-bent-over-row | upper-back, lats | rear-delts, biceps, lower-back |
| gx-back-extension | lower-back | glutes, hamstrings |
| gx-barbell-squat | quads, glutes | hamstrings, lower-back |
| gx-leg-press | quads, glutes | hamstrings |
| gx-romanian-deadlift | hamstrings, glutes | lower-back, forearms |
| gx-leg-extension | quads | — |
| gx-hamstring-curl | hamstrings | calves |
| gx-calf-raises | calves | — |
| gx-overhead-press | front-delts | triceps, traps |
| gx-lateral-raises | front-delts | traps |
| gx-face-pulls | rear-delts | upper-back, traps |
| gx-rear-delt-flyes | rear-delts | upper-back |
| gx-front-raises | front-delts | — |
| gx-seated-dumbbell-shoulder-press | front-delts | triceps |
| gx-arnold-press | front-delts | triceps |
| gx-upright-rows | front-delts, traps | biceps |
| gx-barbell-curl | biceps | forearms |
| gx-hammer-curl | biceps, forearms | — |
| gx-tricep-pushdown | triceps | — |
| gx-skullcrushers | triceps | — |
| gx-ez-bar-curl | biceps | forearms |
| gx-wrist-curl | forearms | — |
| gx-reverse-wrist-curl | forearms | — |
| gx-incline-dumbbell-curl | biceps | — |
| gx-overhead-cable-extension | triceps | — |
| gx-single-arm-cable-pushdown | triceps | — |
| gx-hanging-leg-raises | abs | forearms |
| gx-cable-crunch | abs | — |
| gx-sit-ups | abs | — |
| gx-russian-twists | abs | — |
| gx-bicycle-crunches | abs | — |
| gx-palloff-press | abs | — |
| gx-bird-dog | lower-back, abs | glutes |
| gx-dead-bug | abs | — |
| gx-v-up | abs | — |

## R7. Region filter on the exercise list

- **Decision**: `gym-screen.tsx` gains `region: MuscleRegion | null` state. When set, the list is `exercisesForRegion(view.exercises, region)` (strength exercises whose `musclesFor` includes the region as primary or secondary; those with a completed set that day first, otherwise the existing order) and shows a removable chip "<Region> ×" above the list in place of the active pill state (pills render dimmed, like during a search). Choosing a pill, typing a search or changing day clears it (FR-013). The day check is `initialView.date !== seen.date` inside the existing `seen !== initialView` block, not the block itself: `onSaved` calls `router.refresh()`, which also delivers a new `initialView`, and a save must not drop the filter.
- **Rationale**: Reuses the existing dimmed-pills pattern and `chipClass(true)`; one state variable.
