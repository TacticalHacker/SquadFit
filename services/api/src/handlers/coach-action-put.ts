import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { CoachActionPutSchema, MAX_ACTIONS, validateNoteDate, type CoachActionsResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok, parseBody } from "../lib/http";

const CONFLICT = "This note was updated; refresh";

/**
 * PUT /coach-note/{date}/actions/{index} : tick or untick one action item of the caller's overall note.
 * Conditional on the note version the member saw, so a tick never lands on a newer note (research R6).
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;

  const date = event.pathParameters?.date ?? "";
  const problem = validateNoteDate(date, c.ctx.today);
  if (problem) return apiError(400, "VALIDATION_FAILED", "Invalid date", { date: problem });
  const rawIndex = event.pathParameters?.index ?? "";
  if (!/^\d$/.test(rawIndex) || Number(rawIndex) >= MAX_ACTIONS) {
    return apiError(400, "VALIDATION_FAILED", "Invalid action", { index: `Use 0 to ${MAX_ACTIONS - 1}` });
  }
  const index = Number(rawIndex);
  const body = parseBody(event.body, CoachActionPutSchema);
  if (!body.ok) return body.response;

  const result = await deps.coach.setActionDone(caller.userId, date, index, body.data.done, body.data.noteUpdatedAt);
  if (result === "missing") return apiError(404, "NOT_FOUND", "No coach note for this day");
  if (result === "conflict") return apiError(409, "VALIDATION_FAILED", CONFLICT, { _: CONFLICT });
  const note = await deps.coach.get(caller.userId, date);
  return ok({ actions: note?.actions ?? [] } satisfies CoachActionsResponse);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
