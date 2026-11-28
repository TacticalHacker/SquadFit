import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { notificationsView } from "../lib/notifications";

/** GET /me/notifications (feature 022): the caller's reaction notifications. No side effects; logs nothing. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  return ok(await notificationsView(caller.userId, deps));
}
