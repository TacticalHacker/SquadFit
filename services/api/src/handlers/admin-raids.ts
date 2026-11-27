import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getDeps, type Deps } from "../lib/deps";
import { apiError } from "../lib/http";
import { handle as cancel } from "./admin-raid-cancel-post";
import { handle as remove } from "./admin-raid-delete";
import { handle as create } from "./admin-raid-post";
import { handle as edit } from "./admin-raid-put";
import { handle as suggest } from "./admin-raid-suggest-get";
import { handle as list } from "./admin-raids-get";

/**
 * Feature 021: one function for the admin raid routes (the Api stack is near CloudFormation's 500-resource limit).
 * Every route handler checks the admin group itself.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  switch (event.routeKey) {
    case "GET /admin/raids":
      return list(event, deps);
    case "GET /admin/raids/suggest":
      return suggest(event, deps);
    case "POST /admin/raids":
      return create(event, deps);
    case "PUT /admin/raids/{raidId}":
      return edit(event, deps);
    case "POST /admin/raids/{raidId}/cancel":
      return cancel(event, deps);
    case "DELETE /admin/raids/{raidId}":
      return remove(event, deps);
    default:
      return apiError(404, "NOT_FOUND", "Not found");
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
