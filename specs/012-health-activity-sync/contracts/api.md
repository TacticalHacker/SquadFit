# HTTP contracts (012)

Schemas live in `packages/shared/src/contracts/activity.ts` (and the squad additions in `squad-profile.ts`). Errors use the
existing `{ error: { code, message, fields? } }` shape.

## POST /integrations/activity (no authorizer)

`Authorization: Bearer sfh_…` (Health sync token only).

Body, any of:

```json
{ "days": [ { "date": "2026-11-18", "steps": 8423, "active_kcal": 512, "distance_km": 6.1 } ], "source": "shortcut" }
{ "date": "2026-11-18", "steps": "8,423.0" }
{ "data": { "metrics": [ { "name": "step_count", "units": "count", "data": [ { "date": "2026-11-18 00:00:00 +0530", "qty": 8423 } ] } ] } }
```

| Status | When | Body |
|---|---|---|
| 200 | saved | `{ saved: [{ date, steps, activeKcal, distanceKm, goalHit }], stepGoal, source }` |
| 401 `UNAUTHORIZED` | missing, malformed, unknown or revoked token | `"Health sync token is missing or no longer valid. Generate a new one in SquadFit Settings."` |
| 409 `PROFILE_REQUIRED` | the owner has no profile | |
| 413 `PAYLOAD_TOO_LARGE` | body > 1 MB | |
| 422 `VALIDATION_FAILED` | parse or range errors | `message` = every problem joined with `"; "`, e.g. `"18 Nov: steps must be between 0 and 100,000"`; `fields` keyed `"<date>.<field>"` |
| 429 `RATE_LIMITED` | > 60 requests this hour | `retry-after: 3600 - secondsIntoHour` |

## GET /me/health-sync (Cognito)

`{ token: { createdAt, lastUsedAt } | null, lastSync: { syncedAt, source, date } | null, steps: { dailyStepGoal, shareSteps } }`.
`lastSync` is the most recently written day in the last 31 days.

## POST /me/health-token (Cognito)

Issues or regenerates the token. `201 { token: "sfh_…", createdAt }`, the only time the token is returned. 409 `PROFILE_REQUIRED` without a profile.

## DELETE /me/health-token (Cognito)

`204`; idempotent.

## PUT /me/steps (Cognito)

Body `{ dailyStepGoal: 1000–50000 int, shareSteps: boolean }` → `200 { dailyStepGoal, shareSteps }`. Refreshes step feed items.

## Squad additions (all Cognito, all strict)

- `OwnProfile.steps: { dailyStepGoal, shareSteps }` (default `{ 8000, true }`).
- `DayCard.steps?: { steps, goalHit }`: on timeline/day/today cards when shared (or own).
- `Today.restDays: [{ member, steps: { steps, goalHit } }]`: shared members with steps and no workout card that day.
- `MemberProfile.steps?: { goal, days: [{ date, steps|null, activeKcal|null, distanceKm|null }] (30), shared: boolean }`. The key is absent when not shared; `shared` tells the owner whether others see it.
- `SquadLeaderboardFull.stepsToday: [{ userId, steps, goalHit }]` and `stepsBoard: { period: "week"|"30d", rows: [{ member, rank, avgSteps, hitDays, periodDays, syncedDays }], viewer: { sharing } }`.
- Feed item kind and timeline milestone kind gain `step_streak`.
