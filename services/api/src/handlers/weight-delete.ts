import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";
import { deleteWeight } from "../lib/weight-write";
import { parseWeightRange } from "../lib/weight-range";

/** DELETE /me/weight/{date}/{entryId}?range= : idempotent, own entries only (feature 014). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const range = parseWeightRange(event);
  if (!range.ok) return range.response;
  const r = await deleteWeight(caller, event.pathParameters?.date, event.pathParameters?.entryId ?? "", range.range, deps);
  return r.ok ? ok(r.view) : r.response;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
