import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SquadWeightSchema, localDate, rangeWindow, weightChangeLine } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { squadSettingsOf } from "../lib/profile-repo";
import { visibleTo } from "../lib/squad-view";
import { avatarUrl } from "../lib/views";
import { parseWeightRange } from "../lib/weight-range";

/**
 * GET /squad/weight?range= (feature 017): the squad weight chart. Members who share their weight and are visible to
 * the caller, each as kg change from their first weigh-in in the window (the caller's own window). Never absolute
 * weight, targets or timezone. Logs nothing.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const range = parseWeightRange(event);
  if (!range.ok) return range.response;
  const me = await deps.profiles.get(caller.userId);
  if (!me) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const today = localDate(deps.now(), me.timezone);
  const win = rangeWindow(range.range, today);
  const sharers = (await deps.profiles.listCommunity()).filter((p) => visibleTo(p, caller.userId) && squadSettingsOf(p).shareBodyWeight);

  const lines = await Promise.all(
    sharers.map(async (p) => {
      const items = await deps.weights.listRange(p.userId, win.fetchFrom, today);
      const line = weightChangeLine(
        range.range,
        today,
        items.map((i) => ({ id: i.entryId, date: i.date, recordedAt: i.recordedAt, weightKg: i.weightKg })),
      );
      if (!line) return null;
      const isYou = p.userId === caller.userId;
      return { member: { userId: p.userId, displayName: p.displayName, avatarUrl: await avatarUrl(p, deps.avatars), isYou }, ...line };
    }),
  );

  const members = lines
    .filter((l) => l !== null)
    .sort((a, b) => Number(b.member.isYou) - Number(a.member.isYou) || a.member.displayName.localeCompare(b.member.displayName));

  return ok(
    SquadWeightSchema.parse({
      range: range.range,
      start: win.start,
      end: win.end,
      slots: win.slots,
      sharing: squadSettingsOf(me).shareBodyWeight,
      members,
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
