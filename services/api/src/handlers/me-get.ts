import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { MeResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { unreadFor } from "../lib/notifications";
import { toOwnProfile } from "../lib/views";
import { handle as notifications } from "./me-notifications-get";
import { handle as seen } from "./me-notifications-seen-put";

export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  // Feature 022: the unread count rides on GET /me (one query, in parallel with the profile read).
  const [item, unread] = await Promise.all([deps.profiles.get(caller.userId), unreadFor(caller.userId, deps)]);
  const body: MeResponse = {
    username: caller.username,
    userId: caller.userId,
    isAdmin: caller.isAdmin,
    profile: item ? await toOwnProfile(item, deps.avatars) : null,
    unreadNotifications: item ? unread : 0,
  };
  return ok(body);
}

/**
 * Feature 022: this function also serves the notification routes (the Api stack is near CloudFormation's
 * 500-resource limit); each route's logic stays in its own handler file.
 */
export function route(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  switch (event.routeKey) {
    case "GET /me/notifications":
      return notifications(event, deps);
    case "PUT /me/notifications/seen":
      return seen(event, deps);
    case "GET /me":
      return handle(event, deps);
    default:
      return Promise.resolve(apiError(404, "NOT_FOUND", "Not found"));
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => route(event, getDeps());
