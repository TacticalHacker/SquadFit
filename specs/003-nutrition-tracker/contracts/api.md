# Contract: HTTP API additions (AWS, `services/api`)

Same conventions as [001](../../001-user-accounts/contracts/api.md) and [002](../../002-workout-tracker/contracts/api.md): only the Next.js server calls the API, every route requires `Authorization: Bearer <access token>` (JWT authorizer), the caller comes from verified claims, errors use `{ "error": { "code", "message", "fields?" } }`, request bodies are never logged.

**Every route** first loads the caller's profile and returns **`409 PROFILE_REQUIRED`** without one (FR-001), and computes `today` from the profile timezone with the server clock. Dates are `YYYY-MM-DD`. No new error codes: `VALIDATION_FAILED` (400), `PROFILE_REQUIRED` (409), `DAY_LOCKED` (409), `DUPLICATE_NAME` (409), `NOT_FOUND` (404).

## Food day view (response shape)

```json
{
  "date": "2026-11-11", "today": "2026-11-11", "timezone": "Asia/Kolkata", "editable": true,
  "meals": [
    {
      "meal": "breakfast",
      "subtotal": 375,
      "entries": [
        {
          "entryId": "1762851000000-a1b2c3", "source": "standard", "foodId": "sf-oats",
          "name": "Oats with milk", "serving": "1 bowl", "servings": 1.5,
          "calories": 375, "macros": { "protein": 15, "carbs": 57, "fat": 9 },
          "rate": { "calories": 250, "macros": { "protein": 10, "carbs": 38, "fat": 6 } }
        }
      ]
    },
    { "meal": "lunch", "subtotal": 0, "entries": [] },
    { "meal": "dinner", "subtotal": 0, "entries": [] },
    { "meal": "snacks", "subtotal": 0, "entries": [] }
  ],
  "ledger": {
    "eaten": 375, "burned": 300, "net": 75, "target": 2200, "remaining": 2125,
    "macros": { "protein": 15, "carbs": 57, "fat": 9, "entriesWithoutMacros": 0 }
  }
}
```

All four meals are always present, in this order. `remaining` is negative when over the target. `rate` is the per-serving snapshot, so the client can recompute a servings change exactly as the server does. `macros` is `null` for entries without macros.

## `GET /food?date=YYYY-MM-DD`

`date` optional, default today, must not be after today. `200` food day view; `400` for a malformed or future date.

## `POST /food/entries/{date}`

Add an entry. Body is one of:

```json
{ "kind": "typed", "meal": "snacks", "name": "Banana", "calories": 100, "macros": { "protein": 1, "carbs": 24, "fat": 0 } }
{ "kind": "standard", "meal": "lunch", "foodId": "sf-dal", "servings": 1.5 }
{ "kind": "own", "meal": "lunch", "foodId": "f-…", "servings": 2 }
```

- `typed`: `name` 1-60 chars (trimmed, inner spaces collapsed), `calories` whole 1-5,000, `macros` optional (each 0-500, one decimal; all three are stored, so the client form fills blanks with 0).
- list kinds: `servings` 0.5-20 in 0.5 steps; the resulting calories must be 1-5,000.
- `meal`: `breakfast | lunch | dinner | snacks`.

`200` food day view for `{date}`. Errors: `400` (messages in `fields`, e.g. `calories`: "Calories must be a whole number from 1 to 5,000"; also a bad or future date), `409 DAY_LOCKED`, `404 NOT_FOUND` (unknown built-in id, or an own food that is not the caller's).

## `PUT /food/entries/{date}/{entryId}`

Edit an entry. Body, all fields optional:

```json
{ "name": "…", "calories": 120, "macros": { "protein": 2, "carbs": 20, "fat": 3 }, "meal": "dinner", "servings": 2 }
```

| Entry source | Allowed fields | Others |
|---|---|---|
| `typed` | `name`, `calories`, `macros`, `meal` | `servings` → `400` |
| `standard` / `own` | `servings`, `meal` | `name`, `calories`, `macros` → `400` "Calories and macros follow the servings for foods from a list" |

For list entries calories and macros are recomputed from the entry's own `rate` and the new servings. `200` food day view. Errors: `400`, `409 DAY_LOCKED`, `404 NOT_FOUND` (no such entry, including one deleted on another device).

## `DELETE /food/entries/{date}/{entryId}`

Idempotent (an absent entry succeeds). `200` food day view. `400`, `409 DAY_LOCKED`.

## `GET /food/recent`

`200 { "foods": [ { "name": "Oats", "calories": 300, "macros": { … } | null } ] }`: up to 20 distinct recent foods from the last 90 days, most recent first (research R6).

## `GET /food/foods`

`200 { "foods": [ { "foodId": "f-…", "name", "serving", "calories", "macros": { … } | null } ] }`: the caller's own foods, A to Z. Built-in foods are not returned (the client has the catalog).

## `POST /food/foods` and `PUT /food/foods/{foodId}`

Body: `{ "name", "serving", "calories", "macros"? }` (limits as in FR-021). `200 { "food": { … } }`. `400` with `fields`, `409 DUPLICATE_NAME` (another own food has that name ignoring case and spacing; matching a built-in name is allowed), `404 NOT_FOUND` for `PUT` when it is not the caller's. Built-in ids (`sf-…`) always `404` (FR-019).

## `DELETE /food/foods/{foodId}`

`200 { "ok": true }`. `404 NOT_FOUND` if it was never the caller's or is a built-in id. Existing entries are unaffected.
