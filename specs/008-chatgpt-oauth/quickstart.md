# Quickstart: ChatGPT Connector

1. `pnpm check && pnpm synth`, then `aws login && pnpm deploy:dev` (or prod).
2. Key: use the member's existing `sfk_` key (the one Claude uses), or `pnpm admin ai-key issue <user>`. Issuing a new key replaces it everywhere, including Claude.
3. ChatGPT → Plugins → + → Add custom MCP server:
   - URL: `https://<api-id>.execute-api.ap-south-1.amazonaws.com/mcp/<sfk_key>`
   - Authentication: **No authentication**
4. In any chat: "call get_full_context from squadfit" → that member's data.
5. Check: `curl -s -X POST <api>/mcp/<key> -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` lists the tools; a wrong key returns 401.
