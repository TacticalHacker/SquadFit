import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { JumpConfirmSchema, isGymId } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";
import { safeRefresh } from "../lib/squad-stats";

/**
 * PUT /workouts/gym/entries/{date}/{exerciseId}/confirm : "Looks right" on an unusual jump (feature 010, FR-016).
 * Allowed on any past day (it confirms, it does not edit the log), only for the caller's own entry.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveReadDate(event.pathParameters?.date ?? "", c.ctx.today);
  if (!d.ok) return d.response;
  const exerciseId = event.pathParameters?.exerciseId ?? "";
  if (!isGymId(exerciseId)) return apiError(404, "NOT_FOUND", "Exercise not found");
  const body = parseBody(event.body, JumpConfirmSchema);
  if (!body.ok) return body.response;

  const result = await deps.workouts.confirmJump(caller.userId, d.date, exerciseId, body.data.updatedAt, deps.now().toISOString());
  if (result === "missing") return apiError(404, "NOT_FOUND", "Entry not found");
  if (result === "conflict") return apiError(409, "VALIDATION_FAILED", "This entry changed; refresh", { _: "This entry changed; refresh" });
  await safeRefresh(caller.userId, deps);
  return ok({ ok: true });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
