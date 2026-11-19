import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { HallOfFameSchema, buildHallOfFame, clubOf, stepMonthAverages } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { stepsShared } from "../lib/member-access";
import { loadSquadMembers } from "../lib/squad-members";

/** GET /squad/hall-of-fame (feature 013): all-time records; hidden members never hold one. Logs nothing. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const { members } = await loadSquadMembers(caller.userId, deps);
  // Steps only for members who share them with everyone (the record is shown to everyone).
  const stepMonths = new Map<string, Record<string, number>>();
  await Promise.all(
    members
      .filter((m) => m.visible && stepsShared(m.profile))
      .map(async (m) => stepMonths.set(m.userId, stepMonthAverages(await deps.activity.listRange(m.userId, "0000-01-01", m.today)))),
  );
  const byId = new Map(members.map((m) => [m.userId, m]));
  const records = buildHallOfFame({ members, viewerId: caller.userId, stepMonths }).map((r) => {
    const m = r.holderId ? byId.get(r.holderId)! : null;
    const { holderId: _h, ...rest } = r;
    return {
      ...rest,
      holder: m ? { userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl, isYou: m.userId === caller.userId } : null,
      club: m ? clubOf(m.stats) : null,
    };
  });
  return ok(HallOfFameSchema.parse({ records }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
