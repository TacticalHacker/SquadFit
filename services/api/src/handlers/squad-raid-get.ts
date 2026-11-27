import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { RAID_LIMITS, pickRaidCard, raidStatus, type RaidCardResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { listSquadRaids } from "../lib/raid-admin";
import { awardSticker } from "../lib/raid-refresh";
import { buildRaidCard } from "../lib/raid-view";

/** GET /squad/raid (feature 021): the Squad tab raid card in one request. Never logs kg or names. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const now = deps.now();
  const raids = await listSquadRaids(deps);
  const { card, next } = pickRaidCard(raids, now);
  const scheduled = raids.filter((r) => raidStatus(r, now) === "scheduled").length;
  const body: RaidCardResponse = {
    card: null,
    next: next ? { raidId: next.raidId, name: next.name, startsAt: next.startsAt } : null,
    canManage: caller.isAdmin,
    canCreate: caller.isAdmin && scheduled < RAID_LIMITS.maxScheduled,
  };
  if (card) {
    const [contributions, profiles] = await Promise.all([deps.raids.listContributions(card.raidId), deps.profiles.listCommunity()]);
    const own = contributions.find((c) => c.userId === caller.userId);
    const earned = Boolean(card.wonAt && own && own.setCount > 0);
    // Repair: a contributor to a won raid always holds the sticker, even if the award after the win failed (R5).
    if (earned) await awardSticker(card, caller.userId, deps, now.toISOString()).catch((err: unknown) => console.error("raid sticker repair failed", err instanceof Error ? err.name : "unknown"));
    body.card = await buildRaidCard({
      raid: card,
      contributions,
      viewerId: caller.userId,
      profiles: new Map(profiles.map((p) => [p.userId, p])),
      avatars: deps.avatars,
      now,
      hasSticker: earned,
    });
  }
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
