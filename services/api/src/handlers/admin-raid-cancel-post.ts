import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { RaidCancelSchema, raidStatus } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { STALE_RAID } from "../lib/raid-admin";
import { adminRaid } from "../lib/raid-view";

/** POST /admin/raids/{raidId}/cancel (feature 021, FR-010): only draft, scheduled or live raids; stickers given stay. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const denied = requireAdmin(caller);
  if (denied) return denied;
  const parsed = parseBody(event.body, RaidCancelSchema);
  if (!parsed.ok) return parsed.response;
  const raidId = event.pathParameters?.raidId ?? "";
  const current = await deps.raids.getRaid(raidId);
  if (!current) return apiError(404, "NOT_FOUND", "Raid not found");
  const now = deps.now();
  if (!["draft", "scheduled", "live"].includes(raidStatus(current, now))) return apiError(409, "RAID_RULE", "This raid is finished and can't be cancelled");
  const nowIso = now.toISOString();
  const result = await deps.raids.updateRaid(
    raidId,
    { cancelledAt: nowIso, cancelReason: parsed.data.reason || null, updatedAt: nowIso, updatedBy: caller.username },
    parsed.data.expectedUpdatedAt,
  );
  if (result === "stale") return apiError(409, "STALE", STALE_RAID);
  return ok({ raid: adminRaid((await deps.raids.getRaid(raidId))!, now) });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
