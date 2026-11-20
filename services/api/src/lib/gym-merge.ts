import { exerciseNameKey, type GymExerciseDef, type GymLibrary } from "@calci/shared";
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

/** Library strength exercise id → members' active own exercises with the same name (case and spacing ignored). */
export async function findOwnMatches(library: GymLibrary, deps: Pick<Deps, "profiles" | "gym">): Promise<Map<string, OwnSource[]>> {
  const byName = new Map(library.filter((e) => e.kind === "strength").map((e) => [exerciseNameKey(e.name), e.id]));
  const matches = new Map<string, OwnSource[]>();
  for (const m of await deps.profiles.listCommunity()) {
    for (const own of await deps.gym.listOwnExercises(m.userId)) {
      const id = byName.get(exerciseNameKey(own.name));
      if (!id) continue;
      matches.set(id, [...(matches.get(id) ?? []), { userId: m.userId, exerciseId: own.exerciseId }]);
    }
  }
  return matches;
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
