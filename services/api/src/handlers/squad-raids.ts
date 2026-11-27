import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getDeps, type Deps } from "../lib/deps";
import { apiError } from "../lib/http";
import { handle as card } from "./squad-raid-get";
import { handle as history } from "./squad-raids-get";

/**
 * Feature 021: one function for the members' raid routes (the Api stack is near CloudFormation's 500-resource
 * limit). Each route's logic stays in its own handler file.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  switch (event.routeKey) {
    case "GET /squad/raid":
      return card(event, deps);
    case "GET /squad/raids":
      return history(event, deps);
    default:
      return apiError(404, "NOT_FOUND", "Not found");
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
