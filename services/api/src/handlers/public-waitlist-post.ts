import { createHash } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { WaitlistRequestSchema, type WaitlistResponse } from "@calci/shared";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, json, parseBody } from "../lib/http";
import { WAITLIST_LIMIT_OVERALL, WAITLIST_LIMIT_PER_ADDRESS } from "../lib/waitlist-repo";

const received: WaitlistResponse = { status: "received" };

/**
 * "Request Squad Invite" (feature 009), no authorizer. Same 202 for new, duplicate and honeypot submissions,
 * so the response never reveals whether an email is listed. Never logs the body, headers or address (FR-021).
 */
export async function handle(event: APIGatewayProxyEventV2, deps: Deps) {
  const parsed = parseBody(event.body, WaitlistRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { website, ...entry } = parsed.data;
  if (website) return json(202, received); // honeypot (research R6)

  // The web server forwards the visitor address; direct callers fall back to their own (research R4).
  const address = event.headers?.["x-sf-client-ip"] || event.requestContext?.http?.sourceIp || "unknown";
  const fingerprint = createHash("sha256").update(address).digest("hex").slice(0, 32);
  const now = deps.now();
  const hour = Math.floor(now.getTime() / 3_600_000);
  const [mine, overall] = await Promise.all([
    deps.waitlist.hit(`ip#${fingerprint}`, hour),
    deps.waitlist.hit("all", hour),
  ]);
  if (mine > WAITLIST_LIMIT_PER_ADDRESS || overall > WAITLIST_LIMIT_OVERALL) {
    return apiError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }

  await deps.waitlist.add(entry, now.toISOString());
  return json(202, received);
}

export const handler: APIGatewayProxyHandlerV2 = (event) => handle(event, getDeps());
