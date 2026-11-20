import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { CATALOG_LIMIT, GYM_EXERCISES, buildLibrary, suggestLibraryMatch, type AdminExercisesResponse, type CatalogGroup } from "@calci/shared";
import { getCaller, requireAdmin } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { memberExercises } from "../lib/gym-merge";
import { ok } from "../lib/http";

/** GET /admin/exercises: built-ins (read-only), every catalog row (uncached) and same-name own-exercise counts. */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const denied = requireAdmin(getCaller(event));
  if (denied) return denied;
  const catalog = await deps.catalog.list();
  const library = buildLibrary(catalog);
  const { matches, memberExercises: fromMembers } = await memberExercises(library, catalog.map((c) => c.name), deps);
  const body: AdminExercisesResponse = {
    builtIn: GYM_EXERCISES.map((e) => ({ exerciseId: e.id, name: e.name, group: e.group, kind: e.kind })),
    catalog: [...catalog].sort((a, b) => a.name.localeCompare(b.name, "en")),
    // Counts of members only, never who (FR-017).
    ownMatches: Object.fromEntries([...matches].map(([id, owners]) => [id, new Set(owners.map((o) => o.userId)).size])),
    // Story 6: own exercises not in the library yet, grouped by name; counts only (FR-024).
    memberExercises: fromMembers
      .filter((m) => m.group !== "cardio")
      .map((m) => {
        const hit = suggestLibraryMatch(m.name, library);
        return { ...m, group: m.group as CatalogGroup, suggestion: hit ? { exerciseId: hit.id, name: hit.name, group: hit.group } : null };
      }),
    limit: CATALOG_LIMIT,
  };
  return ok(body);
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
