# Contract: web-facing API changes

All routes use the existing Cognito JWT authorizer and error shape.

## `POST /food/photos/{date}` (new)

Body: `{ "meal": "breakfast|lunch|dinner|snacks", "caption"?: string (0-200), "contentType": "image/jpeg"|"image/webp", "dataBase64": string }`.
Rules: `date` must be today or the two days before (server decides; else 409 `DAY_LOCKED`); decoded size ≤ 1.5 MB else 413 `PAYLOAD_TOO_LARGE`; magic bytes must match JPEG/WebP else 400 `VALIDATION_FAILED`; profile required else 409.
`200`: the food day view (`FoodDayView`) with the new pending entry.
Handler `food-photo-post.ts`; table write + `food-photos/*` read/write.

## `PUT /food/entries/{date}/{entryId}` (changed)

`EntryPatchSchema` gains `caption?: string (0-200)`. For photo entries:
- `pending`: `caption`, `meal` allowed; `calories` (+ optional `macros`) makes it `manual`. Any other change once it is no longer pending → HTTP 409 with the existing `VALIDATION_FAILED` code and field `_: "This meal was already analysed; refresh"`.
- `ai` / `manual` / `edited`: `calories`, `macros`, `meal` allowed (status becomes `edited`); `caption` ignored.
- `servings` is rejected for photo entries.
Response: the food day view.

## `DELETE /food/entries/{date}/{entryId}` (changed)

For photo entries also deletes the photo object (after the entry). Response: the food day view.

## Food day view (changed)

- Each entry may carry `photo: { status: "pending"|"ai"|"manual"|"edited", caption: string, url: string }` (absent for non-photo entries; `url` expires in 1 hour).
- `ledger.pending: number` (default 0 for older API versions).
- Pending entries have `calories: 0`, `macros: null` and are excluded from every ledger total.

## Web

- `/food`: "Add photo" action beside the existing add panel; pending cards with thumbnail, caption, "Pending analysis" badge; ledger line "N meals pending analysis"; labels "AI-estimated", "edited", "entered by you".
- `serverActions.bodySizeLimit: "3mb"` in `next.config.ts`.
