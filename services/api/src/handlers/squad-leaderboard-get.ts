import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import {
  PeriodSchema,
  SquadLeaderboardFullSchema,
  SquadLeaderboardSchema,
  addDays,
  buildBoards,
  dateRange,
  hitDays,
  isWorkoutEntry,
  localDate,
  proteinByDay,
  rankNutrition,
  rankSteps,
  stepsBoardRow,
  weekStart,
  type BoardMember,
} from "@calci/shared";
import { resolveReadDate } from "../lib/day-context";
import { sharedLevel, stepsShared, stepsVisibleTo } from "../lib/member-access";
import { nutritionOn, stepsFor } from "../lib/member-view";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { squadSettingsOf, stepSettingsOf } from "../lib/profile-repo";
import { squadMember, visibleTo } from "../lib/squad-view";
import { avatarUrl } from "../lib/views";

/**
 * GET /squad/leaderboard?period=&exercise= : all four boards for the caller (feature 010).
 * Hidden members are dropped here, on the server, before ranking (FR-003). Nothing is logged.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const q = event.queryStringParameters ?? {};
  const period = PeriodSchema.safeParse(q.period ?? "week");
  if (!period.success) return apiError(400, "VALIDATION_FAILED", "Invalid period", { period: "Use week, 30d or all" });

  const me = (await deps.profiles.get(caller.userId))!;
  const day = resolveReadDate(q.date, localDate(deps.now(), me.timezone));
  if (!day.ok) return day.response;

  const profiles = (await deps.profiles.listCommunity()).filter((p) => visibleTo(p, caller.userId));
  const stats = await deps.squad.batchGetStats(profiles.map((p) => p.userId));
  const now = deps.now();
  const members: BoardMember[] = await Promise.all(
    profiles.map(async (p) => {
      const s = squadSettingsOf(p);
      return {
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: await avatarUrl(p, deps.avatars),
        today: localDate(now, p.timezone),
        joinedDate: localDate(new Date(p.createdAt), p.timezone),
        weeklyTarget: s.weeklyTarget,
        visible: s.leaderboardVisible,
        shareBodyWeight: s.shareBodyWeight,
        bodyWeightKg: p.bodyWeightKg ?? null,
        // A member with no stats yet shows as 0 / "—" rather than disappearing.
        stats: stats.get(p.userId) ?? null,
      };
    }),
  );
  const boards = buildBoards({ members, viewerId: caller.userId, period: period.data, exercise: q.exercise ?? "gx-bench-press" });
  const base = SquadLeaderboardSchema.parse(boards);

  // Feature 011. Members at level off never enter any of this, and only totals (never meals) are shown on rows.
  const sharing = profiles.filter((p) => p.userId !== caller.userId && sharedLevel(p) !== "off");
  const trainedOn = (
    await Promise.all(profiles.map(async (p) => ((await deps.workouts.listEntriesForDay(p.userId, day.date)).some((e) => isWorkoutEntry(e)) ? p.userId : null)))
  ).filter((id): id is string => id !== null);
  const nutritionToday = (
    await Promise.all(
      sharing.map(async (p) => {
        const workouts = await deps.workouts.listEntriesForDay(p.userId, day.date);
        const nutrition = await nutritionOn(p, "totals", day.date, workouts, deps);
        return nutrition ? { userId: p.userId, nutrition } : null;
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  // The viewer's own line follows the same rule as everyone else's: shown only when they share.
  if (profiles.some((p) => p.userId === caller.userId) && sharedLevel(me) !== "off") {
    const nutrition = await nutritionOn(me, "totals", day.date, await deps.workouts.listEntriesForDay(caller.userId, day.date), deps);
    if (nutrition) nutritionToday.push({ userId: caller.userId, nutrition });
  }

  // Nutrition board: members sharing with a protein target, ranked on their own hit days only.
  const nutritionPeriod = period.data === "30d" ? "30d" : "week";
  const candidates = profiles.filter((p) => sharedLevel(p) !== "off" && p.dailyProteinTarget !== undefined);
  const scored = await Promise.all(
    candidates.map(async (p) => {
      const todayLocal = localDate(now, p.timezone);
      const dates = dateRange(nutritionPeriod === "30d" ? addDays(todayLocal, -29) : weekStart(todayLocal), todayLocal);
      const byDay = proteinByDay(await deps.food.listEntriesInRange(p.userId, dates[0]!, todayLocal));
      const { hit, logged } = hitDays(byDay, dates, p.dailyProteinTarget!);
      return { userId: p.userId, name: p.displayName, hit, logged, periodDays: dates.length, profile: p };
    }),
  );
  const rows = await Promise.all(
    rankNutrition(scored).map(async (r) => ({
      member: base.streaks.find((x) => x.member.userId === r.userId)?.member ?? (await squadMember(r.profile, caller.userId, deps.avatars)),
      rank: r.rank,
      hitDays: r.hit,
      periodDays: r.periodDays,
      daysLogged: r.logged,
    })),
  );
  const myLevel = me.nutritionSharing ?? "off";

  // Feature 012. Steps only through the steps gate; ranked by average over synced days, never by calories.
  const stepsToday = (
    await Promise.all(
      profiles.map(async (p) => {
        const s = (await stepsFor(p, caller.userId, day.date, day.date, deps)).get(day.date);
        return s ? { userId: p.userId, ...s } : null;
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  const stepsPeriod = period.data === "30d" ? "30d" : "week";
  const stepScored = (
    await Promise.all(
      profiles
        .filter((p) => stepsShared(p) && stepsVisibleTo(p, caller.userId))
        .map(async (p) => {
          const todayLocal = localDate(now, p.timezone);
          const dates = dateRange(stepsPeriod === "30d" ? addDays(todayLocal, -29) : weekStart(todayLocal), todayLocal);
          const byDay = new Map((await deps.activity.listRange(p.userId, dates[0]!, todayLocal)).map((d) => [d.date, d.steps] as const));
          const row = stepsBoardRow(byDay, dates, stepSettingsOf(p).dailyStepGoal);
          return row ? { ...row, userId: p.userId, name: p.displayName, profile: p } : null;
        }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  const stepRows = await Promise.all(
    rankSteps(stepScored).map(async (r) => ({
      member: base.streaks.find((x) => x.member.userId === r.userId)?.member ?? (await squadMember(r.profile, caller.userId, deps.avatars)),
      rank: r.rank,
      avgSteps: r.avgSteps,
      hitDays: r.hitDays,
      periodDays: r.periodDays,
      syncedDays: r.syncedDays,
    })),
  );

  // The strict schema guarantees nothing but the allowed fields leave the server (constitution VI).
  return ok(
    SquadLeaderboardFullSchema.parse({
      ...base,
      date: day.date,
      today: localDate(now, me.timezone),
      trainedOn,
      nutritionToday,
      nutrition: { rows, viewer: { level: myLevel, needsTarget: myLevel !== "off" && me.dailyProteinTarget === undefined } },
      viewer: { nutritionPrompt: me.nutritionPromptSeen !== true },
      stepsToday,
      stepsBoard: { period: stepsPeriod, rows: stepRows, viewer: { sharing: stepsShared(me) } },
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
