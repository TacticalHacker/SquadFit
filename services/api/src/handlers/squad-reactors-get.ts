import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { reactorsView } from "../lib/notifications";
import { parseFeedTarget } from "../lib/reaction";
import { visibleTo } from "../lib/squad-view";

/**
 * GET /squad/feed/{id}/reactions (feature 022): who reacted to a feed item or workout day, per type. Same id and
 * visibility rule as the toggle; hidden reactors are only counted. Logs nothing.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const { author, eventId } = parseFeedTarget(event.pathParameters?.id);
  const authorProfile = author ? await deps.profiles.get(author) : null;
  if (!authorProfile || !eventId || !visibleTo(authorProfile, caller.userId)) return apiError(404, "NOT_FOUND", "Feed item not found");
  return ok(await reactorsView({ userId: author, eventId }, caller.userId, deps));
}
