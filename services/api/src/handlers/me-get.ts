import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { toOwnProfile } from "../lib/views";

export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const item = await deps.profiles.get(caller.userId);
  const body: MeResponse = {
    username: caller.username,
    isAdmin: caller.isAdmin,
    profile: item ? await toOwnProfile(item, deps.avatars) : null,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
