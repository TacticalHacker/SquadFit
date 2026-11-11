import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import type { CoachNoteResponse } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { loadDayContext, resolveReadDate } from "../lib/day-context";
import { getDeps, type Deps } from "../lib/deps";
import { ok } from "../lib/http";

/** GET /coach-note?date= : the caller's own AI coach note for the day, or null. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c.response;
  const d = resolveReadDate(event.queryStringParameters?.date, c.ctx.today);
  if (!d.ok) return d.response;
  const item = await deps.coach.get(caller.userId, d.date);
  const body: CoachNoteResponse = {
    note: item
      ? {
          date: item.date,
          summaryMarkdown: item.summaryMarkdown,
          recommendations: item.recommendations,
          generatedBy: "AI",
          updatedAt: item.updatedAt,
        }
      : null,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
