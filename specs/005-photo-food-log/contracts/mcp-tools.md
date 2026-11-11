# Contract: new MCP tools

Same endpoint, authentication, limits and error conventions as [feature 004](../004-ai-coach-mcp/contracts/mcp-tools.md). Tool errors use `isError: true` with a text message; nothing changes on error. All tools act only as the key's member; another member's entry is "not found".

## `list_pending_food_photos` (read-only)
Input: `{ limit?: int 1-50 (default 20) }`.
Output (JSON text): `{ timezone, today, hasMore, entries: [{ date, entryId, meal, caption, createdAt }] }`, newest first, only pending photo entries in the editable window (today and the two days before, in the member's timezone).

## `get_food_photo` (read-only)
Input: `{ date: "YYYY-MM-DD", entryId: string }`.
Output: two content items: an MCP `image` (`data` base64, `mimeType` `image/jpeg` or `image/webp`) and a text item with `{ date, entryId, meal, caption }`. Errors: not found (unknown id, other member's id, no photo).

## `submit_food_estimate`
Input: `{ date, entryId, calories: int 1-5000, protein: number 0-500, carbs: number 0-500, fat: number 0-500 }` (one decimal for grams; all three macros required).
Output: `Estimate saved for <meal> on <date>: <calories> kcal, P <p> g, C <c> g, F <f> g.`
Errors (no change): entry not found; entry not pending ("already analysed or edited"); day outside the edit window; invalid values.

## Changed: `get_user_history`
Food items for photo entries add `status` (`pending|ai|manual|edited`) and `caption`; pending ones appear with `calories: 0` and `pending: true`, and are not in `totals`.
