# Research: Gym Set Logger

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

No `NEEDS CLARIFICATION` items remained after `/speckit-clarify` (5 answers, see spec Clarifications). The decisions below settle the design questions the spec left to planning.

## R1. A gym entry is a workout entry item (same key space as feature 002)

- **Decision**: Store each gym entry as an `ENTRY#<date>#<exerciseId>` item in the caller's partition, exactly where feature 002 keeps workout entries, with the same `minutes`/`calories` attributes plus `kind: "gym"` and the gym fields (sets, volume, muscle group, exercise kind).
- **Rationale**: Every existing reader of the day's workout totals already queries `ENTRY#<date>#…` and sums `minutes`/`calories`: the day summary (`buildDayView`), the 7-day strip and streak (`GET /workouts/summary`), the food ledger's `burned` (`loadFoodDay`) and the AI history tool. Putting gym entries in the same key space makes FR-015 (counts once, everywhere) true by construction, with no second query to forget.
- **Alternatives considered**: A separate `GYM#<date>#…` item family, which would need every total (four places today, the leaderboard later) to query and add two families; rejected because a missed reader silently under-counts. A single "Strength training" entry holding all exercises of the day, rejected because FR-017 wants one entry per exercise and FR-025 keeps Strength training separate.

## R2. Exercise ids never collide with workout ids

- **Decision**: Built-in exercise ids are `gx-<slug>` (code constant `GYM_EXERCISES`); a member's own exercise ids are `gc-<uuid>`. Workout ids stay `std-…` / `c-…`. `isGymId(id)` = starts with `gx-` or `gc-`.
- **Rationale**: Ids are the `sk` suffix of entries; distinct prefixes keep one entry per (member, exercise, day) (FR-017) without any clash with a workout of the same name, and let the existing `PUT /workouts/entries/{date}/{workoutId}` reject gym ids (404) so minutes can't be edited behind the sets' back (FR-014).
- **Alternatives considered**: Re-using the `std-`/`c-` namespace with a `kind` flag only, rejected: an ID-based route guard is simpler than loading the item first.

## R3. Totals formula lives in one pure function

- **Decision**: `gymTotals(sets)` in `packages/shared/src/domain/gym.ts`: `volumeKg = round1(Σ reps × weightKg)`, `minutes = round_half_up(sets × 2.5)`, `calories = sets × 15`. Cardio: `minutes` as entered, `calories = caloriesFor(rateMinutes, rateCalories, minutes)` (the 002 function). The web footer, the server write, and tests all call it (constitution III, V).
- **Rationale**: FR-013/FR-014 require the footer to match what the server stores; the 002 pattern (`buildDayView`/`applyChange` shared by server and optimistic client) is already proven.
- **Rounding**: `round_half_up(n × 2.5)` equals `Math.round(n * 2.5)` for positive `n` (exact in binary since 2.5 = 5/2). Volume is computed in tenths of a kg on integers (`Σ reps × round(weightKg × 10)` ÷ 10) to avoid float drift (weights are multiples of 0.5).
- Worked examples (become tests): 3×(80 kg×8) → 1,920 kg / 8 min / 45 kcal; 5×(60×5) → 1,500 / 13 / 75; 1 set → 3 min / 15 kcal; 4×(0×12) → 0 / 10 / 60; 2×(62.5×7) → 875 / 5 / 30.

## R4. Cardio rates

- **Decision**: Incline Treadmill Walk `20 min / 140 kcal` (7 kcal/min); Stairmaster `20 min / 180 kcal` (9 kcal/min). Stored as an entry rate snapshot (`rateMinutes`, `rateCalories`) like 002, so later rate changes never alter past days.
- **Rationale**: Common MET tables put incline walking at ~6–8 and stair climbing at ~8–10 kcal/min for a ~70 kg adult, the same reference body the 002 catalog uses.
- **Own exercises**: always strength (sets). A member who wants a custom cardio machine uses feature 002's own workouts (minutes-based) instead. Keeps FR-005's form to name + group.

## R5. "Last" pre-fill: per-exercise GSI, fetched with the gym view

- **Decision**: Each gym entry also sets `gsi1pk = GYM#<sub>#<exerciseId>`, `gsi1sk = <date>`. `GET /workouts/gym?date=D` returns, for every exercise in the member's list, the most recent entry with `date < D` via a `Query gsi1pk, gsi1sk < D, ScanIndexForward=false, Limit=1`, run in parallel (≤ 30 built-in + ≤ 50 own = 80 tiny reads).
- **Rationale**: The drawer must open instantly with values already in place (SC-001); a pre-fill that loads after opening would change numbers under the member's thumb. Expected scale is ~3 members, so 80 single-item reads per page load are negligible. No new index: `gsi1` already exists (projection ALL), and its existing `COMMUNITY` partition never starts with `GYM#`.
- **Alternatives considered**: (a) Fetch on drawer open via a Server Action: simpler server, but a visible delay or late value swap in the drawer; rejected for UX. (b) A denormalised `LAST#<exerciseId>` pointer item updated on save: goes stale when a back-dated entry is saved or the latest is removed, needs recompute logic; rejected (VII). (c) Read the last 180 days of `ENTRY#` items and pick per exercise: unbounded item counts and reads every workout too; rejected.
- Save/remove responses do not repeat the fan-out (they return `GymSaveResult`, contracts/api.md), so writes stay one put + one day query.
- Only exercises the member has logged before return a `last`; the GSI query cost for never-logged exercises is one empty read each. If page latency is ever a problem, (a) is the fallback.

## R6. "Last: 80kg × 8" choice of set

- **Decision**: `topSet(sets)` = max `weightKg`, ties → max `reps`, then lowest `setNumber`. `0 kg` renders `BW`. Pure, tested in shared.

## R7. Drawer state machine is shared, pure and client-side

- **Decision**: `packages/shared/src/domain/gym-drawer.ts` exports `initDrawer(...)` and `drawerReducer(state, action)` with actions `setCount±`, `defaultReps±/set`, `weight±/set`, `reps±/set`, `toggleDone`, `minutes±/set` (cardio). Each row carries `repsEdited: boolean` (FR-010); Sets + copies the last row including its `repsEdited` (spec clarification of FR-010). Bounds: sets 1–20, reps 1–100, default reps 1–100, weight 0–500 in 0.5 steps, minutes 1–600.
- **Rationale**: Constitution III (test-first domain logic) and makes the steppers trivially unit-testable without a DOM.

## R8. Drafts in `localStorage`

- **Decision**: Key `sf:gymdraft:v1:<username>:<date>:<exerciseId>` → JSON `{ savedAt, baseUpdatedAt, state }`, validated with a zod schema on read (bad JSON → dropped). Written (debounced 300 ms) on every reducer change once the state differs from its initial value; removed on Save success, Remove, Discard draft. On Gym tab load, drafts for dates outside `today-2..today` (server's `today`) are deleted (FR-023). `baseUpdatedAt` is the saved entry's `updatedAt` when the draft started; if the loaded entry's `updatedAt` differs, the drawer shows "A saved version also exists" (spec edge case).
- **Rationale**: Survives screen lock / tab discard on iOS Safari and Android Chrome (both persist `localStorage`); no server writes until Save, as clarified. `username` (from `getMe()`, unique per member; the web never sees the Cognito `sub`) in the key prevents a draft leaking between members on a shared phone. `sessionStorage` was rejected: iOS may discard the tab, losing it.
- Drafts hold no data that isn't the member's own and never leave the device.

## R9. Bottom sheet: hand-built, no library

- **Decision**: A `BottomSheet` client component using a native `<dialog>` opened with `showModal()` (focus trap, Escape, inert background, `::backdrop`), styled `fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl flex flex-col`, header / `overflow-y-auto overscroll-contain` body / footer with `pb-[env(safe-area-inset-bottom)]`. Slide-up via a CSS transition on `translate-y`. Drag-to-close with Pointer Events on the handle + header only (close when dragged > 25% of height or released with downward velocity > 0.5 px/ms); body scroll is untouched. Body scroll lock while open (`overflow: hidden` on `<html>`). Respects `prefers-reduced-motion`.
- **Rationale**: Constitution VII prefers platform primitives; `<dialog>` gives accessibility for free. Using `dvh` (not `vh`) keeps the footer visible when Safari's toolbar or the keyboard is shown; `interactive-widget=resizes-content` in the viewport meta makes Chrome Android shrink the layout for the keyboard like iOS.
- **Alternatives considered**: `vaul` (drawer library): good gestures but a new dependency for one component; rejected under VII, revisit if gestures prove poor on device.

## R10. Mobile input rules (FR-007, FR-008)

- Stepper buttons: `min-h-11 min-w-11` (44 px) `touch-manipulation select-none`, `aria-label` ("Increase set 2 weight").
- Typed fields: `<input type="text" inputMode="decimal" | "numeric" enterKeyHint="done" className="text-base">` (16 px stops iOS zoom); `pattern` not used for validation, parsing goes through shared `parseWeight` / `parseReps` (accept `,` as decimal separator; weight must be a multiple of 0.5 in 0–500; reps whole 1–100). Invalid → inline message and revert to previous value (spec US2-6).
- Pill bar: `sticky top-0 z-10 flex gap-2 overflow-x-auto no-scrollbar snap-x` with a `no-scrollbar` utility added to `globals.css` (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`); the page itself gets `overflow-x-clip` so only the bar scrolls (SC-005).

## R11. Where the Gym tab lives

- **Decision**: New route `/workouts/gym` (Server Component page) with a shared `WorkoutsTabs` switch ("Activities | Gym") rendered under the existing `DayNav` on both `/workouts` and `/workouts/gym`; `?date=` is carried across tabs. The Activities tab renders gym entries in its "Logged today" list (name, sets · volume) linking to `/workouts/gym?date=D&open=<exerciseId>`, and shows the FR-025 hint on Strength training.
- **Rationale**: Clarification 2. Separate route keeps each page's data fetch small and lets "open" be a URL param so the Activities list can deep-link into a drawer.

## R12. Day view gains `gym`, summary unchanged in meaning

- **Decision**: `buildDayView` splits stored entries by `kind`: workouts go to `rows` as before; gym entries go to a new `gym: GymEntryView[]` (sorted by `createdAt`) and are excluded from the "removed workout" extra rows. `summary` sums both. `DayViewSchema` gets `gym` (default `[]` on parse for old clients) and `gymMinutes` for the hint.
- **Rationale**: Without the split, gym entries would appear as phantom "removed" workout rows (current `buildDayView` behaviour for unknown ids).

## R13. AI history (FR-024)

- **Decision**: `get_user_history` workout items gain, for gym entries, `{ kind: "gym", muscleGroup, sets: [{ set, reps, kg, done }], volumeKg }` (cardio gym entries: `kind: "gym", muscleGroup: "cardio"`, no sets). Existing fields (`name`, `minutes`, `calories`) are unchanged so prompts that read them keep working. Description string mentions gym sets.

## R14. Concurrency

- **Decision**: Gym save is a full replace: `PutItem` of the entry (no condition) after server-side recompute. Last writer wins, which is the 002 behaviour for minutes edits; the draft note (R8) covers the multi-device case. Remove is an idempotent `DeleteItem`.
- **Rationale**: One member, one exercise, one day: conflicting writes need two of the member's own devices at once; a conditional write would add a 409 path with little value.
