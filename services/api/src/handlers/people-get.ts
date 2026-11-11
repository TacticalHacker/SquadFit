import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { PeopleResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { toPublicMember } from "../lib/views";

export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  // FR-011: the community is only visible to users who finished their own profile.
  if (!(await deps.profiles.get(caller.userId))) {
    return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  }
  const items = await deps.profiles.listCommunity();
  const body: PeopleResponse = {
    members: await Promise.all(items.map((i) => toPublicMember(i, caller.userId, deps.avatars))),
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
