/** Pure helpers for `pnpm admin ai-key ...` (feature 004). */
export function formatSnippets(mcpUrl: string, token: string): string {
  const bearer = `Bearer ${token}`;
  return [
    "Cursor (~/.cursor/mcp.json):",
    JSON.stringify({ mcpServers: { squadfit: { url: mcpUrl, headers: { Authorization: bearer } } } }, null, 2),
    "",
    "Claude Code:",
    `claude mcp add --transport http squadfit ${mcpUrl} --header "Authorization: ${bearer}"`,
    "",
    "Claude Desktop (through the mcp-remote bridge):",
    JSON.stringify(
      { mcpServers: { squadfit: { command: "npx", args: ["mcp-remote", mcpUrl, "--header", `Authorization: ${bearer}`] } } },
      null,
      2,
    ),
  ].join("\n");
}

export const AI_KEY_SUBCOMMANDS = ["issue", "revoke", "list"] as const;
export type AiKeySubcommand = (typeof AI_KEY_SUBCOMMANDS)[number];

export function parseAiKeySubcommand(value: string | undefined): AiKeySubcommand | null {
  return (AI_KEY_SUBCOMMANDS as readonly string[]).includes(value ?? "") ? (value as AiKeySubcommand) : null;
}
