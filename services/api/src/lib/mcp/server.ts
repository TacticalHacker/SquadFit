import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { TOOLS } from "./tools";
import type { ToolContext } from "./types";

/** Sent to the agent on initialize, so it acts through the tools instead of inventing app features. */
export function mcpInstructions(today: string): string {
  return (
    "SquadFit is a web app for friend groups (gym, activities, food, steps). There is no native iPhone app and no Apple Health switch inside SquadFit. " +
    `Today in the member's own timezone is ${today}; use their local calendar dates. ` +
    "You act as the member through these tools. If you can see their Apple Health or other health data, save the daily steps (and active kcal/distance if available) yourself with upsert_daily_activity, and weigh-ins with log_weight; don't send them to app settings. " +
    "For hands-free daily sync without you, members create a Health sync token in SquadFit Settings and use it with an iPhone Shortcut or Health Auto Export. " +
    "Use get_full_context for a daily review. Never invent SquadFit features or menus."
  );
}

export function buildMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "SquadFit", version: "1.0.0" }, { instructions: mcpInstructions(ctx.today) });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.shape, ...(tool.annotations ? { annotations: tool.annotations } : {}) }, async (args: unknown) => {
      const result = await tool.run(args, ctx);
      return {
        content: [
          ...(result.image ? [{ type: "image" as const, data: result.image.data, mimeType: result.image.mimeType }] : []),
          { type: "text" as const, text: result.text },
        ],
        ...(result.isError ? { isError: true as const } : {}),
      };
    });
  }
  return server;
}

/** Serve one stateless JSON-RPC request (research R1): new server and transport per invocation. */
export async function serveMcp(ctx: ToolContext, request: Request): Promise<Response> {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true } /* no sessionIdGenerator: stateless */);
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}
