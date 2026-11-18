import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { extractActivityDays } from "@calci/shared";
import { hashToken, parseHealthBearer } from "@calci/shared/ai-credential";
import { saveActivity } from "../lib/activity-write";
import { getDeps, type Deps } from "../lib/deps";
import { HEALTH_RATE_LIMIT_PER_HOUR } from "../lib/health-token-repo";
import { apiError, json, ok } from "../lib/http";

const MAX_BODY_BYTES = 1024 * 1024;

const unauthorized = () =>
  apiError(401, "UNAUTHORIZED", "Health sync token is missing or no longer valid. Generate a new one in SquadFit Settings.");

/**
 * POST /integrations/activity (feature 012): an iPhone Shortcut or the Health Auto Export app saves daily steps with
 * the member's Health sync token. No Cognito authorizer; the token is the only credential accepted here, and it is
 * accepted nowhere else. Never logs the token, the path headers or the body.
 */
export async function handle(event: APIGatewayProxyEventV2, deps: Deps): Promise<APIGatewayProxyResultV2> {
  const token = parseHealthBearer(event.headers?.authorization);
  const userId = token ? await deps.healthTokens.findUserId(hashToken(token)) : null;
  if (!userId) return unauthorized();

  const nowMs = deps.now().getTime();
  if ((await deps.healthTokens.hit(userId, nowMs)) > HEALTH_RATE_LIMIT_PER_HOUR) {
    const res = apiError(429, "RATE_LIMITED", "Too many syncs this hour; try again later") as { headers?: Record<string, string> };
    return { ...res, headers: { ...res.headers, "retry-after": String(3600 - Math.floor((nowMs % 3_600_000) / 1000)) } };
  }

  const raw = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return apiError(413, "PAYLOAD_TOO_LARGE", "Request is too large; send at most 31 days");

  const profile = await deps.profiles.get(userId);
  if (!profile) return apiError(409, "PROFILE_REQUIRED", "Finish profile setup in the SquadFit app first");
  await deps.healthTokens.touch(userId, deps.now().toISOString());

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(422, { error: { code: "VALIDATION_FAILED", message: "Request body must be JSON with a days list" } });
  }
  const extracted = extractActivityDays(body);
  if (!extracted.ok) return json(422, { error: { code: "VALIDATION_FAILED", message: extracted.message } });

  const outcome = await saveActivity(profile, extracted.days, extracted.source, deps);
  if (!outcome.ok) {
    const fields = Object.fromEntries(outcome.problems.map((p) => [`${p.label}.${p.field}`, p.message]));
    return json(422, { error: { code: "VALIDATION_FAILED", message: outcome.message, fields } });
  }
  return ok(outcome.result);
}

export const handler: APIGatewayProxyHandlerV2 = (event) => handle(event, getDeps());
