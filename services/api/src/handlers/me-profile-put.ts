import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { ProfileInputSchema, type MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok, parseBody } from "../lib/http";
import { toOwnProfile } from "../lib/views";
import { safeRefreshProtein } from "../lib/protein-events";
import { logWeight } from "../lib/weight-write";

/**
 * Creates the profile on first call (joining the community), otherwise updates the editable fields.
 * Feature 014: a changed body weight is recorded as today's weigh-in (the profile then follows the latest entry);
 * a cleared weight is ignored once the member has weigh-ins.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, ProfileInputSchema);
  if (!parsed.ok) return parsed.response;

  const { bodyWeightKg: weight, ...rest } = parsed.data;
  const before = await deps.profiles.get(caller.userId);
  const changed = typeof weight === "number" && weight !== before?.bodyWeightKg;
  const keepNull = weight === null && (await deps.weights.latest(caller.userId)) === null;
  const input = { ...rest, ...(weight === undefined || keepNull ? { bodyWeightKg: weight } : {}) };

  await deps.profiles.upsert(caller.userId, caller.username, input, deps.now().toISOString());
  await safeRefreshProtein(caller.userId, deps);
  if (changed) {
    const logged = await logWeight(caller, { weightKg: weight }, "M", deps);
    if (!logged.ok) return logged.response;
  }
  const item = (await deps.profiles.get(caller.userId))!;
  const body: MeResponse = { username: caller.username, userId: caller.userId, unreadNotifications: 0, isAdmin: caller.isAdmin, profile: await toOwnProfile(item, deps.avatars) };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
