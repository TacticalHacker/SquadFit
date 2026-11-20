import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AdminUserInputSchema, type AdminUserCreated } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, json, parseBody } from "../lib/http";
import { generateTempPassword } from "../lib/temp-password";

/**
 * POST /admin/users: an admin creates a member account (feature 015, Story 5; the admin tool of 001 FR-004).
 * The temporary password is in this response only: never stored or logged (FR-022).
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  const parsed = parseBody(event.body, AdminUserInputSchema);
  if (!parsed.ok) return parsed.response;
  const { username } = parsed.data;
  const temporaryPassword = generateTempPassword();
  if ((await deps.users.create(username, temporaryPassword)) === "taken") {
    return apiError(409, "USERNAME_TAKEN", "Username is taken", { username: "Username is taken" });
  }
  const body: AdminUserCreated = { username, temporaryPassword };
  return json(201, body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
