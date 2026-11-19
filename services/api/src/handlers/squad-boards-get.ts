import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SquadBoardsSchema, buildSquadBoards, hitDays, monthDates, proteinByDay, stepsBoardRow } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { sharedLevel, stepsShared, stepsVisibleTo } from "../lib/member-access";
import { squadSettingsOf, stepSettingsOf } from "../lib/profile-repo";
import { loadSquadMembers } from "../lib/squad-members";

/**
 * GET /squad/boards (feature 013): every board's full ranked list for the current squad month. Steps and protein go
 * through their existing gates here; nothing ranks or carries calories, targets or body weight. Logs nothing.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const me = await deps.profiles.get(caller.userId);
  if (!me) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");

  const { members, month } = await loadSquadMembers(caller.userId, deps);

  // Steps (feature 012 gate): average over synced days this month, members with none are absent.
  const steps = new Map<string, { avgSteps: number; syncedDays: number }>();
  await Promise.all(
    members
      .filter((m) => stepsShared(m.profile) && stepsVisibleTo(m.profile, caller.userId))
      .map(async (m) => {
        const dates = monthDates(month, m.today);
        if (dates.length === 0) return;
        const byDay = new Map((await deps.activity.listRange(m.userId, dates[0]!, dates.at(-1)!)).map((d) => [d.date, d.steps] as const));
        const row = stepsBoardRow(byDay, dates, stepSettingsOf(m.profile).dailyStepGoal);
        if (row) steps.set(m.userId, { avgSteps: row.avgSteps, syncedDays: row.syncedDays });
      }),
  );

  // Protein days (feature 011 gate + 013): sharing, visible, with a confirmed protein target. Never calories.
  const protein = new Map<string, { hitDays: number; periodDays: number }>();
  await Promise.all(
    members
      .filter((m) => sharedLevel(m.profile) !== "off" && m.profile.dailyProteinTarget !== undefined && m.profile.targetsConfirmedAt !== undefined)
      .map(async (m) => {
        const dates = monthDates(month, m.today);
        if (dates.length === 0) return;
        const byDay = proteinByDay(await deps.food.listEntriesInRange(m.userId, dates[0]!, dates.at(-1)!));
        const { hit, logged } = hitDays(byDay, dates, m.profile.dailyProteinTarget!);
        if (logged > 0) protein.set(m.userId, { hitDays: hit, periodDays: dates.length });
      }),
  );

  const boards = buildSquadBoards({ members, viewerId: caller.userId, month, steps, protein }).filter((b) => b.id !== "protein" || b.rows.length > 0);
  return ok(
    SquadBoardsSchema.parse({
      month,
      viewer: {
        hidden: !squadSettingsOf(me).leaderboardVisible,
        nutritionPrompt: me.nutritionPromptSeen !== true,
        targetsPrompt: me.targetsConfirmedAt === undefined && me.targetsPromptDismissed !== true,
      },
      boards,
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
