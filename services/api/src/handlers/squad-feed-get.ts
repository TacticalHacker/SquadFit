import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SQUAD_ID, SquadFeedSchema, type SquadFeedItem } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { feedId, type FeedItem } from "../lib/squad-repo";
import { sharedLevel, stepsShared } from "../lib/member-access";
import { reactionsView } from "../lib/member-view";
import { feedWorkout } from "../lib/share-summary";
import { squadMember, visibleTo } from "../lib/squad-view";

const PAGE = 50;

/** GET /squad/feed?limit=5|20 : the newest events of visible members, newest first (feature 010, FR-027; 013). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const SHOWN = event.queryStringParameters?.limit === "5" ? 5 : 20;
  const byId = new Map((await deps.profiles.listCommunity()).map((p) => [p.userId, p]));
  const picked: FeedItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await deps.squad.listSquadFeed(SQUAD_ID, PAGE, startKey);
    for (const item of page.items) {
      const author = byId.get(item.userId);
      if (!author || !visibleTo(author, caller.userId)) continue;
      // Day reaction targets (feature 011) list only once posted (feature 016).
      if (item.kind === "workout_day" && item.postedAt === undefined) continue;
      // PRs on members' own exercises stay on their profile (day cards), not in the squad feed.
      if (item.kind === "pr" && !item.eventId.startsWith("pr#gx-")) continue;
      if (item.kind === "protein_streak" && sharedLevel(author) === "off") continue;
      if (item.kind === "step_streak" && !stepsShared(author)) continue;
      picked.push(item);
      if (picked.length === SHOWN) break;
    }
    startKey = picked.length < SHOWN ? page.lastKey : undefined;
  } while (startKey);

  const mine = await deps.squad.myReactions(caller.userId, picked);
  const posters = [...new Set(picked.filter((f) => f.kind === "workout_day").map((f) => f.userId))];
  const stats = posters.length ? await deps.squad.batchGetStats(posters) : new Map();
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
            ? {
                exerciseName: p.exerciseName as string,
                weightKg: p.weightKg as number,
                reps: p.reps as number,
                e1rm: (p.e1rm as number | null) ?? null,
                gainKg: (p.gainKg as number | null | undefined) ?? null,
              }
            : null,
        week: f.kind === "streak_week" ? (p.week as number) : null,
        club: f.kind === "badge" ? (p.club as SquadFeedItem["club"]) : null,
        workout: f.kind === "workout_day" ? await feedWorkout(byId.get(f.userId)!, f, stats.get(f.userId) ?? null, deps) : null,
        reactions: reactionsView(f.reactions, mine, f.userId, f.eventId),
        canReact: f.userId !== caller.userId,
        createdAt: f.postedAt ?? f.createdAt,
      };
    }),
  );
  return ok(SquadFeedSchema.parse({ items }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
