import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { buildFoodDay, dayGymVolume, summarize, type CoachPulseResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/**
 * GET /coach-note?date= : the caller's overall AI coach note for the day plus that day's live metrics
 * (net calories, protein, gym volume), or nulls. Feature 007, research R7. Never logs the note.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveReadDate(event.queryStringParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;

  const item = await deps.coach.get(caller.userId, d.date);
  if (!item) return ok({ note: null, metrics: null } satisfies CoachPulseResponse);

  const [food, workouts] = await Promise.all([
    deps.food.listEntriesForDay(caller.userId, d.date),
    deps.workouts.listEntriesForDay(caller.userId, d.date),
  ]);
  // Same ledger math as the Food screen (feature 003); pending photo meals count in nothing.
  const { ledger } = buildFoodDay({
    date: d.date,
    today: c.ctx.today,
    timezone: c.ctx.timezone,
    target: c.ctx.target,
    proteinTarget: c.ctx.proteinTarget,
    burnedCalories: summarize(workouts).totalCalories,
    entries: food,
  });
  const body: CoachPulseResponse = {
    note: {
      date: item.date,
      headline: item.headline,
      status: item.status,
      highlights: item.highlights,
      actions: item.actions,
      generatedBy: "AI",
      updatedAt: item.updatedAt,
    },
    metrics: { netCalories: ledger.net, proteinG: ledger.macros.protein, gymVolumeKg: dayGymVolume(workouts) },
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
