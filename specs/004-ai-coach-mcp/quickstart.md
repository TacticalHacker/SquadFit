# Quickstart: AI Coach (Remote MCP)

Prerequisites: AWS creds for `dev`, `pnpm install`, a member with a completed profile (`pnpm admin create-user alice`).

## 1. Automated checks
```sh
pnpm check && pnpm synth
```

## 2. Deploy and issue a key
```sh
pnpm deploy:dev
pnpm admin ai-key issue alice --stage dev     # prints the secret ONCE and a client snippet
export MCP_URL="<ApiUrl output>/mcp"; export KEY="sfk_..."
```

## 3. curl: list and call tools
```sh
H=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_user_history","arguments":{"startDate":"2026-11-05","endDate":"2026-11-11"}}}'
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"post_daily_coach_note","arguments":{"date":"2026-11-11","summaryMarkdown":"**Solid day.** Protein is low.","recommendations":["Add a protein snack","Walk 20 min"]}}}'
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"update_user_targets","arguments":{"dailyCalorieTarget":2400,"dailyProteinTarget":130}}}'
```
Expected: tools/list shows 3 tools; calls succeed. No/invalid key → 401; `date` in the future → `isError`.

## 4. UI
Sign in as `alice`, open `/food`: the AI-badged card shows the note; ledger remaining uses 2,400 and protein shows `x / 130 g`. Open another member's session: no note.

## 5. Client setup
- Cursor `~/.cursor/mcp.json`: `{"mcpServers":{"squadfit":{"url":"$MCP_URL","headers":{"Authorization":"Bearer <key>"}}}}`
- Claude Code: `claude mcp add --transport http squadfit $MCP_URL --header "Authorization: Bearer <key>"`
- Claude Desktop (bridge): `{"mcpServers":{"squadfit":{"command":"npx","args":["mcp-remote","$MCP_URL","--header","Authorization: Bearer <key>"]}}}`
- Claude mobile: not supported by static keys (research R6).

## 6. Revoke
`pnpm admin ai-key revoke alice` then repeat a curl call: 401 immediately.
