import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { FINAL_RAID_STATUSES, countedKg, raidPct, raidStatus, type RaidHistoryResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { listSquadRaids } from "../lib/raid-admin";

const LIMIT = 20;

/** GET /squad/raids (feature 021, Story 5): finished raids, newest first, with the viewer's own kg only. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const now = deps.now();
  const finished = (await listSquadRaids(deps))
    .filter((r) => FINAL_RAID_STATUSES.includes(raidStatus(r, now)))
    .sort((a, b) => (b.cancelledAt ?? b.endsAt).localeCompare(a.cancelledAt ?? a.endsAt))
    .slice(0, LIMIT);
  const own = await Promise.all(finished.map((r) => deps.raids.getContribution(r.raidId, caller.userId)));
  const body: RaidHistoryResponse = {
    raids: finished.map((r, i) => ({
      raidId: r.raidId,
      name: r.name,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      status: raidStatus(r, now) as "won" | "ended" | "cancelled",
      targetKg: r.targetKg,
      totalKg: r.totalKg,
      pct: raidPct(r.totalKg, r.targetKg),
      youKg: own[i] && own[i]!.setCount > 0 ? countedKg(own[i]!.rawKg, r) : null,
    })),
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
