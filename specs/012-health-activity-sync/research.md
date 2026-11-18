# Research: Health Activity Sync (012)

## R1 Storage: an item in the single table, not a new table
- **Decision**: `pk = USER#<sub>`, `sk = ACTIVITY#<date>`. Save with an unconditional `Put` per day, all days of a request in one `TransactWriteItems` (≤ 31 items, under the 100 limit).
- **Rationale**: The key makes (member, date) unique. A full put gives "replace, never add" and "latest write wins" with no read. The transaction keeps a request all or nothing (FR-004). Range reads are one `Query` with `sk BETWEEN`.
- **Alternatives**: A separate table (rejected by constitution IV/VII). A conditional write that only accepts larger step counts (rejected: the owner asked for latest-wins, and a correction downwards must be possible).

## R2 Health sync token
- **Decision**: `sfh_` + 32 random bytes in base64url, stored as SHA-256 only. Items: `HEALTHTOKEN#<hash>/HEALTHTOKEN → { userId }` (lookup) and `USER#<sub>/HEALTHCRED → { tokenHash, createdAt, lastUsedAt? }`. Issuing is one transaction that puts both and deletes the old lookup; revoking deletes both. `lastUsedAt` is set with an `UpdateCommand` after each successful authentication.
- **Rationale**: This copies the proven MCP key design (feature 004). A different prefix and different items keep the two scopes apart: `parseBearer` (MCP) only accepts `sfk_`, and the sync handler only accepts `sfh_`, so neither credential works on the other route. Cognito routes need a JWT.
- **Self-service**: Members issue the token from Settings through a Cognito route. It is shown once in the response, and the web app never stores it.
- **Alternatives**: Reusing the MCP key (rejected: it can read everything). A JWT with a scope claim (rejected: tokens can't be revoked without a store).

## R3 Rate limit
- **Decision**: An atomic `ADD` counter `HEALTHRATE#<sub>#<utcHour>/C` with `ttl` = end of the hour + 2 min. More than 60 requests → 429 with `retry-after`. The check runs after the token resolves, so the limit is per member and token.

## R4 The sync route lives on the API, not the website
- **Decision**: `POST /integrations/activity` on the HTTP API with no authorizer, like `/mcp` (owner decision). The URL is `<ApiUrl>/integrations/activity`. The web app shows it in Settings from its server-side `API_URL`.
- **Body limit**: 1 MB after decoding. Health Auto Export with hourly samples over 31 days and 3 metrics is about 2,300 samples, roughly 250 KB. Larger bodies get 413 with a message.
- **No CORS**: The callers are Shortcuts and an iOS app, not browsers.

## R5 Lenient input (Shortcut quirks)
- **Decision**: `toNumber(value)` accepts finite numbers, or strings that match `^\s*-?[\d,]*\.?\d+\s*$` after stripping commas, spaces and `_`. Anything else is reported as "<field> must be a number". Rounding: steps and kcal use `Math.round`, distance rounds to 2 dp. A day object or an array is accepted, and so is `{ days: object }`. Keys are matched case-insensitively for `active_kcal|activeKcal` and `distance_km|distanceKm`. `source` must be `shortcut` when given; any other value falls back to `shortcut`, because a client can't claim `mcp`.
- **Duplicate dates in one request**: The last one wins (after normalising).

## R6 Health Auto Export format
- **Detection**: The body has `data.metrics` as an array (the app's REST "JSON" export, version 2).
- **Mapping**:
  - `step_count` is summed per day.
  - `active_energy` is summed per day; `units` of `kJ` is divided by 4.184.
  - `walking_running_distance` is summed per day; `mi` is multiplied by 1.609344 and `m` divided by 1000.
  - Unknown units for a metric are a validation error.
- **Day**: The first 10 characters of each sample's `date` (`"2026-11-18 00:00:00 +0530"`), which is the phone's local date.
- **Source**: `health_auto_export`.
- **Rationale**: The app sends one sample per aggregation period (day or hour), so summing within one request gives whole-day totals. A day that appears in a later request is replaced, never added to (R1).

## R7 Validation and messages
- **Decision**: Validation is pure and runs after normalising. It returns a list of `{ date, field, message }`. Messages are rendered as `"18 Nov: steps must be between 0 and 100,000"`. Dates are checked with `DateSchema`, not after `today`, and not before `today − 30` (today is in the member's timezone). At most 31 days are accepted. The 422 body is `{ error: { code: "VALIDATION_FAILED", message: <all messages joined with "; ">, fields } }`, so a Shortcut's "Get dictionary value: error.message" shows one readable line.
- **New error code**: The project's error codes are used. 422 means `VALIDATION_FAILED` (the HTTP status differs from the usual 400 because the owner asked for 422).

## R8 Visibility choke point
- **Decision**: `stepsShared(profile) = leaderboardVisible !== false && shareSteps !== false` in `lib/member-access.ts`, plus `isYou`. Every squad handler builds steps only through `stepsFor(owner, viewerId)`, which returns `null` when steps aren't shared, and the strict schemas make the key optional. Active calories and distance only go into `MemberProfile.steps.days[]`.

## R9 Steps board
- **Decision**: For each sharing member, the period is `week` (from Monday of the member's local week to their today) or `30d` (from today − 29 to today). `avg = round(sum(steps of synced days) / syncedDays)`. `hitDays` counts synced days with steps ≥ goal. `periodDays` is the number of days elapsed in the period. Members with `syncedDays = 0` are dropped. Ranking uses `rankRows` (ties share a rank, then by name). When the viewer asks for period `all`, the board uses `week` (the UI only offers week and 30d, as Nutrition does).

## R10 Step-goal run feed item
- **Decision**: `lib/step-events.ts` mirrors `protein-events.ts`. The event id is `steps7#<endDate>`, the kind `step_streak`, the payload `{ days: 7 }`. It runs after every activity write and after `PUT /me/steps` / `PUT /me/squad` (sharing changes), and never throws. The feed and timeline drop `step_streak` at read time for authors who don't share steps.

## R11 Today's view rest-day cards
- **Decision**: `TodaySchema` gains `restDays: [{ member, steps }]` for sharing members (and the viewer) with a synced day and no workout card. Workout cards gain an optional `steps`. The leaderboard gains `stepsToday: [{ userId, steps, goalHit }]` for expanded rows. This keeps `DayCardSchema` unchanged for workout semantics (it still requires sessions).

## R12 Settings write
- **Decision**: A new `PUT /me/steps { dailyStepGoal, shareSteps }` (step goal 1,000–50,000), separate from `PUT /me/squad`, so the existing squad form and schema stay untouched. `OwnProfile.steps` defaults to `{ dailyStepGoal: 8000, shareSteps: true }` to cope with rollout skew.

## R13 Chart
- **Decision**: 30 CSS bars (flex), with height as a % of max(goal, max steps), a goal line, and empty slots for unsynced days. They use the `accent` and `line` tokens, and each bar has a `title`/`aria-label` with the date and steps. No chart library (VII).
