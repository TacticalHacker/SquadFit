# Data Model: Nutrition Tracker

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Same DynamoDB single table as 001 and 002 (`pk`/`sk`). All items are keyed by the caller's Cognito `sub`; no new tables or indexes. The standard food catalog is code, not data.

## Standard food (code constant)

`STANDARD_FOODS` in `packages/shared/src/domain/foods.ts`; values in [research R1](research.md#r1-built-in-food-catalog-lives-in-code).

| Field | Rule |
|---|---|
| `id` | `sf-<slug>`: letters, digits, hyphens; unique; never reused or renamed once shipped |
| `name` | 1-60 chars; unique ignoring case and spacing |
| `serving` | 1-40 chars, e.g. "1 cup" |
| `calories` | integer 1-5,000 per serving |
| `protein`, `carbs`, `fat` | numbers 0-500 with at most one decimal, per serving (all present for built-in foods) |

## Own food (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `FOOD#f-<uuid>` |
| `foodId` | string | `f-<uuid>` (same as in `sk`) |
| `name` | string | Trimmed, inner spaces collapsed, **1-60 chars**. Unique among the user's own foods ignoring case and spacing (FR-021). May equal a built-in name |
| `serving` | string | **1-40 chars** |
| `calories` | integer | **1-5,000** per serving |
| `macros` | map? | `{ protein, carbs, fat }`, each **0-500** with at most one decimal, **all three or absent** (research R4) |
| `createdAt` / `updatedAt` | ISO datetime | |

Only its owner can read or change it (FR-023). Removing an own food deletes the item; entries already logged keep their snapshot (FR-008).

## Food entry (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `FOODLOG#<YYYY-MM-DD>#<entryId>` where `entryId = <13-digit epoch ms>-<6 hex>`; sorts by time added (FR-007) |
| `entryId` | string | The `<entryId>` part of `sk` |
| `date` | string | `YYYY-MM-DD`, the user's local calendar date it was logged for. Never changes (FR-015) |
| `meal` | string | `breakfast` \| `lunch` \| `dinner` \| `snacks` |
| `source` | string | `typed` \| `standard` \| `own` |
| `foodId` | string? | Present when `source` is `standard` (`sf-…`) or `own` (`f-…`) |
| `name` | string | **1-60 chars** snapshot. Typed entries: editable. List entries: the food's name at the time, not editable |
| `serving` | string? | Snapshot of the serving description for list entries |
| `servings` | number | **0.5-20 in steps of 0.5** for list entries; always **1** for typed entries |
| `rate` | map | Per-serving snapshot `{ calories, macros? }`. For typed entries it equals the entered totals |
| `calories` | integer | **1-5,000**. List entries: `round(rate.calories × servings)` (FR-003); typed: as entered |
| `macros` | map? | `{ protein, carbs, fat }` in grams with one decimal, **all three or absent**. List entries: `round(round(g×10) × servings) / 10`; typed: as entered |
| `createdAt` / `updatedAt` | ISO datetime | |

**Write rules (server-enforced)**
- `date` must not be after the caller's `today` and must be `today`, `today−1` or `today−2` (FR-017, same as workouts): future → 400, older → 409 `DAY_LOCKED`.
- Creating from a built-in food needs a valid `sf-` id; from an own food, one of the caller's own foods (otherwise `404 NOT_FOUND`).
- Editing: a typed entry may change `name`, `calories`, `macros`, `meal`; a list entry may change `servings` and `meal` only. Anything else for that source is `400`. Calories and macros of a list entry are always recomputed from its own `rate`.
- An entry never moves to another date.

## Derived: day view and ledger

Computed on read by `buildFoodDay` (shared), never stored.

```
meals[meal]   = entries of that meal in the order added, subtotal.calories
eaten         = Σ entry.calories
burned        = Σ calories of that day's workout entries   (002 data, same user)
net           = eaten − burned
target        = profile.dailyCalorieTarget (as it is now)
remaining     = target − net        (negative = over the target)
macros        = Σ over entries that have macros (whole tenths); entriesWithoutMacros = count of entries with none
editable      = isEditableDay(date, today)
```

## Derived: recent foods

`recentFoods(entries, 20)`: over the last 90 days' entries, one item per normalized name, taking the latest entry (by date, then entry id); returns `{ name, calories, macros? }`. Not stored (research R6).

## Access patterns

| Need | Query |
|---|---|
| One day's entries | `Query pk = USER#<sub>, sk begins_with "FOODLOG#<date>#"` |
| Last 90 days (recent foods) | `Query pk = USER#<sub>, sk BETWEEN "FOODLOG#<today−89>" AND "FOODLOG#<today>~"` |
| One entry | `GetItem pk, sk = FOODLOG#<date>#<entryId>` |
| Create / delete entry | `PutItem` (condition `attribute_not_exists(sk)`) / `DeleteItem` (idempotent) |
| Edit entry | `UpdateItem` with condition `attribute_exists(pk)` |
| Own foods | `Query pk = USER#<sub>, sk begins_with "FOOD#"` (does not match `FOODLOG#`) |
| Burned calories for a day | the workout repo's `Query … begins_with "ENTRY#<date>#"` (feature 002) |
