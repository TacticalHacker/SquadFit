import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { TOOLS } from "./tools";
import type { ToolContext } from "./types";

export function buildMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "SquadFit", version: "1.0.0" });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.shape }, async (args: unknown) => {
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
