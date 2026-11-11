# Contract: MCP endpoint

**Endpoint**: `POST {API_URL}/mcp`, `Authorization: Bearer sfk_...`, JSON-RPC 2.0 body, `Content-Type: application/json`, `Accept: application/json, text/event-stream`.
`GET`/`DELETE` → 405. `OPTIONS` → 204 with `Access-Control-Allow-Origin: *`, headers `Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version`, methods `POST, OPTIONS` (safe: bearer header, no cookies).

## HTTP-level errors

| Status | When | Body |
|---|---|---|
| 401 | Missing/invalid/revoked secret (same message for all) | `{"error":{"code":"UNAUTHORIZED","message":"Invalid or missing access key"}}` |
| 409 | Member has no completed profile | `{"error":{"code":"PROFILE_REQUIRED",...}}` |
| 413 | Body over 64 KB | `PAYLOAD_TOO_LARGE` |
| 429 | Over 60 requests/minute | `{"error":{"code":"RATE_LIMITED",...}}` + `Retry-After` |

## Tools

Tool errors use the MCP result `isError: true` with a text message that states the rule violated; no data changes.

### `get_user_history` (read-only)
Input: `{ startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }` (`start ≤ end ≤ today`, ≤ 31 days).
Output text (JSON): `{ timezone, today, targets: { calories, protein|null }, days: [{ date, food: [{ meal, name, servings, calories, protein?, carbs?, fat? }], workouts: [{ name, minutes, calories }], totals: { eaten, burned, net, protein, carbs, fat } }] }`, oldest first, one object per day including empty days.

### `post_daily_coach_note` (idempotent overwrite)
Input: `{ date, summaryMarkdown (1-4000), recommendations (1-10 × 1-280) }`. `date` within today and the 30 days before.
Output: `Coach note saved for <date>.`

### `update_user_targets`
Input: `{ dailyCalorieTarget?: int 500-10000, dailyProteinTarget?: int 10-500 | null }`, at least one field. `null` clears the protein target.
Output: `Targets updated: calories <n>, protein <n|none>.`

Tool and field names match the pasted plan except targets (`calorieTarget`/`proteinTargetG` → `dailyCalorieTarget`/`dailyProteinTarget`, matching the profile). Zod schemas live in `packages/shared/src/contracts/coach.ts`.

`get_group_leaderboard` is intentionally absent (spec FR-010).
