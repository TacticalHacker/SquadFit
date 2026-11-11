import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { generateToken, hashToken } from "@calci/shared/ai-credential";
import { handle } from "../src/handlers/mcp";
import type { Deps } from "../src/lib/deps";

export async function seedKey(deps: Deps, userId = "user-1") {
  const token = generateToken();
  await deps.credentials.issue(userId, hashToken(token), "2026-01-01T00:00:00.000Z");
  return token;
}

export function mcpEvent(opts: { token?: string; authorization?: string; method?: string; body?: unknown; rawBody?: string }) {
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  const authorization = opts.authorization ?? (opts.token ? `Bearer ${opts.token}` : undefined);
  return {
    version: "2.0",
    rawPath: "/mcp",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authorization ? { authorization } : {}),
    },
    requestContext: { domainName: "api.example.com", http: { method: opts.method ?? "POST", path: "/mcp" } },
    ...(body !== undefined ? { body } : {}),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

export async function call(deps: Deps, event: APIGatewayProxyEventV2) {
  const res = (await handle(event, deps)) as APIGatewayProxyStructuredResultV2;
  let json: unknown;
  try {
    json = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.statusCode, headers: res.headers ?? {}, body: res.body, json: json as any };
}

let id = 0;
/** One JSON-RPC request through the handler. */
export function rpc(deps: Deps, token: string, method: string, params?: unknown) {
  return call(deps, mcpEvent({ token, body: { jsonrpc: "2.0", id: ++id, method, ...(params ? { params } : {}) } }));
}

export function callTool(deps: Deps, token: string, name: string, args: unknown) {
  return rpc(deps, token, "tools/call", { name, arguments: args });
}

/** Text of a tools/call result (JSON-RPC envelope unwrapped). */
export function toolText(r: Awaited<ReturnType<typeof call>>): { text: string; isError: boolean } {
  const res = r.json?.result;
  return { text: res?.content?.[0]?.text ?? "", isError: res?.isError === true };
}
