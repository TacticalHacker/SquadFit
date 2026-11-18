import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { PeriodSchema, SquadLeaderboardSchema, buildBoards, localDate, type BoardMember } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { squadSettingsOf } from "../lib/profile-repo";
import { visibleTo } from "../lib/squad-view";
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
  // The strict schema guarantees nothing but the allowed fields leave the server (constitution VI).
  return ok(SquadLeaderboardSchema.parse(boards));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
