import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { MUSCLE_GROUPS, SQUAD_ID, addDays, daysBetween, localDate, raidContribution, suggestTarget, zonedInstant, type RaidFilter } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";

const WINDOW_DAYS = 28;
const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * GET /admin/raids/suggest?start=&end=&groups=&exercises= (feature 021, FR-008): the squad's average weekly counted
 * volume over the last 4 weeks (every member, hidden ones included), scaled to the raid length, + 10%.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  const q = event.queryStringParameters ?? {};
  const start = Date.parse(q.start ?? "");
  const end = Date.parse(q.end ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return apiError(400, "VALIDATION_FAILED", "Choose a start and an end");
  const groups = list(q.groups).filter((g): g is RaidFilter["groups"][number] => (MUSCLE_GROUPS as readonly string[]).includes(g) && g !== "cardio");
  const exerciseIds = list(q.exercises);
  const filter: RaidFilter | null = groups.length || exerciseIds.length ? { groups, exerciseIds } : null;

  const { timezone } = await deps.squad.getSquadSettings(SQUAD_ID);
  const today = localDate(deps.now(), timezone);
  const from = addDays(today, -WINDOW_DAYS);
  const window = { startsAt: zonedInstant(from, "00:00", timezone), endsAt: zonedInstant(today, "00:00", timezone), filter, lateJoiners: true };

  let total = 0;
  let earliest: string | null = null;
  for (const p of await deps.profiles.listCommunity()) {
    const entries = await deps.workouts.listEntriesInRange(p.userId, from, addDays(today, -1));
    const counted = raidContribution(entries, window, { timezone, held: {}, memberCreatedAt: p.createdAt });
    total += counted.rawKg;
    for (const e of entries) if (e.kind === "gym" && e.exerciseKind !== "cardio" && (!earliest || e.date < earliest)) earliest = e.date;
  }
  const historyDays = earliest ? daysBetween(earliest, today) : 0;
  return ok({ suggestedKg: suggestTarget(total, historyDays, (end - start) / 86_400_000) });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
