import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { HighFiveResultSchema } from "@calci/shared";
import { getCaller } from "./auth";
import type { Deps } from "./deps";
import { apiError, ok } from "./http";
import { visibleTo } from "./squad-view";

/** Shared by PUT and DELETE /squad/feed/{id}/high-five. The id is `<authorUserId>~<eventId>` (URL-encoded). */
export async function toggleHighFive(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps, on: boolean) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  let raw = event.pathParameters?.id ?? "";
  try {
    raw = decodeURIComponent(raw); // the event id contains "#", so clients encode it
  } catch {
    return apiError(404, "NOT_FOUND", "Feed item not found");
  }
  const cut = raw.indexOf("~");
  const author = cut > 0 ? raw.slice(0, cut) : "";
  const eventId = cut > 0 ? raw.slice(cut + 1) : "";
  const authorProfile = author ? await deps.profiles.get(author) : null;
  if (!authorProfile || !eventId || !visibleTo(authorProfile, caller.userId)) return apiError(404, "NOT_FOUND", "Feed item not found");

  const key = { userId: author, eventId };
  const count = on
    ? await deps.squad.addHighFive(key, caller.userId, deps.now().toISOString())
    : await deps.squad.removeHighFive(key, caller.userId);
  if (count === null) return apiError(404, "NOT_FOUND", "Feed item not found");
  const mine = await deps.squad.myHighFives(caller.userId, [key]);
  return ok(HighFiveResultSchema.parse({ highFives: count, highFivedByMe: mine.size > 0 }));
}
