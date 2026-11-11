# Contract: HTTP API additions (AWS, `services/api`)

Same conventions as [001's API contract](../../001-user-accounts/contracts/api.md): base URL `API_URL`, only the Next.js server calls it, every route requires `Authorization: Bearer <access token>` (JWT authorizer), the caller comes from verified claims, errors use `{ "error": { "code", "message", "fields?" } }`.

**Every route below** first loads the caller's profile and returns **`409 PROFILE_REQUIRED`** if there is none (FR-003), and computes `today` from the profile's timezone using the server clock (research R4). Dates are `YYYY-MM-DD` strings. Request bodies are never logged.

New error codes (added to `ApiErrorCodeSchema`):

| Code | HTTP | When |
|---|---|---|
| `DAY_LOCKED` | 409 | A write targets a day older than `today−2` (FR-017). Message: "This day can no longer be edited" |
| `DUPLICATE_NAME` | 409 | Custom workout name clashes with the caller's other workouts or a standard one (FR-020). Message: "You already have a workout with that name" |
| `NOT_FOUND` | 404 | Unknown workout id, or a custom workout that isn't the caller's or is removed (when creating an entry) |

Existing codes reused: `VALIDATION_FAILED` (400; also a date after `today` or a malformed date or range), `PROFILE_REQUIRED` (409).

---

## Day view (response shape used by the routes below)

```json
{
  "date": "2026-11-11",
  "today": "2026-11-11",
  "timezone": "Asia/Kolkata",
  "editable": true,
  "rows": [
    {
      "workoutId": "std-running",
      "name": "Running",
      "isStandard": true,
      "removed": false,
      "defaultMinutes": 30,
      "defaultCalories": 300,
      "entry": { "minutes": 45, "calories": 450, "rateMinutes": 30, "rateCalories": 300 }
    },
    {
      "workoutId": "std-yoga", "name": "Yoga", "isStandard": true, "removed": false,
      "defaultMinutes": 30, "defaultCalories": 90, "entry": null
    }
  ],
  "summary": { "totalMinutes": 45, "totalCalories": 450 }
}
```

`rateMinutes`/`rateCalories` are the rate snapshot the entry was logged with (FR-010); the client uses them so its optimistic calories match the server.

Rows: standard workouts in catalog order, then the caller's active custom workouts A→Z, then any entries whose custom workout was removed (`removed: true`, defaults taken from the entry's own rate).

---

## `GET /workouts?date=YYYY-MM-DD`

`date` is optional and defaults to `today`. Must not be after `today`.

`200` day view. `400 VALIDATION_FAILED` for a malformed date or a date after `today`.

## `PUT /workouts/entries/{date}/{workoutId}`

Tick, or change the minutes of, one workout on one day. Idempotent.

Body (optional): `{ "minutes": 45 }`, a whole number 1–600.

| Situation | Result |
|---|---|
| No entry, no `minutes` | Creates it with the workout's default minutes and calories (tick) |
| No entry, with `minutes` | Creates it with those minutes; calories = `round(defaultCalories × minutes ÷ defaultMinutes)` |
| Entry exists, no `minutes` | Unchanged (already ticked) |
| Entry exists, with `minutes` | Updates minutes; calories recomputed from the **entry's own** rate snapshot |

`200` day view for `{date}`. Errors: `400` (bad date, date after `today`, `minutes` out of range with `fields.minutes` = "Minutes must be a whole number from 1 to 600"), `409 DAY_LOCKED`, `404 NOT_FOUND` (cannot create an entry for an unknown or removed workout).

## `DELETE /workouts/entries/{date}/{workoutId}`

Untick. Idempotent (removing an absent entry succeeds).

`200` day view. Errors: `400`, `409 DAY_LOCKED`.

## `GET /workouts/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Per-day totals for a range, for the history strip. `from ≤ to ≤ today`, at most 62 days.

`200`
```json
{ "days": [ { "date": "2026-11-09", "totalMinutes": 0, "totalCalories": 0 }, { "date": "2026-11-10", "totalMinutes": 60, "totalCalories": 420 } ] }
```
Every date in the range is returned (zeros for empty days), oldest first. `400` for a bad range.

## `POST /workouts/custom`

Body: `{ "name": "Badminton", "defaultMinutes": 60, "defaultCalories": 400 }`

- `name`: trimmed, 1–40 chars; `defaultMinutes`: whole 1–600; `defaultCalories`: whole 1–5,000.

`200`: `{ "workout": { "workoutId": "c-…", "name", "defaultMinutes", "defaultCalories" } }`. `400 VALIDATION_FAILED` with per-field messages, `409 DUPLICATE_NAME`.

## `PUT /workouts/custom/{workoutId}`

Same body and validation as `POST`. Changes apply to future ticks only; existing entries keep their snapshot (FR-010, FR-021).

`200` `{ "workout": … }`. `404 NOT_FOUND` if not the caller's or already removed, `409 DUPLICATE_NAME`. Standard ids always return `404` (FR-022).

## `DELETE /workouts/custom/{workoutId}`

Removes it from the checklist (soft remove). Past entries remain. Idempotent for an already-removed workout.

`200 { "ok": true }`. `404 NOT_FOUND` if it isn't the caller's or is a standard id.
