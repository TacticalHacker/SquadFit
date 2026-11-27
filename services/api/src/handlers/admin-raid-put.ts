import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { RaidUpdateSchema, isCounting, lockedChanges, raidStatus, raidTotal, validateRaid, type Raid } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { STALE_RAID, listSquadRaids, raidFields, recountMembers, ruleError } from "../lib/raid-admin";
import { settleRaid } from "../lib/raid-refresh";
import { adminRaid } from "../lib/raid-view";

/** PUT /admin/raids/{raidId} (feature 021, Story 4): edit under the rules of the raid's current state (FR-009). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const denied = requireAdmin(caller);
  if (denied) return denied;
  const parsed = parseBody(event.body, RaidUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const raidId = event.pathParameters?.raidId ?? "";
  const current = await deps.raids.getRaid(raidId);
  if (!current) return apiError(404, "NOT_FOUND", "Raid not found");
  if (current.updatedAt !== parsed.data.expectedUpdatedAt) return apiError(409, "STALE", STALE_RAID);

  const now = deps.now();
  const nowIso = now.toISOString();
  const status = raidStatus(current, now);
  const fields = raidFields(parsed.data, now);
  // A live raid keeps its start even if the form says "Start now".
  const next: Raid = { ...current, ...fields, ...(status === "live" || status === "won" ? { startsAt: current.startsAt } : {}), updatedAt: nowIso, updatedBy: caller.username };
  if (!fields.tagline) delete next.tagline;

  const contributions = status === "live" ? await deps.raids.listContributions(raidId) : [];
  const locked = lockedChanges(current, next, now, raidTotal(contributions.map((c) => c.rawKg), current));
  if (locked.length) return ruleError(locked);
  const others = (await listSquadRaids(deps)).filter((r) => r.raidId !== raidId);
  const issues = validateRaid(next, others, now, { startLocked: status === "live" });
  if (issues.length) return ruleError(issues);

  const result = await deps.raids.updateRaid(
    raidId,
    {
      name: next.name,
      tagline: next.tagline ?? null,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      targetKg: next.targetKg,
      filter: next.filter,
      capPct: next.capPct,
      lateJoiners: next.lateJoiners,
      showContributors: next.showContributors,
      stickerId: next.stickerId,
      draft: next.draft,
      updatedAt: nowIso,
      updatedBy: caller.username,
    },
    current.updatedAt,
  );
  if (result === "stale") return apiError(409, "STALE", STALE_RAID);

  const saved = (await deps.raids.getRaid(raidId)) ?? next;
  // A target lowered to the current progress wins at once; a raid moved to "now" counts today's sets.
  if (status === "live") await settleRaid(saved, deps, nowIso, null);
  else if (isCounting(saved, now)) await recountMembers(deps);
  return ok({ raid: adminRaid((await deps.raids.getRaid(raidId)) ?? saved, now) });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
