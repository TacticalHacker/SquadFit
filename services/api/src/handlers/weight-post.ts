import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { WeightLogInputSchema } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { ok, parseBody } from "../lib/http";
import { logWeight } from "../lib/weight-write";
import { parseWeightRange } from "../lib/weight-range";

/** POST /me/weight?range= : log a weigh-in (feature 014). Returns the fresh view for `range`. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const range = parseWeightRange(event);
  if (!range.ok) return range.response;
  const parsed = parseBody(event.body, WeightLogInputSchema);
  if (!parsed.ok) return parsed.response;
  const r = await logWeight(caller, parsed.data, range.range, deps);
  return r.ok ? ok(r.view) : r.response;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
