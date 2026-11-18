import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getDeps, type Deps } from "../lib/deps";
import { toggleHighFive } from "../lib/high-five";

/** DELETE /squad/feed/{id}/high-five : take the caller's high-five back (idempotent). */
export const handle = (event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) => toggleHighFive(event, deps, false);

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
