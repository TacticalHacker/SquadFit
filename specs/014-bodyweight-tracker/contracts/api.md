# API Contract: Bodyweight Tracker (014)

All routes are behind the Cognito authorizer and act only on the caller. They're defined as zod schemas in `packages/shared/src/contracts/weight.ts`. Errors use the existing `apiError` envelope.

## Schemas (`contracts/weight.ts`)

```ts
WeightRangeSchema    = z.enum(["W", "M", "6M", "Y"])                         // default "M"
WeightEntrySchema    = z.object({ id, date: DateSchema, recordedAt: z.string(), weightKg: z.number() }).strict()
WeightSlotSchema     = z.object({ start, end, count: z.number().int(), min, max, average, trend /* number | null */ }).strict()
WeightViewSchema     = z.object({
  range, start, end,
  summary: z.object({ average, min, max }).strict().nullable(),
  slots: z.array(WeightSlotSchema),
  latest: z.object({ date, weightKg, recordedAt }).strict().nullable(),
  profileWeightKg: z.number().nullable(),
  editableDays: z.array(z.object({ date, entries: z.array(WeightEntrySchema) }).strict()),
}).strict()
WeightLogInputSchema = z.object({ weightKg: BodyWeightSchema, date: DateSchema.optional() }).strict()
```

## `GET /me/weight?range=W|M|6M|Y`

200 → `WeightView`. 400 `VALIDATION_FAILED` for an unknown range. 409 `PROFILE_REQUIRED` with no profile.

## `POST /me/weight?range=…`

Body `WeightLogInput`. The date defaults to today in the member's timezone.

- 200 → `WeightView` for `range`, including the new entry. The profile body weight is synced to the latest entry.
- 400 `VALIDATION_FAILED`: weight out of 20–400 or not 1 decimal; bad or future date.
- 409 `DAY_LOCKED`: date older than today − 2.
- 409 `DAY_FULL`: there are already 10 entries that day.

## `DELETE /me/weight/{date}/{entryId}?range=…`

Idempotent: a missing entry, another member's id or a malformed id changes nothing and still returns 200 with the caller's view. The handler can only reach the caller's own `pk` (spec US3 #3).

- 200 → `WeightView`. The profile body weight is re-synced; if no entries remain, it's left as it was.
- 409 `DAY_LOCKED` outside the edit window. 400 for a bad date.

## `PUT /me/profile` (changed behaviour, same schema)

If `bodyWeightKg` is a number different from the stored one, an entry is recorded for today and the profile follows it. `null` is ignored when the member has entries.

## Web (Server Actions, `server/actions/weight.ts`)

- `loadWeightView(range)` → `WeightView` (validated with `WeightViewSchema`).
- `logWeight(range, { weightKg, date })` → `{ ok: true, view } | { ok: false, message }`.
- `deleteWeight(range, date, entryId)` → the same result shape.

## Never

`WeightView` and entries never appear in `/squad/*`, `/public/*`, `/me/share/*`, the feed or MCP tools. Nothing from these routes is logged except error names.
