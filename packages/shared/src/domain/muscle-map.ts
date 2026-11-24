import type { GymEntryView, GymSet, MuscleGroup } from "./gym";

/** Muscle heatmap (feature 018). See specs/018-muscle-heatmap/data-model.md. Derived on render; nothing is stored. */

export const MUSCLE_REGIONS = [
  "chest",
  "front-delts",
  "biceps",
  "forearms",
  "abs",
  "quads",
  "traps",
  "upper-back",
  "lats",
  "rear-delts",
  "triceps",
  "lower-back",
  "glutes",
  "hamstrings",
  "calves",
] as const;
export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_REGION_LABELS: Record<MuscleRegion, string> = {
  chest: "Chest",
  "front-delts": "Front delts",
  biceps: "Biceps",
  forearms: "Forearms",
  abs: "Abs",
  quads: "Quads",
  traps: "Traps",
  "upper-back": "Upper back",
  lats: "Lats",
  "rear-delts": "Rear delts",
  triceps: "Triceps",
  "lower-back": "Lower back",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

export const MUSCLE_REGION_SIDE: Record<MuscleRegion, "front" | "back"> = {
  chest: "front",
  "front-delts": "front",
  biceps: "front",
  forearms: "front",
  abs: "front",
  quads: "front",
  traps: "back",
  "upper-back": "back",
  lats: "back",
  "rear-delts": "back",
  triceps: "back",
  "lower-back": "back",
  glutes: "back",
  hamstrings: "back",
  calves: "back",
};

export interface ExerciseMuscles {
  primary: MuscleRegion[];
  secondary: MuscleRegion[];
}

const m = (primary: MuscleRegion[], secondary: MuscleRegion[] = []): ExerciseMuscles => ({ primary, secondary });

/** Built-in strength exercises (research R6). Side delts count as front delts. Catalog and own exercises use GROUP_FALLBACK. */
export const MUSCLE_MAP: Readonly<Record<string, ExerciseMuscles>> = {
  "gx-bench-press": m(["chest"], ["front-delts", "triceps"]),
  "gx-incline-dumbbell-press": m(["chest", "front-delts"], ["triceps"]),
  "gx-cable-flyes": m(["chest"], ["front-delts"]),
  "gx-chest-dips": m(["chest", "triceps"], ["front-delts"]),
  "gx-machine-chest-press": m(["chest"], ["front-delts", "triceps"]),
  "gx-machine-pec-fly": m(["chest"], ["front-delts"]),
  "gx-flat-dumbbell-press": m(["chest"], ["front-delts", "triceps"]),
  "gx-dumbbell-fly": m(["chest"], ["front-delts"]),
  "gx-dumbbell-pullover": m(["chest", "lats"], ["triceps"]),
  "gx-deadlift": m(["hamstrings", "glutes", "lower-back"], ["quads", "traps", "upper-back", "forearms"]),
  "gx-lat-pulldown": m(["lats"], ["biceps", "upper-back", "rear-delts"]),
  "gx-barbell-row": m(["upper-back", "lats"], ["rear-delts", "biceps", "lower-back"]),
  "gx-seated-cable-row": m(["upper-back", "lats"], ["rear-delts", "biceps"]),
  "gx-pull-ups": m(["lats"], ["biceps", "upper-back", "forearms"]),
  "gx-t-bar-row": m(["upper-back", "lats"], ["rear-delts", "biceps", "lower-back"]),
  "gx-straight-arm-pulldown": m(["lats"], ["triceps"]),
  "gx-single-arm-dumbbell-row": m(["lats", "upper-back"], ["rear-delts", "biceps"]),
  "gx-dumbbell-bent-over-row": m(["upper-back", "lats"], ["rear-delts", "biceps", "lower-back"]),
  "gx-back-extension": m(["lower-back"], ["glutes", "hamstrings"]),
  "gx-barbell-squat": m(["quads", "glutes"], ["hamstrings", "lower-back"]),
  "gx-leg-press": m(["quads", "glutes"], ["hamstrings"]),
  "gx-romanian-deadlift": m(["hamstrings", "glutes"], ["lower-back", "forearms"]),
  "gx-leg-extension": m(["quads"]),
  "gx-hamstring-curl": m(["hamstrings"], ["calves"]),
  "gx-calf-raises": m(["calves"]),
  "gx-overhead-press": m(["front-delts"], ["triceps", "traps"]),
  "gx-lateral-raises": m(["front-delts"], ["traps"]),
  "gx-face-pulls": m(["rear-delts"], ["upper-back", "traps"]),
  "gx-rear-delt-flyes": m(["rear-delts"], ["upper-back"]),
  "gx-front-raises": m(["front-delts"]),
  "gx-seated-dumbbell-shoulder-press": m(["front-delts"], ["triceps"]),
  "gx-arnold-press": m(["front-delts"], ["triceps"]),
  "gx-upright-rows": m(["front-delts", "traps"], ["biceps"]),
  "gx-barbell-curl": m(["biceps"], ["forearms"]),
  "gx-hammer-curl": m(["biceps", "forearms"]),
  "gx-tricep-pushdown": m(["triceps"]),
  "gx-skullcrushers": m(["triceps"]),
  "gx-ez-bar-curl": m(["biceps"], ["forearms"]),
  "gx-wrist-curl": m(["forearms"]),
  "gx-reverse-wrist-curl": m(["forearms"]),
  "gx-incline-dumbbell-curl": m(["biceps"]),
  "gx-overhead-cable-extension": m(["triceps"]),
  "gx-single-arm-cable-pushdown": m(["triceps"]),
  "gx-hanging-leg-raises": m(["abs"], ["forearms"]),
  "gx-cable-crunch": m(["abs"]),
  "gx-sit-ups": m(["abs"]),
  "gx-russian-twists": m(["abs"]),
  "gx-bicycle-crunches": m(["abs"]),
  "gx-palloff-press": m(["abs"]),
  "gx-bird-dog": m(["lower-back", "abs"], ["glutes"]),
  "gx-dead-bug": m(["abs"]),
  "gx-v-up": m(["abs"]),
};

/** Spec FR-004: exercises without a table row light their muscle group's regions, all primary. */
export const GROUP_FALLBACK: Readonly<Record<MuscleGroup, readonly MuscleRegion[]>> = {
  chest: ["chest"],
  back: ["lats", "upper-back"],
  legs: ["quads", "hamstrings", "glutes"],
  shoulders: ["front-delts"],
  arms: ["biceps", "triceps"],
  core: ["abs"],
  cardio: [],
};

export function musclesFor(exerciseId: string, group: MuscleGroup): ExerciseMuscles {
  return MUSCLE_MAP[exerciseId] ?? { primary: [...GROUP_FALLBACK[group]], secondary: [] };
}

export type HeatStep = 0 | 1 | 2 | 3;

export interface RegionLoad {
  /** Completed sets of exercises where the region is primary. */
  direct: number;
  /** Completed sets of exercises where the region is secondary. */
  indirect: number;
  /** direct + 0.5 × indirect */
  score: number;
  step: HeatStep;
}
export type DayMuscleLoad = Record<MuscleRegion, RegionLoad>;

export function heatStep(score: number): HeatStep {
  if (score <= 0) return 0;
  if (score < 3) return 1;
  if (score < 6) return 2;
  return 3;
}

/**
 * Every saved set with at least one rep counts, ticked or not, like the gym calorie math (feature 006: every set
 * counts). Sets are saved unticked by default, so requiring the tick hid real workouts. Weight does not matter.
 */
const loggedSets = (sets: readonly GymSet[] | null | undefined) => (sets ?? []).filter((s) => s.reps >= 1).length;

export function dayMuscleLoad(entries: readonly Pick<GymEntryView, "exerciseId" | "muscleGroup" | "exerciseKind" | "sets">[]): DayMuscleLoad {
  const direct = new Map<MuscleRegion, number>();
  const indirect = new Map<MuscleRegion, number>();
  for (const e of entries) {
    if (e.exerciseKind !== "strength") continue;
    const n = loggedSets(e.sets);
    if (n === 0) continue;
    const { primary, secondary } = musclesFor(e.exerciseId, e.muscleGroup);
    for (const r of primary) direct.set(r, (direct.get(r) ?? 0) + n);
    for (const r of secondary) indirect.set(r, (indirect.get(r) ?? 0) + n);
  }
  const out = {} as DayMuscleLoad;
  for (const r of MUSCLE_REGIONS) {
    const d = direct.get(r) ?? 0;
    const i = indirect.get(r) ?? 0;
    const score = d + i * 0.5;
    out[r] = { direct: d, indirect: i, score, step: heatStep(score) };
  }
  return out;
}

export const hasMuscleLoad = (load: DayMuscleLoad) => MUSCLE_REGIONS.some((r) => load[r].score > 0);

/** Worked regions, highest score first (accessible summary). */
export const workedRegions = (load: DayMuscleLoad): MuscleRegion[] =>
  MUSCLE_REGIONS.filter((r) => load[r].score > 0).sort((a, b) => load[b].score - load[a].score);

/** Strength exercises that work `region` (primary or secondary); ones logged that day first, else input order. */
export function exercisesForRegion<
  T extends { exerciseId: string; group: MuscleGroup; kind: "strength" | "cardio"; entry: { sets: readonly GymSet[] | null } | null },
>(exercises: readonly T[], region: MuscleRegion): T[] {
  const hits = exercises.filter((e) => {
    if (e.kind !== "strength") return false;
    const { primary, secondary } = musclesFor(e.exerciseId, e.group);
    return primary.includes(region) || secondary.includes(region);
  });
  const done = (e: T) => loggedSets(e.entry?.sets) > 0;
  return [...hits.filter(done), ...hits.filter((e) => !done(e))];
}
