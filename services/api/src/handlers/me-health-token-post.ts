import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { HealthTokenIssuedSchema } from "@calci/shared";
import { generateHealthToken, hashToken } from "@calci/shared/ai-credential";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, json } from "../lib/http";

/**
 * POST /me/health-token (feature 012): issue or regenerate the caller's Health sync token. This response is the only
 * time the token exists outside the member's device; only its hash is stored. Never log it.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const token = generateHealthToken();
  const createdAt = deps.now().toISOString();
  await deps.healthTokens.issue(caller.userId, hashToken(token), createdAt);
  return json(201, HealthTokenIssuedSchema.parse({ token, createdAt }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
