import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { MeTargetsInputSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { safeRefreshProtein } from "../lib/protein-events";
import { toOwnProfile } from "../lib/views";

/**
 * PUT /me/targets (feature 013): save and confirm the calorie and protein targets, or `{ dismiss: true }` to hide the
 * prompt. Never logs the targets.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, MeTargetsInputSchema);
  if (!parsed.ok) return parsed.response;
  const nowIso = deps.now().toISOString();
  const item =
    "dismiss" in parsed.data
      ? await deps.profiles.dismissTargetsPrompt(caller.userId, nowIso)
      : await deps.profiles.setTargets(caller.userId, parsed.data, nowIso);
  if (!item) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  // Confirming can start (or a new target end) a protein streak.
  if (!("dismiss" in parsed.data)) await safeRefreshProtein(caller.userId, deps);
  return ok({ username: item.username, profile: await toOwnProfile(item, deps.avatars) });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
