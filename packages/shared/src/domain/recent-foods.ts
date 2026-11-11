import { normalizeFoodName } from "./foods";
import type { Macros } from "./nutrition";

export interface RecentFood {
  name: string;
  calories: number;
  macros: Macros | null;
}

/** One item per normalized name using the latest entry (by date, then entry id), most recent first (FR-022). */
export function recentFoods(
  entries: readonly { date: string; entryId: string; name: string; calories: number; macros: Macros | null }[],
  limit = 20,
): RecentFood[] {
  const sorted = [...entries].sort((a, b) => (a.date === b.date ? (a.entryId < b.entryId ? 1 : -1) : a.date < b.date ? 1 : -1));
  const seen = new Set<string>();
  const out: RecentFood[] = [];
  for (const e of sorted) {
    const key = normalizeFoodName(e.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: e.name.trim().replace(/\s+/g, " "), calories: e.calories, macros: e.macros });
    if (out.length === limit) break;
  }
  return out;
}
