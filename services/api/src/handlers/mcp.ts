import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { effectiveBodyWeight, localDate } from "@calci/shared";
import { hashToken, parseBearer, parsePathKey } from "@calci/shared/ai-credential";
import { RATE_LIMIT_PER_MINUTE } from "../lib/credential-repo";
import { getDeps, type Deps } from "../lib/deps";
import { apiError } from "../lib/http";
import { serveMcp } from "../lib/mcp/server";

const MAX_BODY_BYTES = 64 * 1024;

// Bearer header, no cookies: a wildcard origin is safe and lets browser-based MCP inspectors connect (research R2).
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

const withCors = (r: APIGatewayProxyStructuredResultV2): APIGatewayProxyStructuredResultV2 => ({
  ...r,
  headers: { ...CORS, ...r.headers },
});

/** POST /mcp: stateless MCP over HTTP. Identity comes only from the operator-issued key (spec FR-001/FR-002). */
export async function handle(event: APIGatewayProxyEventV2, deps: Deps): Promise<APIGatewayProxyStructuredResultV2> {
  return withCors(await route(event, deps));
}

async function route(event: APIGatewayProxyEventV2, deps: Deps): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") return { statusCode: 204 };
  if (method !== "POST") {
    return { ...(apiError(405, "VALIDATION_FAILED", "Use POST") as APIGatewayProxyStructuredResultV2), headers: { allow: "POST, OPTIONS", "content-type": "application/json" } };
  }

  // Header for Claude/Codex; `/mcp/{key}` for clients that can't set headers, like ChatGPT (feature 008).
  const token = parseBearer(event.headers.authorization) ?? parsePathKey(event.pathParameters?.key);
  const userId = token ? await deps.credentials.findUserId(hashToken(token)) : null;
  if (!userId) return apiError(401, "UNAUTHORIZED", "Invalid or missing access key") as APIGatewayProxyStructuredResultV2;

  const count = await deps.credentials.hit(userId, deps.now().getTime());
  if (count > RATE_LIMIT_PER_MINUTE) {
    const res = apiError(429, "RATE_LIMITED", "Too many requests; try again in a minute") as APIGatewayProxyStructuredResultV2;
    return { ...res, headers: { ...res.headers, "retry-after": "60" } };
  }

  const raw = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Request is too large") as APIGatewayProxyStructuredResultV2;
  }

  const profile = await deps.profiles.get(userId);
  if (!profile) {
    return apiError(409, "PROFILE_REQUIRED", "Finish profile setup in the app first") as APIGatewayProxyStructuredResultV2;
  }

  const request = new Request(`https://${event.requestContext.domainName}${event.rawPath}`, {
    method: "POST",
    headers: event.headers as Record<string, string>,
    body: raw,
  });
  const response = await serveMcp(
    {
      userId,
      timezone: profile.timezone,
      today: localDate(deps.now(), profile.timezone),
      calorieTarget: profile.dailyCalorieTarget,
      proteinTarget: profile.dailyProteinTarget ?? null,
      bodyWeight: effectiveBodyWeight(profile),
      deps,
    },
    request,
  );
  return {
    statusCode: response.status,
    headers: { ...Object.fromEntries(response.headers), "cache-control": "no-store" },
    body: await response.text(),
  };
}

export const handler: APIGatewayProxyHandlerV2 = (event) => handle(event, getDeps());
