# MCP tools (012)

Both tools act only as the key's member (no user id argument). They are registered in `services/api/src/lib/mcp/activity.ts`.

## upsert_daily_activity

Description (verbatim): "Save the member's daily activity from Apple Health or another health source. Use the member's local date. Send whole-day totals, not individual samples. Re-sending a date overwrites it. Call this when the member asks to sync or log their steps/activity."

Input: `{ days: [{ date: "YYYY-MM-DD", steps: int, active_kcal?: int, distance_km?: number }] }` (1–31 days).
The values go through the same normaliser and validator as the HTTP route (numbers are rounded, ranges checked, the date is ≤ today and ≥ today − 30).

Output (text JSON): `{ saved: [{ date, steps, activeKcal, distanceKm, goalHit }], stepGoal, source: "mcp" }`.
Error: `isError` with the same readable messages; nothing is saved.

## get_daily_activity

Input: `{ startDate, endDate }` (≤ 31 days, not after today; the same window rule as `get_user_history`).

Output: `{ today, timezone, stepGoal, days: [{ date, steps, activeKcal, distanceKm, source, syncedAt, goalHit }] }` (synced days only).
