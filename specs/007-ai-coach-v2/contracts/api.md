# Contract: HTTP API changes (`services/api`)

Same conventions as features 002–006: only the Next.js server calls the API with the member's Cognito access token, errors are `{ "error": { "code", "message", "fields?" } }`, `today` comes from the profile timezone, bodies are never logged. Schemas live in `packages/shared/src/contracts/coach.ts`, `me.ts`, `workouts.ts`, `gym.ts`.

## GET /coach-note?date=YYYY-MM-DD (changed response)

```ts
CoachStatusSchema = z.enum(["on_track", "needs_attention", "pr_alert"])
OverallNoteSchema = {
  date, headline: string, status: CoachStatus,
  highlights: string[], actions: { text: string, done: boolean }[],
  generatedBy: "AI", updatedAt: ISO datetime
}
PulseMetricsSchema = { netCalories: int, proteinG: number, gymVolumeKg: number }
CoachPulseResponseSchema = { note: OverallNote | null, metrics: PulseMetrics | null }   // metrics null iff note null
```

Legacy markdown notes return `{ note: null, metrics: null }`. `date` defaults to today; after today → 400. Replaces `CoachNoteResponseSchema` / `CoachNoteSchema` (removed).

## PUT /coach-note/{date}/actions/{index} (new)

Body `{ done: boolean, noteUpdatedAt: ISO datetime }` (strict). `index` 0–2.

- 200 `{ actions: { text, done }[] }`
- 404 `NOT_FOUND`: no v2 note for that date.
- 409 `VALIDATION_FAILED` with `fields: { _: "This note was updated; refresh" }` (same convention as feature 005's photo conflict; no new error code): the note changed since `noteUpdatedAt`, or `index` ≥ number of actions.
- 400: bad date, future date, date older than 30 days, bad body.

Route: `route("coach-action-put", HttpMethod.PUT, "/coach-note/{date}/actions/{index}", { write: true })`.

## PUT /me/profile (changed input), GET /me (changed output)

`ProfileInputSchema` gains `bodyWeightKg: BodyWeightSchema.nullish()` (20–400, ≤ 1 decimal; `null` clears, absent leaves it unchanged). `OwnProfileSchema` gains `bodyWeightKg: number | null` (stored value, not the default). `PublicMemberSchema` is unchanged.

## Workout views (changed output)

- `DayViewSchema.rows[].entry` gains `aiNote: string | null`.
- `GymEntryViewSchema` gains `aiNote: string | null` (so `GymView`, `GymSaveResult` and `DayView.gym` carry it).
- `DayViewSchema.rows[].isStandard` is always `false` now and is removed from the schema; rows are own workouts plus former/removed ones with an entry that day.

## Workout writes (changed behavior)

- `PUT /workouts/entries/{date}/{workoutId}`: creating an entry for a `std-*` id → 404 `NOT_FOUND`. Changing minutes on any existing entry (including `std-*`) works as before and clears `aiNote`.
- `PUT /workouts/gym/entries/...`: unchanged contract; the full replace drops `aiNote`.
- `POST|PUT /workouts/custom`: names are no longer checked against former built-in names.
