import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { StepSettingsSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { stepSettingsOf } from "../lib/profile-repo";
import { safeRefreshSteps } from "../lib/step-events";

/** PUT /me/steps (feature 012): daily step goal and "Share my steps". A change applies to past days at once. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, StepSettingsSchema);
  if (!parsed.ok) return parsed.response;
  const item = await deps.profiles.setStepSettings(caller.userId, parsed.data, deps.now().toISOString());
  if (!item) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  // The goal and sharing decide whether the step-run feed items exist.
  await safeRefreshSteps(caller.userId, deps);
  return ok(stepSettingsOf(item));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
