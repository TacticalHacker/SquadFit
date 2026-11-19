import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getDeps, type Deps } from "../lib/deps";
import { toggleReaction } from "../lib/reaction";

/** PUT /squad/feed/{id}/reactions/{type} (feature 013). */
export const handle = (event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) => toggleReaction(event, deps, true);
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
