import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { WeightRangeSchema, type WeightRange } from "@calci/shared";
import { apiError } from "./http";

/** `?range=W|M|6M|Y`, default M (feature 014). */
export function parseWeightRange(event: APIGatewayProxyEventV2WithJWTAuthorizer): { ok: true; range: WeightRange } | { ok: false; response: APIGatewayProxyResultV2 } {
  const r = WeightRangeSchema.safeParse(event.queryStringParameters?.range);
  return r.success ? { ok: true, range: r.data } : { ok: false, response: apiError(400, "VALIDATION_FAILED", "Unknown range", { range: "Use W, M, 6M or Y" }) };
}
