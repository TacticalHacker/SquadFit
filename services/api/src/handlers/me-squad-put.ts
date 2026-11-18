import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SquadSettingsSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { squadSettingsOf } from "../lib/profile-repo";
import { safeRefresh } from "../lib/squad-stats";

/** PUT /me/squad : weekly target, leaderboard visibility, body weight sharing (feature 010, FR-003/004/006). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, SquadSettingsSchema);
  if (!parsed.ok) return parsed.response;
  const item = await deps.profiles.setSquadSettings(caller.userId, parsed.data, deps.now().toISOString());
  if (!item) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  // The current week's target changes with it, so rebuild.
  await safeRefresh(caller.userId, deps);
  return ok(squadSettingsOf(item));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
