import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { ProfileInputSchema, type MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok, parseBody } from "../lib/http";
import { toOwnProfile } from "../lib/views";
import { safeRefreshProtein } from "../lib/protein-events";

/** Creates the profile on first call (joining the community), otherwise updates the editable fields. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const parsed = parseBody(event.body, ProfileInputSchema);
  if (!parsed.ok) return parsed.response;

  const item = await deps.profiles.upsert(caller.userId, caller.username, parsed.data, deps.now().toISOString());
  await safeRefreshProtein(caller.userId, deps);
  const body: MeResponse = { username: caller.username, isAdmin: caller.isAdmin, profile: await toOwnProfile(item, deps.avatars) };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
