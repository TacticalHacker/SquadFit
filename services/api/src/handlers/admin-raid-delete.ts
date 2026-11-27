import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { raidStatus } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError } from "../lib/http";
import { STALE_RAID } from "../lib/raid-admin";

/** DELETE /admin/raids/{raidId} (feature 021): drafts and scheduled raids only (nothing has counted yet). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  const raidId = event.pathParameters?.raidId ?? "";
  const current = await deps.raids.getRaid(raidId);
  if (!current) return ({ statusCode: 204 });
  if (!["draft", "scheduled"].includes(raidStatus(current, deps.now()))) return apiError(409, "RAID_RULE", "Only drafts and scheduled raids can be deleted; cancel it instead");
  if ((await deps.raids.deleteRaid(raidId, current.updatedAt)) === "stale") return apiError(409, "STALE", STALE_RAID);
  return ({ statusCode: 204 });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
