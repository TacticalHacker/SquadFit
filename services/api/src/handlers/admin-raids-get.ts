import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SQUAD_ID, nextMondayStart, type AdminRaidsResponse } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { listSquadRaids } from "../lib/raid-admin";
import { adminRaid } from "../lib/raid-view";

/** GET /admin/raids (feature 021): every raid incl. drafts, plus the squad timezone and the form's default start. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  const now = deps.now();
  const [raids, settings] = await Promise.all([listSquadRaids(deps), deps.squad.getSquadSettings(SQUAD_ID)]);
  const body: AdminRaidsResponse = {
    raids: raids.sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((r) => adminRaid(r, now)),
    timezone: settings.timezone,
    defaultStartsAt: nextMondayStart(now, settings.timezone),
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
