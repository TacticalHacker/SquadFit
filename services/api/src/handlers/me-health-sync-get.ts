import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { ACTIVITY_MAX_DAYS, HealthSyncStatusSchema, addDays, localDate } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { stepSettingsOf } from "../lib/profile-repo";

/** GET /me/health-sync (feature 012): token status (never the token), the last sync and the step settings. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const profile = await deps.profiles.get(caller.userId);
  if (!profile) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const today = localDate(deps.now(), profile.timezone);
  const [cred, days] = await Promise.all([
    deps.healthTokens.get(caller.userId),
    deps.activity.listRange(caller.userId, addDays(today, -ACTIVITY_MAX_DAYS), today),
  ]);
  const last = days.reduce<(typeof days)[number] | null>((a, d) => (!a || d.syncedAt > a.syncedAt ? d : a), null);
  return ok(
    HealthSyncStatusSchema.parse({
      token: cred ? { createdAt: cred.createdAt, lastUsedAt: cred.lastUsedAt } : null,
      lastSync: last ? { syncedAt: last.syncedAt, source: last.source, date: last.date } : null,
      steps: stepSettingsOf(profile),
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
