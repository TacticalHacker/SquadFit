import { exerciseNameKey, type GymExerciseDef, type GymLibrary } from "./gym";

/**
 * Feature 015, Story 6: suggest the library exercise a member-made one probably duplicates ("DB Bench" → Flat
 * Dumbbell Press). Deliberately cautious: a wrong merge mixes lift histories, so equipment or angle clashes, weak
 * overlap of the movement words, and ties all give no suggestion. The admin always confirms.
 */

const SYNONYMS: Record<string, string[]> = {
  db: ["dumbbell"],
  dumbell: ["dumbbell"],
  bb: ["barbell"],
  kb: ["kettlebell"],
  ohp: ["overhead", "press"],
  rdl: ["romanian", "deadlift"],
  bench: ["bench", "press"],
  tri: ["tricep"],
  bi: ["bicep"],
};
const EQUIPMENT = new Set(["dumbbell", "barbell", "cable", "machine", "smith", "ez", "kettlebell", "t"]);
const ANGLE = new Set(["incline", "decline"]);
const MODIFIERS = new Set([...EQUIPMENT, ...ANGLE, "flat", "seated", "standing", "single", "arm", "one", "bar"]);

function stem(word: string): string {
  if (/(ches|shes|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokens(name: string): Set<string> {
  const out = new Set<string>();
  for (const raw of exerciseNameKey(name).split(" ")) {
    if (!raw) continue;
    for (const t of SYNONYMS[raw] ?? [stem(raw)]) out.add(t);
  }
  return out;
}

const only = (s: Set<string>, keep: Set<string>) => new Set([...s].filter((t) => keep.has(t)));
const without = (s: Set<string>, drop: Set<string>) => new Set([...s].filter((t) => !drop.has(t)));
const shared = (a: Set<string>, b: Set<string>) => [...a].filter((t) => b.has(t)).length;
const jaccard = (a: Set<string>, b: Set<string>) => {
  const n = shared(a, b);
  return n / (a.size + b.size - n || 1);
};

export function suggestLibraryMatch(name: string, library: GymLibrary): GymExerciseDef | null {
  const s = tokens(name);
  const sEquip = only(s, EQUIPMENT);
  const sAngle = only(s, ANGLE);
  const sCore = without(s, MODIFIERS);
  if (sCore.size === 0) return null;

  let best: { def: GymExerciseDef; score: number } | null = null;
  let tie = false;
  for (const def of library) {
    if (def.kind !== "strength") continue;
    const c = tokens(def.name);
    const cEquip = only(c, EQUIPMENT);
    if (sEquip.size && cEquip.size && shared(sEquip, cEquip) === 0) continue; // dumbbell vs cable…
    const cAngle = only(c, ANGLE);
    if (sAngle.size !== cAngle.size || shared(sAngle, cAngle) !== sAngle.size) continue; // incline vs flat
    const cCore = without(c, MODIFIERS);
    if (shared(sCore, cCore) === 0 || jaccard(sCore, cCore) < 0.5) continue; // the movement itself must match
    // "Bicep Curl" names no equipment: don't guess barbell vs dumbbell unless the movement words match exactly.
    if (sEquip.size === 0 && cEquip.size > 0 && jaccard(sCore, cCore) < 1) continue;
    const score = jaccard(s, c) + (shared(sEquip, cEquip) > 0 ? 0.25 : 0);
    if (!best || score > best.score + 1e-9) {
      best = { def, score };
      tie = false;
    } else if (Math.abs(score - best.score) <= 1e-9) tie = true;
  }
  return best && !tie ? best.def : null;
}
