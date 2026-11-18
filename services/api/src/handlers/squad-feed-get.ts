import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SQUAD_ID, SquadFeedSchema, type SquadFeedItem } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { feedId, type FeedItem } from "../lib/squad-repo";
import { sharedLevel, stepsShared } from "../lib/member-access";
import { squadMember, visibleTo } from "../lib/squad-view";

const SHOWN = 20;
const PAGE = 50;

/** GET /squad/feed : the 20 newest events of visible members, newest first (feature 010, FR-027). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const byId = new Map((await deps.profiles.listCommunity()).map((p) => [p.userId, p]));
  const picked: FeedItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await deps.squad.listSquadFeed(SQUAD_ID, PAGE, startKey);
    for (const item of page.items) {
      const author = byId.get(item.userId);
      if (!author || !visibleTo(author, caller.userId)) continue;
      if (item.kind === "workout_day") continue;
      if (item.kind === "protein_streak" && sharedLevel(author) === "off") continue;
      if (item.kind === "step_streak" && !stepsShared(author)) continue;
      picked.push(item);
      if (picked.length === SHOWN) break;
    }
    startKey = picked.length < SHOWN ? page.lastKey : undefined;
  } while (startKey);

  const mine = await deps.squad.myHighFives(caller.userId, picked);
  const items: SquadFeedItem[] = await Promise.all(
    picked.map(async (f) => {
      const p = f.payload;
      return {
        id: feedId(f.userId, f.eventId),
        member: await squadMember(byId.get(f.userId)!, caller.userId, deps.avatars),
        kind: f.kind as SquadFeedItem["kind"],
        date: f.eventDate,
        pr:
          f.kind === "pr"
            ? { exerciseName: p.exerciseName as string, weightKg: p.weightKg as number, reps: p.reps as number, e1rm: (p.e1rm as number | null) ?? null }
            : null,
        week: f.kind === "streak_week" ? (p.week as number) : null,
        highFives: f.hi5Count,
        highFivedByMe: mine.has(feedId(f.userId, f.eventId)),
        createdAt: f.createdAt,
      };
    }),
  );
  return ok(SquadFeedSchema.parse({ items }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
