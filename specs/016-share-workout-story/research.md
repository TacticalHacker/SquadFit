# Research: Share a Workout Day (016)

## R1. Where the image is made
- **Decision**: In the browser on one 1080 × 1920 `<canvas>`; preview is the same canvas scaled with CSS.
- **Rationale**: Photo never leaves the phone, nothing stored, works offline once figures are loaded; preview = output.
- **Alternatives**: Server `ImageResponse`/satori (photo would have to be uploaded; Lambda fonts/bundle weight); DOM-to-image libraries (extra dependency, unreliable on iOS).

## R2. Sharing
- **Decision**: `navigator.canShare({ files: [file] })` → `navigator.share({ files, title })`. `AbortError` = member cancelled → no message. Other errors and unsupported browsers → Download (`<a download>` with an object URL) + hint.
- **Rationale**: On iOS Safari and Android Chrome the system sheet lists Instagram → Story. `navigator.share` must run inside the tap handler (transient activation), so the file is generated **before** the tap (kept up to date after each change, debounced) and Share only calls `navigator.share`.
- **Alternatives**: `instagram-stories://` (needs a Facebook App ID, native only).

## R3. Fonts on canvas
- **Decision**: Read the real family names from the CSS variables `--font-plex-sans` / `--font-plex-mono` on `<html>` (next/font gives hashed family names), then `await Promise.all([document.fonts.load("600 64px <family>"), …400/500…])` and `document.fonts.ready` before drawing. Numbers use Plex Mono (tabular), text Plex Sans. Loaded weights: 400/500/600.
- **Alternatives**: Hard-coding "IBM Plex Sans" (not the registered family name under next/font).

## R4. Photo decode
- **Decision**: `createImageBitmap(file, { imageOrientation: "from-image" })`, then if the long side exceeds 2160 px, draw into an offscreen canvas at that size and keep that bitmap (close the original). If `createImageBitmap` throws (HEIC on browsers that can't decode it, corrupt file) → "Couldn't open this photo. Try a JPEG or a screenshot." Fallback for older Safari without the options bag: `new Image()` from an object URL (browsers apply EXIF orientation to `<img>` by default since 2020).
- **Rationale**: 48 MP decoded is ~190 MB; downscaling right away keeps iOS under its canvas memory limit.
- **Feed upload** reuses `lib/photo-reduce.ts` (JPEG ≤ 1.5 MB) on the already-oriented bitmap, and the server's `sniffImage` (magic bytes).

## R5. Photo transform
- **Decision**: State `{ scale ≥ cover, cx, cy }` in output pixels; drag moves by pointer delta × (1080 / preview width); pinch uses two pointers' distance ratio; a range slider 1–3× cover. Every change is clamped so the photo always covers the frame (no empty edge).
- Pointer Events with `touch-action: none` on the preview; the sheet's own drag is disabled on the preview.

## R6. Layout and safe zones
- **Decision**: All content between y = 250 and y = 1580 (1920 − 340). Side padding 96 px. Card/Photo/Sticker share one "stats block" layout routine that measures text with `measureText`; names shrink down to 85% of their size then get "…" (binary search on characters). The block is anchored to the bottom of the safe area in Photo (scrim only behind it: solid `rgba(0,0,0,0.55)` band, no gradient), to the vertical centre in Sticker, and fills the safe area in Card.
- Colours: the dark tokens from `globals.css` copied once in `share-render.ts` (`bg #1a1917`, `surface #23221f`, `surface-2 #2c2b27`, `border #35332e`, `text #ece9e2`, `muted #a8a49a`, `accent #79c09c`). Canvas cannot read CSS variables in a theme-independent way, and the Card is always dark.
- Icons: Trophy drawn from the lucide path data (`Path2D`), stroke 1.75 scaled, accent colour.
- Sticker: transparent background, white text, `shadowBlur 12`, `rgba(0,0,0,0.45)`.

## R7. Output
- **Decision**: `canvas.toBlob("image/jpeg", 0.9)` for Card/Photo, `"image/png"` for Sticker; `File` named `squadfit-<date>.jpg|png`.

## R8. "Lifts improved" for one day
- **Decision**: Store `improvedDays: string[]` in each `LiftStats` (from `walkLift`'s existing `improved`), so `buildShareSummary` counts exercises of the day whose id lists that date. Old stats without the field read as none until the next rebuild or `pnpm admin squad backfill` (safe to re-run).
- **Rationale**: Same rule as the Lifts improved board, including jump flags.

## R9. PRs on the card
- **Decision**: From `stats.lifts[id].prDays` where `date` = the day (already excludes unconfirmed jumps, has `gainKg`). Shown as "Bench Press · 82.5 kg (+2.5 kg)": weight × reps when gain is a weight gain; when the PR was an estimate (`e1rm` set and the weight did not rise) show "Estimated max: about X kg (+Y kg)" using `plain.ts`. Own exercises' PRs appear on the member's own card (it's their image) but feed cards show only built-in lift PRs, like the feed today.

## R10. Streak line
- **Decision**: `streakFigures(stats.weeks, date, weeklyTarget)` evaluated at the shared date: `current ≥ 1` → "N weeks in a row" (`weeksInARow`), else `workoutsThisWeek(weekDays, target)`.

## R11. Feed posting
- **Decision**: `PUT /squad/posts/{date}` body `{ photo: "keep" | "remove" | { data: base64 } }`. Repo `postDay` = one `UpdateCommand` upsert on `FEED#day#<date>`: `SET gsi1pk, gsi1sk = if_not_exists(gsi1sk, :postedAt#user#event), postedAt = if_not_exists(postedAt, :now), squadId/kind/eventDate/payload/createdAt/rx* = if_not_exists(...)`, `photoKey` set or removed. `DELETE` = `REMOVE gsi1pk, gsi1sk, postedAt, photoKey` (conditional on existence) then delete the S3 object.
- The reaction path's lazy create becomes `putFeed(..., { ifAbsent: true })` so it can never overwrite a posted item.
- Feed read: listed `workout_day` items are those with `gsi1pk` (only posted ones have it); for each, load that day's entries + the author's stats (batch) and build the `workout` block; sign the photo URL. Day no longer a workout day → item already deleted by refresh.
- Photo stored as `share-photos/<sub>/<date>.<ext>`; replaced on re-post (same key, or old key deleted when the type changes).

## R12. Where Share appears
- Gym tab: a `ShareButton` in the summary line row of `GymScreen`, shown when any exercise has a logged entry (`entry !== null`) — server still decides (404 `NOT_A_WORKOUT_DAY` if no workout entry). Own profile timeline day cards: `ShareButton` when `isYou`.
- Figures are fetched by a Server Action when the sheet opens (the gym page stays as fast as today).
