import { describe, expect, it } from "vitest";
import { formatSnippets, parseAiKeySubcommand } from "../scripts/ai-key";

describe("ai-key helpers", () => {
  it("prints Cursor, Claude Code and Claude Desktop snippets with the url and key", () => {
    const out = formatSnippets("https://api.example.com/mcp", "sfk_secret");
    expect(out).toContain('"url": "https://api.example.com/mcp"');
    expect(out).toContain("Authorization: Bearer sfk_secret");
    expect(out).toContain("claude mcp add --transport http squadfit https://api.example.com/mcp");
    expect(out).toContain("mcp-remote");
  });

  it("accepts only issue, revoke and list", () => {
    expect(parseAiKeySubcommand("issue")).toBe("issue");
    expect(parseAiKeySubcommand("rotate")).toBeNull();
    expect(parseAiKeySubcommand(undefined)).toBeNull();
  });
});
