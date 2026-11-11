# Contract: web-facing API changes

All routes need a valid Cognito access token (existing authorizer). Errors use the existing `{ error: { code, message, fields? } }` shape.

## `GET /coach-note?date=YYYY-MM-DD`

`date` optional (default today in the member's timezone; future dates → 400 like `/food`).
`200`: `{ "note": null }` or
`{ "note": { "date": "...", "summaryMarkdown": "...", "recommendations": ["..."], "generatedBy": "AI", "updatedAt": "<iso>" } }`.
`409 PROFILE_REQUIRED` as elsewhere. Handler: `coach-note-get.ts`, read-only table grant.

## `PUT /me/profile` (changed)

Body adds optional `dailyProteinTarget: integer 10-500 | null` (absent or null clears it on a full profile save, as the form always sends the field).
`GET /me` and the PUT response return `dailyProteinTarget: number | null` in `profile`.

## `GET /food` (changed)

`ledger.proteinTarget: number | null`.

## Web

- `/food`: server component fetches `/coach-note?date=` in parallel with the day view; renders `<CoachCard note>` above the ledger when present (AI badge, markdown summary, recommendations list), nothing otherwise. Read-only; stays visible on locked days.
- Profile form: optional protein target field.
- Ledger card: when `proteinTarget` is set, protein row shows `grams / target g`.
