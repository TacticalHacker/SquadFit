import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { ProfileMissingError } from "../lib/profile-repo";
import { toOwnProfile } from "../lib/views";

export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  let previous: string | null;
  try {
    previous = await deps.profiles.setAvatarKey(caller.userId, null, deps.now().toISOString());
  } catch (err) {
    if (err instanceof ProfileMissingError) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
    throw err;
  }
  if (previous) await deps.avatars.delete(previous);

  const updated = await deps.profiles.get(caller.userId);
  const body: MeResponse = {
    username: caller.username, userId: caller.userId, unreadNotifications: 0,
    isAdmin: caller.isAdmin,
    profile: updated ? await toOwnProfile(updated, deps.avatars) : null,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
