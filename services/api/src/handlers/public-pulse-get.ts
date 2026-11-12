import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { addDays, localDate, type PulseResponse } from "@calci/shared";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/**
 * Anonymous squad pulse for the landing page (feature 009). Constitution VI allows exactly these two counts.
 * "Last 7 days" is each member's today and the 6 days before, in their own timezone (constitution V).
 */
export async function handle(_event: APIGatewayProxyEventV2, deps: Deps) {
  const now = deps.now();
  const members = await deps.profiles.listCommunity();
  const counts = await Promise.all(
    members.map(async (m) => {
      const today = localDate(now, m.timezone);
      return (await deps.workouts.listEntriesInRange(m.userId, addDays(today, -6), today)).length;
    }),
  );
  const body: PulseResponse = {
    lifters: members.length,
    workoutsLast7Days: counts.reduce((a, b) => a + b, 0),
    computedAt: now.toISOString(),
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2 = (event) => handle(event, getDeps());
