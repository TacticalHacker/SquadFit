import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ReactionResultSchema, ReactionTypeSchema, SQUAD_ID, isWorkoutEntry } from "@calci/shared";
import { getCaller } from "./auth";
import type { Deps } from "./deps";
import { apiError, ok } from "./http";
import { reactionsView } from "./member-view";
import { NO_REACTIONS } from "./squad-repo";
import { visibleTo } from "./squad-view";

/**
 * Feature 013: shared by PUT and DELETE /squad/feed/{id}/reactions/{type}. The id is `<authorUserId>~<eventId>`
 * (URL-encoded); type is fire | muscle | crown. Same rules as the feature 010/011 high-five it replaces. Logs nothing.
 */
export async function toggleReaction(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps, on: boolean) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const type = ReactionTypeSchema.safeParse(event.pathParameters?.type);
  if (!type.success) return apiError(400, "VALIDATION_FAILED", "Unknown reaction", { type: "Use fire, muscle or crown" });

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
  // Members never react to their own items.
  if (!authorProfile || !eventId || author === caller.userId || !visibleTo(authorProfile, caller.userId)) return apiError(404, "NOT_FOUND", "Feed item not found");

  const key = { userId: author, eventId };
  if (eventId.startsWith("day#") && on && !(await deps.squad.getFeed(author, eventId))) {
    // A workout day (feature 011): the target is created lazily, only for a day the author trained, never listed.
    const date = eventId.slice("day#".length);
    const trained = (await deps.workouts.listEntriesForDay(author, date)).some((e) => isWorkoutEntry(e));
    if (!trained) return apiError(404, "NOT_FOUND", "Feed item not found");
    const nowIso = deps.now().toISOString();
    await deps.squad.putFeed({ userId: author, squadId: SQUAD_ID, eventId, kind: "workout_day", eventDate: date, payload: {}, reactions: { ...NO_REACTIONS }, createdAt: nowIso, listed: false });
  }
  const counts = on
    ? await deps.squad.addReaction(key, type.data, caller.userId, deps.now().toISOString())
    : await deps.squad.removeReaction(key, type.data, caller.userId);
  if (counts === null) return apiError(404, "NOT_FOUND", "Feed item not found");
  const mine = await deps.squad.myReactions(caller.userId, [key]);
  return ok(ReactionResultSchema.parse({ reactions: reactionsView(counts, mine, author, eventId) }));
}
