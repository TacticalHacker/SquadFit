# Data Model: Workout Tracker

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

DynamoDB single table from feature 001 (`pk`/`sk`). All items are keyed by the caller's Cognito `sub`; no new tables or indexes. The standard catalog is code, not data.

## Standard workout (code constant)

`STANDARD_WORKOUTS` in `packages/shared/src/domain/workouts.ts`. Values are in [research R1](research.md#r1-starter-catalog-lives-in-code-not-in-the-database).

| Field | Rule |
|---|---|
| `id` | `std-<slug>`: letters, digits, hyphens; unique; never reused or renamed once shipped |
| `name` | 1–40 chars; unique ignoring case |
| `defaultMinutes` | integer 1–600 |
| `defaultCalories` | integer 1–5,000 |

## Custom workout (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `WORKOUT#c-<uuid>` |
| `workoutId` | string | `c-<uuid>` (same value as in `sk`) |
| `name` | string | Trimmed, inner spaces collapsed, **1–40 chars** (FR-019). Unique among the user's non-removed workouts and the standard names, ignoring case (FR-020) |
| `defaultMinutes` | integer | **1–600** (FR-019) |
| `defaultCalories` | integer | **1–5,000** (FR-019) |
| `createdAt` / `updatedAt` | ISO datetime | |
| `removedAt` | ISO datetime? | Set when removed. Absent = active (FR-021, research R8) |

Only its owner can read or change it (FR-023). The standard catalog has no items and cannot be changed (FR-022).

## Workout entry (item)

| Attribute | Type | Rule |
|---|---|---|
| `pk` | string | `USER#<sub>` |
| `sk` | string | `ENTRY#<YYYY-MM-DD>#<workoutId>`, so one entry per user, workout and day (FR-006) |
| `date` | string | `YYYY-MM-DD`, the user's local calendar date when logged. Never changes (FR-015) |
| `workoutId` | string | `std-…` or `c-…` |
| `name` | string | Snapshot of the workout name at creation (FR-010) |
| `rateMinutes` | integer | Snapshot of the workout's `defaultMinutes` at creation |
| `rateCalories` | integer | Snapshot of the workout's `defaultCalories` at creation |
| `minutes` | integer | **1–600**, whole number (FR-007). Defaults to `rateMinutes` on tick |
| `calories` | integer | `round(rateCalories × minutes ÷ rateMinutes)` (FR-008), recomputed on every minutes change (FR-009) |
| `createdAt` / `updatedAt` | ISO datetime | |

**Write rules (server-enforced)**:
- `date` must not be after the caller's `today` (profile timezone, computed server-side) and must be `today`, `today−1` or `today−2` (FR-017). Otherwise: future → 400; older → 409 `DAY_LOCKED`.
- The workout must be a standard workout or one of the caller's non-removed custom workouts to **create** an entry; an existing entry can be edited or deleted even if its workout has since been removed.

### State transitions of one (user, workout, day) slot

```
            tick (PUT, no minutes)              set minutes (PUT {minutes})
 absent ─────────────────────────▶ present ─────────────────────────────▶ present
   ▲        creates with default       │   (recomputes calories from the entry's own rate)
   │                                    │
   └────────── untick (DELETE) ─────────┘
```
Tick on a present entry leaves it unchanged. Untick on an absent entry is a no-op. Untick then tick starts again from the default minutes (US3-3).

## Derived: day view and daily summary

Not stored. Built per request from the day's entries plus the checklist (`buildDayView` in shared):

- **Row** per checklist workout (standard in catalog order, then the user's non-removed custom workouts alphabetically by name, FR-002), carrying its entry if one exists.
- **Extra rows** for entries whose workout is no longer on the checklist (removed custom workout): shown ticked with `removed: true`, rate taken from the entry.
- **Summary**: `totalMinutes = Σ entry.minutes`, `totalCalories = Σ entry.calories` (sum of the rounded entry values). Zero for an empty day (FR-011, FR-013).
- `editable = isEditableDay(date, today)` (FR-017).

## Access patterns

| Pattern | Operation |
|---|---|
| Caller's timezone → `today` | `GetItem USER#<sub> / PROFILE` (feature 001) |
| One day's entries | `Query pk = USER#<sub>, sk begins_with "ENTRY#<date>#"` |
| A date range's entries (history strip, month) | `Query pk = USER#<sub>, sk BETWEEN "ENTRY#<from>" AND "ENTRY#<to>~"` |
| Caller's custom workouts | `Query pk = USER#<sub>, sk begins_with "WORKOUT#"` (filter out `removedAt`) |
| Tick (create) | `PutItem` with `attribute_not_exists(sk)`; already present → success, unchanged |
| Set minutes | `GetItem` the entry; if present `UpdateItem` (`attribute_exists(pk)`); if absent create with the given minutes, retrying as an update if another writer won the race |
| Untick | `DeleteItem` (idempotent) |
| Create / edit / remove custom workout | `PutItem` / `UpdateItem` (`attribute_exists`) / `UpdateItem` set `removedAt` |

## Shared schemas (`packages/shared`)

| Schema | Used by |
|---|---|
| `DateSchema` (`YYYY-MM-DD`, a real calendar date) | path/query validation on server, `?date=` in web |
| `EntryPutSchema` `{ minutes?: int 1–600 }` | `PUT /workouts/entries/{date}/{workoutId}` |
| `CustomWorkoutInputSchema` `{ name, defaultMinutes, defaultCalories }` | create/edit forms and API |
| `WorkoutRowSchema`, `DayViewSchema` | `GET /workouts` and every entry mutation |
| `CustomWorkoutSchema` | custom-workout responses and the "My workouts" screen |
| `SummaryRangeResponseSchema` `{ days: {date, totalMinutes, totalCalories}[] }` | `GET /workouts/summary` |

Privacy: none of these appear in `PeopleResponseSchema`, and no route returns another user's data (FR-024).
