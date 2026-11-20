# API: Share a Workout Day (016)

All routes require a Cognito token. Schemas in `packages/shared/src/contracts/share.ts`.

## GET /me/share/{date}
The caller's own figures for one day. Works when the caller is hidden from the leaderboard.

200 `ShareSummary` (strict):
```json
{
  "date": "2026-11-18",
  "label": "Chest · Shoulders",
  "durationMin": 69,
  "exerciseCount": 8,
  "liftsImproved": 3,
  "rows": [
    { "kind": "strength", "exerciseId": "gx-shoulder-press", "name": "Shoulder Press", "top": { "weightKg": 60, "reps": 10 }, "sets": 4 },
    { "kind": "minutes", "name": "Incline Treadmill Walk", "minutes": 5 }
  ],
  "moreCount": 3,
  "prs": [{ "exerciseId": "gx-bench-press", "name": "Bench Press", "weightKg": 82.5, "reps": 5, "e1rm": 96.3, "gainKg": 2.5 }],
  "streak": { "weeks": 3, "weekDays": 2, "target": 4 },
  "steps": 8412,
  "post": { "posted": false, "hasPhoto": false, "canPost": true }
}
```
Errors: 400 `VALIDATION_FAILED` (bad or future date), 404 `NOT_A_WORKOUT_DAY`, 409 `PROFILE_REQUIRED`.

## PUT /squad/posts/{date}
Body `SharePostInput` (strict): `{ "photo": "keep" | "remove" | { "data": "<base64 JPEG/WebP ≤ 1.5 MB>" } }`.
200 `{ "post": { "posted": true, "hasPhoto": boolean, "canPost": true } }`.
Errors: 400 (date, body, not an image, too large), 403 `HIDDEN` (caller hidden from the leaderboard), 404 `NOT_A_WORKOUT_DAY`.
Idempotent; never duplicates; keeps the first post time and reactions.

## DELETE /squad/posts/{date}
Unlists the day and deletes its photo. Reactions kept. 200 `{ "post": { "posted": false, "hasPhoto": false, "canPost": … } }` (also when not posted).

## GET /squad/feed (changed)
`SquadFeedItem.kind` gains `"workout_day"`; new field `workout` (null for other kinds):
```json
{ "label": "Chest · Shoulders", "durationMin": 69, "exerciseCount": 8, "liftsImproved": 3,
  "rows": [ … as above … ], "moreCount": 3,
  "prs": [ … built-in lifts only … ], "photoUrl": "https://…signed…" | null }
```
Only posted days of visible members appear; no steps, streak, calories or body weight.
