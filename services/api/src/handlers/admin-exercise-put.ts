import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AdminExercisePatchSchema, isLibraryNameTaken, type AdminExerciseResponse } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { invalidateLibrary } from "../lib/gym-library";
import { apiError, ok, parseBody } from "../lib/http";
import { DUPLICATE } from "./admin-exercise-post";

const STALE = "Someone else changed this exercise; reload";

/** PUT /admin/exercises/{exerciseId}: rename, regroup, retire or restore a catalog exercise (feature 015, US3). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const denied = requireAdmin(caller);
  if (denied) return denied;
  const id = event.pathParameters?.exerciseId ?? "";
  const parsed = parseBody(event.body, AdminExercisePatchSchema);
  if (!parsed.ok) return parsed.response;
  const { updatedAt, name, group, status } = parsed.data;
  const patch = { ...(name !== undefined ? { name } : {}), ...(group ? { group } : {}), ...(status ? { status } : {}) };

  // Built-ins are not in the catalog, so they 404 here (not editable).
  const catalog = await deps.catalog.list();
  if (!catalog.some((c) => c.exerciseId === id)) return apiError(404, "NOT_FOUND", "Exercise not found");
  if (name !== undefined && isLibraryNameTaken(name, catalog.filter((c) => c.exerciseId !== id))) {
    return apiError(409, "DUPLICATE_NAME", DUPLICATE, { name: DUPLICATE });
  }

  const result = await deps.catalog.update(id, updatedAt, patch, caller.username, deps.now().toISOString());
  if (!result.ok) {
    if (result.reason === "not_found") return apiError(404, "NOT_FOUND", "Exercise not found");
    if (result.reason === "duplicate") return apiError(409, "DUPLICATE_NAME", DUPLICATE, { name: DUPLICATE });
    return apiError(409, "STALE", STALE);
  }
  invalidateLibrary(deps);
  const body: AdminExerciseResponse = { exercise: result.item };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
