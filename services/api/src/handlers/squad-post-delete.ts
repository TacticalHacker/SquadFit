import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SharePostResultSchema, localDate } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { postState } from "../lib/share-summary";

/**
 * DELETE /squad/posts/{date} : take the caller's workout day out of the squad feed and delete its photo (feature 016).
 * Reactions stay: they also belong to the day's card on the member's profile. Idempotent.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const profile = await deps.profiles.get(caller.userId);
  if (!profile) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const day = resolveReadDate(event.pathParameters?.date ?? "", localDate(deps.now(), profile.timezone));
  if (!day.ok) return day.response;

  const before = await deps.squad.unpostDay(caller.userId, day.date);
  if (before?.photoKey) await deps.sharePhotos.delete(before.photoKey);
  return ok(SharePostResultSchema.parse({ post: postState(profile, null) }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
