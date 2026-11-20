import { exerciseNameKey, type GymExerciseDef, type GymLibrary, type MuscleGroup } from "@calci/shared";
import type { Deps } from "./deps";

/**
 * Feature 015 (research R7): fold members' own exercises into a library exercise. Shared by
 * `POST /admin/exercises/{id}/merge` and `pnpm admin gym merge`. Each logged day moves with sets, dates,
 * `updatedAt`, `aiNote` and `jumpConfirmedAt` unchanged; a day where the member already logged the target is left
 * alone (and the own exercise is then kept so nothing is stranded). Safe to repeat. Counts only, never logged data.
 */
export interface OwnSource {
  userId: string;
  exerciseId: string;
}

export interface MergeCounts {
  members: number;
  moved: number;
  skipped: number;
  removed: number;
}

interface OwnRow extends OwnSource {
  name: string;
  group: MuscleGroup;
}

/** Every member's active own exercises (tens of members, ≤ 50 each). */
async function listCommunityOwn(deps: Pick<Deps, "profiles" | "gym">): Promise<OwnRow[]> {
  const rows: OwnRow[] = [];
  for (const m of await deps.profiles.listCommunity()) {
    for (const own of await deps.gym.listOwnExercises(m.userId)) rows.push({ userId: m.userId, exerciseId: own.exerciseId, name: own.name, group: own.group });
  }
  return rows;
}

/** Library strength exercise id → members' active own exercises with the same name (case, spacing, punctuation ignored). */
export async function findOwnMatches(library: GymLibrary, deps: Pick<Deps, "profiles" | "gym">, own?: OwnRow[]): Promise<Map<string, OwnSource[]>> {
  const byName = new Map(library.filter((e) => e.kind === "strength").map((e) => [exerciseNameKey(e.name), e.id]));
  const matches = new Map<string, OwnSource[]>();
  for (const o of own ?? (await listCommunityOwn(deps))) {
    const id = byName.get(exerciseNameKey(o.name));
    if (id) matches.set(id, [...(matches.get(id) ?? []), { userId: o.userId, exerciseId: o.exerciseId }]);
  }
  return matches;
}

/** Story 6: every member's active own exercise with this name (case, spacing, punctuation ignored). */
export async function ownByName(name: string, deps: Pick<Deps, "profiles" | "gym">): Promise<OwnSource[]> {
  const key = exerciseNameKey(name);
  return (await listCommunityOwn(deps)).filter((o) => exerciseNameKey(o.name) === key).map(({ userId, exerciseId }) => ({ userId, exerciseId }));
}

export interface MemberExercise {
  name: string;
  group: MuscleGroup;
  members: number;
  days: number;
}

/** Most common value; ties go to the alphabetically first, so the result is stable. */
function mostCommon<T extends string>(values: readonly T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))[0]![0];
}

/**
 * Story 6: own exercises whose name is not taken by the library or any catalog row (retired ones are restored, not
 * re-added), grouped by name key across members. Counts only, never who (FR-024).
 */
export async function memberExercises(
  library: GymLibrary,
  reservedNames: readonly string[],
  deps: Pick<Deps, "profiles" | "gym">,
): Promise<{ matches: Map<string, OwnSource[]>; memberExercises: MemberExercise[] }> {
  const own = await listCommunityOwn(deps);
  const taken = new Set([...library.map((e) => exerciseNameKey(e.name)), ...reservedNames.map(exerciseNameKey)]);
  const byKey = new Map<string, OwnRow[]>();
  for (const o of own) {
    const k = exerciseNameKey(o.name);
    if (!k || taken.has(k)) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), o]);
  }
  const list = await Promise.all(
    [...byKey.values()].map(async (rows) => {
      const days = (await Promise.all(rows.map((r) => deps.gym.listEntriesByExercise(r.userId, r.exerciseId)))).reduce((n, e) => n + e.length, 0);
      return { name: mostCommon(rows.map((r) => r.name)), group: mostCommon(rows.map((r) => r.group)), members: new Set(rows.map((r) => r.userId)).size, days };
    }),
  );
  list.sort((a, b) => b.members - a.members || b.days - a.days || a.name.localeCompare(b.name, "en"));
  return { matches: await findOwnMatches(library, deps, own), memberExercises: list };
}

export async function mergeInto(
  target: GymExerciseDef,
  sources: readonly OwnSource[],
  deps: Pick<Deps, "gym" | "now">,
  opts: { refresh: (userId: string) => Promise<void>; dryRun?: boolean },
): Promise<MergeCounts> {
  const counts: MergeCounts = { members: 0, moved: 0, skipped: 0, removed: 0 };
  const members = new Set<string>();
  const dest = { id: target.id, name: target.name, group: target.group };
  for (const s of sources) {
    members.add(s.userId);
    const entries = await deps.gym.listEntriesByExercise(s.userId, s.exerciseId);
    let skipped = 0;
    for (const e of entries) {
      if (opts.dryRun) {
        counts.moved++;
        continue;
      }
      if ((await deps.gym.moveEntry(s.userId, e.date, s.exerciseId, dest)) === "moved") counts.moved++;
      else skipped++;
    }
    counts.skipped += skipped;
    if (skipped === 0) {
      if (!opts.dryRun) await deps.gym.markOwnExerciseMerged(s.userId, s.exerciseId, target.id, deps.now().toISOString());
      counts.removed++;
    }
  }
  if (!opts.dryRun) for (const userId of members) await opts.refresh(userId);
  counts.members = members.size;
  return counts;
}
