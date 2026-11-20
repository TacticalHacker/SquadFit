import { GYM_EXERCISES, buildLibrary, type GymLibrary } from "@calci/shared";
import type { Deps } from "./deps";

/**
 * Feature 015 (research R4): built-ins + active catalog exercises, cached per Lambda container for 2 minutes so
 * members see admin changes within ~5 minutes at the cost of one small query. Keyed by the catalog repo instance,
 * so tests with fresh fakes never share a cache. On a read error: the stale value if any, else built-ins for 30 s.
 */
const TTL_MS = 2 * 60_000;
const FALLBACK_MS = 30_000;

const cache = new WeakMap<object, { library: GymLibrary; expires: number }>();

export async function getLibrary(deps: Pick<Deps, "catalog">): Promise<GymLibrary> {
  const now = Date.now();
  const hit = cache.get(deps.catalog);
  if (hit && hit.expires > now) return hit.library;
  try {
    const library = buildLibrary(await deps.catalog.list());
    cache.set(deps.catalog, { library, expires: now + TTL_MS });
    return library;
  } catch (err) {
    console.error("gym library read failed", (err as Error).name);
    const library = hit?.library ?? GYM_EXERCISES;
    cache.set(deps.catalog, { library, expires: now + FALLBACK_MS });
    return library;
  }
}

/** After an admin write, so this container's next read sees it at once. */
export function invalidateLibrary(deps: Pick<Deps, "catalog">): void {
  cache.delete(deps.catalog);
}
