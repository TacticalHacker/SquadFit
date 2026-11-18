import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getDeps, type Deps } from "../lib/deps";
import { toggleHighFive } from "../lib/high-five";

/** PUT /squad/feed/{id}/high-five : add the caller's high-five (idempotent). */
export const handle = (event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) => toggleHighFive(event, deps, true);

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
