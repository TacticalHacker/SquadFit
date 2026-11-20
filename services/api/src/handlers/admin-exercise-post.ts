import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AdminExerciseInputSchema, CATALOG_LIMIT, catalogId, isLibraryNameTaken, type AdminExerciseResponse, type CatalogExercise } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { invalidateLibrary } from "../lib/gym-library";
import { apiError, json, parseBody } from "../lib/http";

export const DUPLICATE = "An exercise with this name already exists";

/** POST /admin/exercises: add a strength exercise to everyone's library (feature 015, FR-001–FR-004). */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  const denied = requireAdmin(caller);
  if (denied) return denied;
  const parsed = parseBody(event.body, AdminExerciseInputSchema);
  if (!parsed.ok) return parsed.response;
  const { name, group } = parsed.data;

  const catalog = await deps.catalog.list();
  if (catalog.length >= CATALOG_LIMIT) return apiError(409, "CATALOG_FULL", `The library is full (${CATALOG_LIMIT} exercises)`);
  if (isLibraryNameTaken(name, catalog)) return apiError(409, "DUPLICATE_NAME", DUPLICATE, { name: DUPLICATE });

  const nowIso = deps.now().toISOString();
  const taken = catalog.map((c) => c.exerciseId);
  // A concurrent add may take the id first: retry with the next suffix (research R3).
  for (let attempt = 0; attempt < 5; attempt++) {
    const exercise: CatalogExercise = {
      exerciseId: catalogId(name, taken),
      name,
      group,
      kind: "strength",
      status: "active",
      createdAt: nowIso,
      createdBy: caller.username,
      updatedAt: nowIso,
      updatedBy: caller.username,
    };
    const result = await deps.catalog.create(exercise);
    if (result === "duplicate") return apiError(409, "DUPLICATE_NAME", DUPLICATE, { name: DUPLICATE });
    if (result === "ok") {
      invalidateLibrary(deps);
      const body: AdminExerciseResponse = { exercise };
      return json(201, body);
    }
    taken.push(exercise.exerciseId);
  }
  throw new Error("Could not allocate a catalog id");
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
