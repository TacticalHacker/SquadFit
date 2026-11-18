import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { HighFiveResultSchema, SQUAD_ID } from "@calci/shared";
import { getCaller } from "./auth";
import type { Deps } from "./deps";
import { apiError, ok } from "./http";
import { isWorkoutEntry } from "@calci/shared";
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
  if (eventId.startsWith("day#")) {
    // A workout day (feature 011): not your own, and only a day the author actually trained. The target is created
    // lazily and is never listed in the squad feed.
    const date = eventId.slice("day#".length);
    if (author === caller.userId) return apiError(404, "NOT_FOUND", "Feed item not found");
    if (on && !(await deps.squad.getFeed(author, eventId))) {
      const trained = (await deps.workouts.listEntriesForDay(author, date)).some((e) => isWorkoutEntry(e));
      if (!trained) return apiError(404, "NOT_FOUND", "Feed item not found");
      const nowIso = deps.now().toISOString();
      await deps.squad.putFeed({ userId: author, squadId: SQUAD_ID, eventId, kind: "workout_day", eventDate: date, payload: {}, hi5Count: 0, createdAt: nowIso, listed: false });
    }
  }
  const count = on
    ? await deps.squad.addHighFive(key, caller.userId, deps.now().toISOString())
    : await deps.squad.removeHighFive(key, caller.userId);
  if (count === null) return apiError(404, "NOT_FOUND", "Feed item not found");
  const mine = await deps.squad.myHighFives(caller.userId, [key]);
  return ok(HighFiveResultSchema.parse({ highFives: count, highFivedByMe: mine.size > 0 }));
}
