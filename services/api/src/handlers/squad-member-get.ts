import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { DEFAULT_LIFT_IDS, MemberProfileSchema, addDays, heatmapCells, localDate, streakFigures, HEATMAP_WEEKS, weekStart } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { resolveMember } from "../lib/member-access";
import { squadSettingsOf } from "../lib/profile-repo";
import { squadMember } from "../lib/squad-view";

/** GET /squad/members/{memberId} : header, PR board and heatmap of a visible member (feature 011). Nothing is logged. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const access = await resolveMember(caller.userId, event.pathParameters?.memberId, deps);
  if (!access.ok) return access.response;

  const { profile } = access;
  const today = localDate(deps.now(), profile.timezone);
  const from = addDays(weekStart(today), -7 * (HEATMAP_WEEKS - 1));
  const [stats, entries] = await Promise.all([deps.squad.getStats(profile.userId), deps.workouts.listEntriesInRange(profile.userId, from, today)]);
  const target = squadSettingsOf(profile).weeklyTarget;
  const streak = streakFigures(stats?.weeks ?? {}, today, target);

  const order = (id: string) => {
    const i = (DEFAULT_LIFT_IDS as readonly string[]).indexOf(id);
    return i === -1 ? DEFAULT_LIFT_IDS.length : i;
  };
  const prs = Object.entries(stats?.lifts ?? {})
    .filter(([id, l]) => (id.startsWith("gx-") || order(id) < DEFAULT_LIFT_IDS.length) && (l.best || l.bestE1rm))
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([exerciseId, l]) => ({
      exerciseId,
      exerciseName: l.name,
      best: l.best ? { weightKg: l.best.weightKg, reps: l.best.reps, e1rm: l.best.e1rm, date: l.best.date } : null,
      bestE1rm: l.bestE1rm ? { weightKg: l.bestE1rm.weightKg, reps: l.bestE1rm.reps, e1rm: l.bestE1rm.e1rm, date: l.bestE1rm.date } : null,
    }));

  return ok(
    MemberProfileSchema.parse({
      member: await squadMember(profile, caller.userId, deps.avatars),
      memberSince: localDate(new Date(profile.createdAt), profile.timezone),
      streak: { current: streak.current, best: streak.best },
      weeklyTarget: target,
      week: { days: streak.weekDays, target },
      prs,
      heatmap: { cells: heatmapCells(entries, today) },
      nutritionLevel: access.level,
      isYou: access.isYou,
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
