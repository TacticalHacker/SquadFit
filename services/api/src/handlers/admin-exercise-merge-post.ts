import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { findGymExercise, type AdminMergeResponse } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { invalidateLibrary, getLibrary } from "../lib/gym-library";
import { findOwnMatches, mergeInto } from "../lib/gym-merge";
import { apiError, ok } from "../lib/http";
import { safeRefresh } from "../lib/squad-stats";

/** POST /admin/exercises/{exerciseId}/merge: fold every member's same-name own exercise into it (feature 015, US4). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  invalidateLibrary(deps); // the admin may have just added the target in another container
  const library = await getLibrary(deps);
  const target = findGymExercise(event.pathParameters?.exerciseId ?? "", library);
  if (!target || target.kind !== "strength") return apiError(404, "NOT_FOUND", "Exercise not found");
  const sources = (await findOwnMatches(library, deps)).get(target.id) ?? [];
  const body: AdminMergeResponse = await mergeInto(target, sources, deps, { refresh: (userId) => safeRefresh(userId, deps) });
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
