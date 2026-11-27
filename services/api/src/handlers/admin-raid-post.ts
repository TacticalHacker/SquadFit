import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { RaidInputSchema, SQUAD_ID, isCounting, validateRaid, type Raid } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { json, parseBody } from "../lib/http";
import { listSquadRaids, newRaidId, raidFields, recountMembers, ruleError } from "../lib/raid-admin";
import { adminRaid } from "../lib/raid-view";

/** POST /admin/raids (feature 021, Story 3): create a draft, a scheduled raid, or one that starts now. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const denied = requireAdmin(caller);
  if (denied) return denied;
  const parsed = parseBody(event.body, RaidInputSchema);
  if (!parsed.ok) return parsed.response;

  const now = deps.now();
  const nowIso = now.toISOString();
  const raid: Raid = {
    raidId: newRaidId(now),
    squadId: SQUAD_ID,
    metric: "volume_kg",
    ...raidFields(parsed.data, now),
    totalKg: 0,
    createdBy: caller.username,
    createdAt: nowIso,
    updatedBy: caller.username,
    updatedAt: nowIso,
  };
  const issues = validateRaid(raid, await listSquadRaids(deps), now);
  if (issues.length) return ruleError(issues);
  await deps.raids.createRaid(raid);
  if (isCounting(raid, now)) await recountMembers(deps);
  const created = (await deps.raids.getRaid(raid.raidId)) ?? raid;
  return json(201, { raid: adminRaid(created, now) });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
