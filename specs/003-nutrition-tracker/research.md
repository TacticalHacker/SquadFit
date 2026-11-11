# Research: Nutrition Tracker

Decisions for [plan.md](plan.md). Builds on [002's research](../002-workout-tracker/research.md) (R3 keys, R4 days, R5 optimistic UI, R6 rollover). No new dependencies or infrastructure.

## R1. Built-in food catalog lives in code

**Decision**: `STANDARD_FOODS` is a constant array in `packages/shared/src/domain/foods.ts`, 40 items with stable ids `sf-<slug>`, a name, a serving description, calories and protein/carbs/fat grams per serving. Own foods are DynamoDB items.

**Rationale**: Same as 002 R1: identical for everyone (FR-019), nothing to seed, searchable in the browser without a round trip, testable. Entries copy the values they were logged with (FR-008), so changing a catalog value later never alters past days.

**Alternatives considered**: DynamoDB seed items (a seed step per stage). An external nutrition API (out of scope; adds a dependency and failure mode).

**Values** (estimates for a typical serving; grams of protein / carbs / fat; a test checks calories are within 10% of 4P + 4C + 9F):

| id | Name | Serving | kcal | P | C | F |
|---|---|---|---|---|---|---|
| `sf-roti` | Roti / chapati | 1 medium | 100 | 3 | 18 | 2 |
| `sf-paratha` | Plain paratha | 1 medium | 200 | 4 | 28 | 8 |
| `sf-rice` | Steamed rice | 1 cup | 200 | 4 | 45 | 0.5 |
| `sf-dal` | Dal | 1 cup | 180 | 10 | 27 | 4 |
| `sf-rajma` | Rajma curry | 1 cup | 220 | 11 | 30 | 6 |
| `sf-chole` | Chole (chickpea curry) | 1 cup | 270 | 12 | 36 | 9 |
| `sf-paneer-curry` | Paneer curry | 1 cup | 350 | 14 | 10 | 28 |
| `sf-chicken-curry` | Chicken curry | 1 cup | 300 | 28 | 8 | 17 |
| `sf-biryani` | Chicken biryani | 1 plate | 450 | 25 | 55 | 14 |
| `sf-idli` | Idli | 2 pieces | 120 | 4 | 25 | 0.5 |
| `sf-dosa` | Plain dosa | 1 medium | 170 | 4 | 30 | 4 |
| `sf-masala-dosa` | Masala dosa | 1 piece | 300 | 6 | 45 | 10 |
| `sf-poha` | Poha | 1 cup | 250 | 5 | 42 | 7 |
| `sf-upma` | Upma | 1 cup | 230 | 5 | 34 | 8 |
| `sf-samosa` | Samosa | 1 piece | 260 | 4 | 28 | 15 |
| `sf-sambar` | Sambar | 1 cup | 130 | 6 | 18 | 4 |
| `sf-curd` | Curd (dahi) | 1 cup | 120 | 7 | 9 | 6 |
| `sf-lassi` | Sweet lassi | 1 glass | 200 | 6 | 32 | 5 |
| `sf-gulab-jamun` | Gulab jamun | 1 piece | 150 | 2 | 22 | 6 |
| `sf-chai` | Chai with milk and sugar | 1 cup | 90 | 2 | 14 | 3 |
| `sf-coffee-milk` | Coffee with milk | 1 cup | 50 | 2 | 5 | 2 |
| `sf-egg-boiled` | Boiled egg | 1 large | 70 | 6 | 0.5 | 5 |
| `sf-omelette` | Omelette | 2 eggs | 190 | 12 | 1 | 15 |
| `sf-oats` | Oats with milk | 1 bowl | 250 | 10 | 38 | 6 |
| `sf-bread` | Bread | 1 slice | 80 | 3 | 15 | 1 |
| `sf-peanut-butter` | Peanut butter | 1 tbsp | 95 | 3.5 | 3 | 7.5 |
| `sf-sandwich` | Veg sandwich | 1 sandwich | 250 | 8 | 38 | 8 |
| `sf-banana` | Banana | 1 medium | 105 | 1.2 | 24 | 0.4 |
| `sf-apple` | Apple | 1 medium | 95 | 0.5 | 23 | 0.3 |
| `sf-almonds` | Almonds | 10 pieces | 70 | 2.5 | 2.5 | 5.5 |
| `sf-milk` | Whole milk | 1 cup | 150 | 8 | 12 | 8 |
| `sf-chicken-breast` | Grilled chicken breast | 100 g | 165 | 31 | 0 | 4 |
| `sf-fish-grilled` | Grilled fish | 100 g | 130 | 22 | 0 | 4 |
| `sf-salad` | Mixed salad with dressing | 1 bowl | 120 | 2 | 10 | 8 |
| `sf-pasta` | Pasta with tomato sauce | 1 cup | 250 | 8 | 45 | 4 |
| `sf-pizza` | Pizza | 1 slice | 285 | 12 | 36 | 10 |
| `sf-burger` | Cheeseburger | 1 burger | 400 | 20 | 35 | 20 |
| `sf-fries` | French fries | 1 medium | 365 | 4 | 48 | 17 |
| `sf-protein-shake` | Protein shake | 1 scoop in water | 120 | 24 | 3 | 1.5 |
| `sf-soft-drink` | Soft drink | 1 can | 140 | 0 | 35 | 0 |

## R2. Servings math and rounding

**Decision**: Servings are multiples of 0.5 from 0.5 to 20 (`ServingsSchema`). For a list entry:
- `calories = Math.round(rateCalories × servings)` (half rounds up; rate calories are integers, so the product is a multiple of 0.5).
- Each macro: `Math.round(Math.round(grams × 10) × servings) / 10`, i.e. whole tenths of a gram first, so floating-point noise (1.3 × 1.5) cannot change the result. One decimal place.
- The result must stay within 1 to 5,000 kcal (FR-003); otherwise 400 with the servings field message.

**Rationale**: One pure, easily tested function pair used by the server and the optimistic client. Day totals are sums of the stored, already rounded entry values, so the screen always adds up (SC-003, SC-009). Macro sums are also done in whole tenths.

**Alternatives considered**: Storing floats and rounding only on display (totals may not equal the sum of what is shown). Free-form servings (spec fixed half steps).

## R3. Entry storage: a snapshot per entry, source decides editing

**Decision**: Entries are items `USER#<sub>` / `FOODLOG#<date>#<entryId>` with `entryId = <epoch ms, 13 digits>-<6 hex>`. The id sorts by time added, so one `begins_with(FOODLOG#<date>#)` Query returns a day in the order added (FR-007), and the same food can be logged repeatedly (FR-005). Each entry stores `source` (`typed` | `standard` | `own`), `foodId?`, `name`, `servingLabel?`, `servings`, a per-serving `rate` snapshot, the computed `calories` and `macros` (all three or none), `meal`, `date`, timestamps.

- `typed`: servings fixed at 1, rate = the typed values; name, calories, macros, meal editable.
- `standard` / `own`: only servings and meal editable; calories and macros are recomputed from the entry's own rate snapshot (clarification Q2), so editing never needs the food to still exist (FR-008).

**Rationale**: Mirrors 002 R3 and R2 (snapshot, no dependency on the live workout/food). A time-sortable id avoids a GSI and gives ordering for free.

**Alternatives considered**: Key by `meal` (loses cross-meal order, makes moving a meal a delete + put). A counter item for ordering (extra write and contention). Random UUID ids with a sort attribute (needs a sort in the handler for no gain).

## R4. Macros are all-or-none

**Decision**: An entry or own food has either all three macros or none (`macros: { protein, carbs, fat } | null`). If a user fills in some macro fields on a typed entry, the blanks count as 0 and all three are stored; leaving all blank stores none. Each is 0 to 500 g with one decimal.

**Rationale**: Keeps "entries without macros" a simple count for the ledger note (FR-025) and avoids partial-sum ambiguity. It matches the spec's wording: entered values are saved, blank means no macro values.

**Alternatives considered**: Independent nullable fields (three counts of missing values; a confusing note).

## R5. Day ledger is derived on read

**Decision**: `buildFoodDay` computes, from the day's food entries, the day's workout entries and the profile target: per-meal calorie subtotals, `eaten`, `burned` (the sum of workout entry calories, via 002's `summarize`), `net = eaten − burned`, `remaining = target − net` (negative means over, FR-010 and clarification Q3), and macro totals with `entriesWithoutMacros`. Nothing is stored.

**Rationale**: A single source for the numbers; `burned` always equals the Workouts screen's total for that day (SC-007) because both come from the same entries. Costs two Queries and one Get per request.

**Alternatives considered**: Storing a daily summary item (a second write path that can drift).

## R6. Recent foods are derived, not stored

**Decision**: `GET /food/recent` runs one range Query over the last 90 days of the user's `FOODLOG#` items (`today−89` to `today`), then `recentFoods(entries, 20)` (pure) keeps the latest entry per normalized name (trimmed, inner spaces collapsed, lower-cased), orders by date then entry id descending, and returns name, calories and macros. "Last 90 days" is by the entry's logged-for date, not the time it was typed. It is called only when the add panel needs it, not on every day view.

**Rationale**: FR-022 and FR-023 with no extra table or maintenance; at about 15 entries a day, 90 days is at most about 1,400 small items. Choosing a recent food adds a typed entry (clarification Q5), so the result does not need food ids.

**Alternatives considered**: A `RECENT` item per user updated on every write (extra write per log, can go stale after edits). Client-only history (lost between devices).

## R7. Own foods

**Decision**: Items `USER#<sub>` / `FOOD#f-<uuid>` with name, serving, calories, optional macros. Hard delete is safe because entries keep their own snapshot. Name uniqueness among the user's own foods is checked on write by comparing normalized names against the user's own list (no lock item, the 002 R7 approach). A name matching a built-in food is allowed (spec edge case).

**Alternatives considered**: Soft delete (needless: no entry depends on the item).

## R8. Day boundaries, edit window and meals

**Decision**: Reuse 002's `localDate`, `addDays`, `isEditableDay`, `EDIT_WINDOW_DAYS`, `loadDayContext`, `resolveReadDate`, `resolveWriteDate` unchanged. `loadDayContext` also returns the profile's `dailyCalorieTarget`. The meals are the fixed enum `breakfast | lunch | dinner | snacks`. The default meal for the add form comes from `defaultMealForHour(hour)` (hour < 11 breakfast, 11 ≤ hour < 15 lunch, 15 ≤ hour < 18 snacks, hour ≥ 18 dinner), shown only for today; the hour is the user's local hour in the profile timezone, from the browser clock for display only. Nothing authoritative depends on it.

**Rationale**: One rule for both trackers (spec assumption), and the server stays the authority on "today" and the window (constitution V).

## R9. Optimistic UI

**Decision**: Same pattern as 002 R5. Pure `applyFoodChange(view, change)` in `shared`, with changes `add` (carrying a client-made entry with a temporary id and the same `entryFromFood` math), `update` and `remove`. The client holds the server's view in state, overlays `useOptimistic`, calls a Server Action in a transition and replaces the view with the action's result (the server assigns real ids and recomputes). Entries with a temporary id cannot be edited until the real view arrives. Failure restores the view and shows "Couldn't save. Try again." On `DAY_LOCKED` or `NOT_FOUND` the page is refreshed with a short notice.

**Alternatives considered**: Waiting for the server before showing anything (misses SC-001). A client cache library (no new dependencies, plan constraint).

## R10. API surface and error codes

**Decision**: Nine routes, all JWT-protected (see [contracts/api.md](contracts/api.md)): `GET /food`, `POST|PUT|DELETE` entries, `GET /food/recent`, and `GET|POST|PUT|DELETE` own foods. Reused error codes: `VALIDATION_FAILED`, `PROFILE_REQUIRED`, `DAY_LOCKED`, `DUPLICATE_NAME`, `NOT_FOUND`. No new codes.

## R11. Testing approach

**Decision**: Test-first domain tests in `packages/shared/test` (servings math and rounding, catalog invariants including the 10% energy check, `buildFoodDay`, `applyFoodChange` equivalence with a server rebuild, `recentFoods`, `defaultMealForHour`). Handler tests with `InMemoryFoodRepo` and a fixed clock (window edges, privacy, burned equals the workout total, own-food rules). CDK assertions for the nine routes. Web pure helpers (food amount parsing) in `apps/web/src/lib` with Vitest. Manual [quickstart.md](quickstart.md) on `dev`.

## R12. UI composition

**Decision**: `/food` (day view: ledger card, four meal sections, add panel with Search / Quick entry tabs, inline edit) and `/food/mine` (own foods). `DayNav` is generalised with a `basePath` prop and an optional streak so Workouts and Food share it. A **Food** link is added to the navigation. The dark card style from the workouts redesign is reused; no new design system.
