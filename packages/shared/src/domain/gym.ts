import { z } from "zod";
import { caloriesFor, summarize, type Summary } from "./calories";
import { isEditableDay } from "./day";
import type { StoredEntry } from "./day-view";
import { normalizeWorkoutName } from "./workouts";

/** Gym logger (feature 006). See specs/006-gym-set-logger/data-model.md. */

export const MUSCLE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core", "cardio"] as const;
export const MuscleGroupSchema = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  cardio: "Cardio",
};

export type ExerciseKind = "strength" | "cardio";

export interface GymExerciseDef {
  id: string;
  name: string;
  group: MuscleGroup;
  kind: ExerciseKind;
  /** Cardio only: calories per this many minutes (research R4). */
  rateMinutes?: number;
  rateCalories?: number;
  /** Feature 015: added by an admin at runtime (not in code). */
  source?: "catalog";
}

export const GYM_MAX_SETS = 20;
export const GYM_MAX_OWN = 50;
export const GYM_MAX_WEIGHT = 500;
export const GYM_MAX_REPS = 100;
export const GYM_WEIGHT_STEP = 2.5;
export const GYM_DEFAULT_SETS = 3;
export const GYM_DEFAULT_REPS = 10;
export const GYM_DEFAULT_CARDIO_MINUTES = 20;
export const GYM_CARDIO_STEP = 5;
/** 2.5 minutes per set at 6 kcal per minute (FR-013). */
export const MINUTES_PER_SET = 2.5;
export const KCAL_PER_SET = 15;
/** Rate snapshot stored on strength entries so they keep the 002 entry shape (6 kcal/min). Never used for gym math. */
export const STRENGTH_RATE = { rateMinutes: 5, rateCalories: 30 } as const;

const strength = (slug: string, name: string, group: MuscleGroup): GymExerciseDef => ({ id: `gx-${slug}`, name, group, kind: "strength" });

/** Built-in library (FR-001). Ids are never reused or renamed once shipped. */
export const GYM_EXERCISES: readonly GymExerciseDef[] = [
  strength("bench-press", "Bench Press", "chest"),
  strength("incline-dumbbell-press", "Incline Dumbbell Press", "chest"),
  strength("cable-flyes", "Cable Flyes", "chest"),
  strength("chest-dips", "Chest Dips", "chest"),
  strength("machine-chest-press", "Machine Chest Press", "chest"),
  strength("machine-pec-fly", "Machine Pec Fly", "chest"),
  strength("flat-dumbbell-press", "Flat Dumbbell Press", "chest"),
  strength("dumbbell-fly", "Dumbbell Fly", "chest"),
  strength("dumbbell-pullover", "Dumbbell Pullover", "chest"),
  strength("deadlift", "Deadlift", "back"),
  strength("lat-pulldown", "Lat Pulldown", "back"),
  strength("barbell-row", "Barbell Row", "back"),
  strength("seated-cable-row", "Seated Cable Row", "back"),
  strength("pull-ups", "Pull-Ups", "back"),
  strength("t-bar-row", "T-Bar Row", "back"),
  strength("straight-arm-pulldown", "Straight Arm Pulldown", "back"),
  strength("single-arm-dumbbell-row", "Single Arm Dumbbell Row", "back"),
  strength("dumbbell-bent-over-row", "Dumbbell Bent-Over Row", "back"),
  strength("back-extension", "Back Extension", "back"),
  strength("barbell-squat", "Barbell Squat", "legs"),
  strength("leg-press", "Leg Press", "legs"),
  strength("romanian-deadlift", "Romanian Deadlift", "legs"),
  strength("leg-extension", "Leg Extension", "legs"),
  strength("hamstring-curl", "Hamstring Curl", "legs"),
  strength("calf-raises", "Calf Raises", "legs"),
  strength("overhead-press", "Overhead Press", "shoulders"),
  strength("lateral-raises", "Lateral Raises", "shoulders"),
  strength("face-pulls", "Face Pulls", "shoulders"),
  strength("rear-delt-flyes", "Rear Delt Flyes", "shoulders"),
  strength("front-raises", "Front Raises", "shoulders"),
  strength("seated-dumbbell-shoulder-press", "Seated Dumbbell Shoulder Press", "shoulders"),
  strength("arnold-press", "Arnold Press", "shoulders"),
  strength("upright-rows", "Upright Rows", "shoulders"),
  strength("barbell-curl", "Barbell Curl", "arms"),
  strength("hammer-curl", "Hammer Curl", "arms"),
  strength("tricep-pushdown", "Tricep Pushdown", "arms"),
  strength("skullcrushers", "Skullcrushers", "arms"),
  strength("ez-bar-curl", "EZ-Bar Curl", "arms"),
  strength("wrist-curl", "Wrist Curl", "arms"),
  strength("reverse-wrist-curl", "Reverse Wrist Curl", "arms"),
  strength("incline-dumbbell-curl", "Incline Dumbbell Curl", "arms"),
  strength("overhead-cable-extension", "Overhead Cable Extension", "arms"),
  strength("single-arm-cable-pushdown", "Single-Arm Cable Pushdown", "arms"),
  strength("hanging-leg-raises", "Hanging Leg Raises", "core"),
  strength("cable-crunch", "Cable Crunch", "core"),
  strength("sit-ups", "Sit-Ups", "core"),
  strength("russian-twists", "Russian Twists", "core"),
  strength("bicycle-crunches", "Bicycle Crunches", "core"),
  strength("palloff-press", "Palloff Press", "core"),
  strength("bird-dog", "Bird Dog", "core"),
  strength("dead-bug", "Dead Bug", "core"),
  strength("v-up", "V-Up", "core"),
  { id: "gx-incline-treadmill-walk", name: "Incline Treadmill Walk", group: "cardio", kind: "cardio", rateMinutes: 20, rateCalories: 140 },
  { id: "gx-stairmaster", name: "Stairmaster", group: "cardio", kind: "cardio", rateMinutes: 20, rateCalories: 180 },
];

/** Built-ins plus active admin-added exercises (feature 015). Always pass it explicitly; only boards use built-ins alone. */
export type GymLibrary = readonly GymExerciseDef[];

export const findGymExercise = (id: string, library: GymLibrary) => library.find((e) => e.id === id);

/** Gym exercise ids never collide with workout ids (`std-`, `c-`), research R2. */
export const isGymId = (id: string) => id.startsWith("gx-") || id.startsWith("gc-");

// ---------------------------------------------------------------- totals

export interface GymSet {
  setNumber: number;
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface GymTotals {
  volumeKg: number;
  minutes: number;
  calories: number;
}

/** FR-013. Counts every set, completed or not (clarification 1). Volume is summed in tenths of a kg to avoid float drift. */
export function gymTotals(sets: readonly { reps: number; weightKg: number }[]): GymTotals {
  let tenths = 0;
  for (const s of sets) tenths += s.reps * Math.round(s.weightKg * 10);
  return {
    volumeKg: tenths / 10,
    minutes: Math.round(sets.length * MINUTES_PER_SET),
    calories: sets.length * KCAL_PER_SET,
  };
}

/** FR-016: cardio follows feature 002's rate rule. */
export function cardioTotals(rateMinutes: number, rateCalories: number, minutes: number) {
  return { minutes, calories: caloriesFor(rateMinutes, rateCalories, minutes) };
}

/** Heaviest set; ties → more reps → lower set number (research R6). */
export function topSet<T extends { setNumber: number; weightKg: number; reps: number }>(
  sets: readonly T[],
): { weightKg: number; reps: number; setNumber: number } | null {
  let best: T | null = null;
  for (const s of sets) {
    if (
      !best ||
      s.weightKg > best.weightKg ||
      (s.weightKg === best.weightKg && s.reps > best.reps) ||
      (s.weightKg === best.weightKg && s.reps === best.reps && s.setNumber < best.setNumber)
    ) {
      best = s;
    }
  }
  return best ? { weightKg: best.weightKg, reps: best.reps, setNumber: best.setNumber } : null;
}

export const formatWeight = (kg: number) => (kg === 0 ? "BW" : `${kg}`);

export function formatLast(top: { weightKg: number; reps: number }): string {
  return `Last: ${top.weightKg === 0 ? "BW" : `${top.weightKg}kg`} × ${top.reps}`;
}

// ---------------------------------------------------------------- typed input

export type ParseResult = { ok: true; value: number } | { ok: false; message: string };

const NUMBER_RE = /^\d*(?:\.\d+)?$/;

function toNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s || !NUMBER_RE.test(s) || s === ".") return null;
  return Number(s);
}

export const WEIGHT_MESSAGE = "Weight must be 0–500 kg in 0.5 kg steps";
export const REPS_MESSAGE = "Reps must be a whole number from 1 to 100";
export const GYM_MINUTES_MESSAGE = "Minutes must be a whole number from 1 to 600";

export function parseWeight(raw: string): ParseResult {
  const n = toNumber(raw);
  if (n === null || n > GYM_MAX_WEIGHT || !Number.isInteger(n * 2)) return { ok: false, message: WEIGHT_MESSAGE };
  return { ok: true, value: n };
}

const wholeIn = (min: number, max: number, message: string) => (raw: string): ParseResult => {
  const n = toNumber(raw);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return { ok: false, message };
  return { ok: true, value: n };
};

export const parseReps = wholeIn(1, GYM_MAX_REPS, REPS_MESSAGE);
export const parseMinutes = wholeIn(1, 600, GYM_MINUTES_MESSAGE);

// ---------------------------------------------------------------- own exercises

export const ExerciseNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Name is required").max(40, "Name must be at most 40 characters"));

/** True if `name` clashes with a library exercise or one of `existingNames`, ignoring case and spacing (FR-005). */
export function isExerciseNameTaken(name: string, existingNames: readonly string[], library: GymLibrary): boolean {
  const n = normalizeWorkoutName(name);
  return (
    library.some((e) => normalizeWorkoutName(e.name) === n) ||
    existingNames.some((e) => normalizeWorkoutName(e) === n)
  );
}

// ---------------------------------------------------------------- admin catalog (feature 015)

export const CATALOG_LIMIT = 200;
export const CATALOG_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core"] as const;
export const CatalogGroupSchema = z.enum(CATALOG_GROUPS);
export type CatalogGroup = z.infer<typeof CatalogGroupSchema>;

export const CatalogExerciseSchema = z
  .object({
    exerciseId: z.string().regex(/^gx-[a-z0-9-]+$/),
    name: ExerciseNameSchema,
    group: CatalogGroupSchema,
    kind: z.literal("strength"),
    status: z.enum(["active", "retired"]),
    createdAt: z.string(),
    createdBy: z.string(),
    updatedAt: z.string(),
    updatedBy: z.string(),
  })
  .strict();
export type CatalogExercise = z.infer<typeof CatalogExerciseSchema>;

/** Built-ins first (code order), then active catalog exercises A→Z; retired ones are hidden, never deleted. */
export function buildLibrary(catalog: readonly CatalogExercise[]): GymLibrary {
  const extra = catalog
    .filter((c) => c.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((c): GymExerciseDef => ({ id: c.exerciseId, name: c.name, group: c.group, kind: "strength", source: "catalog" }));
  return [...GYM_EXERCISES, ...extra];
}

/** Permanent id for a new catalog exercise: `gx-<slug>`, then `-2`, `-3`… while taken (built-in ids always are). */
export function catalogId(name: string, takenIds: readonly string[]): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "exercise";
  const taken = new Set([...GYM_EXERCISES.map((e) => e.id), ...takenIds]);
  const base = `gx-${slug}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Admin create/rename: a name is taken by any built-in or any catalog row, retired ones included. */
export function isLibraryNameTaken(name: string, catalogAll: readonly { name: string }[]): boolean {
  const n = normalizeWorkoutName(name);
  return GYM_EXERCISES.some((e) => normalizeWorkoutName(e.name) === n) || catalogAll.some((c) => normalizeWorkoutName(c.name) === n);
}

// ---------------------------------------------------------------- views

export interface GymEntryView {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  exerciseKind: ExerciseKind;
  sets: GymSet[] | null;
  volumeKg: number | null;
  minutes: number;
  calories: number;
  /** Feature 007: the AI's one-line reason when it adjusted calories; null otherwise. */
  aiNote: string | null;
  /** Feature 010: an unusual jump awaiting "Looks right"; set by the server from the member's squad stats. */
  jumpFlag: boolean;
  updatedAt: string;
}

export interface GymLast {
  date: string;
  sets: GymSet[] | null;
  minutes: number;
  top: { weightKg: number; reps: number } | null;
}

export interface GymExerciseView {
  exerciseId: string;
  name: string;
  group: MuscleGroup;
  kind: ExerciseKind;
  isBuiltIn: boolean;
  /** Cardio rate (built-in cardio only). */
  rateMinutes: number | null;
  rateCalories: number | null;
  entry: GymEntryView | null;
  last: GymLast | null;
}

export interface GymView {
  date: string;
  today: string;
  timezone: string;
  editable: boolean;
  exercises: GymExerciseView[];
  summary: Summary;
}

export interface OwnExercise {
  exerciseId: string;
  name: string;
  group: MuscleGroup;
}

export const isGymEntry = (e: StoredEntry) => e.kind === "gym";

export function toGymEntryView(e: StoredEntry): GymEntryView {
  const kind = e.exerciseKind ?? "strength";
  return {
    exerciseId: e.workoutId,
    name: e.name,
    muscleGroup: e.muscleGroup ?? "chest",
    exerciseKind: kind,
    sets: kind === "strength" ? (e.sets ?? []) : null,
    volumeKg: kind === "strength" ? (e.volumeKg ?? 0) : null,
    minutes: e.minutes,
    calories: e.calories,
    aiNote: e.aiNote ?? null,
    jumpFlag: false,
    updatedAt: e.updatedAt ?? "",
  };
}

export function toGymLast(e: StoredEntry & { date: string }): GymLast {
  const v = toGymEntryView(e);
  const top = v.sets ? topSet(v.sets) : null;
  return { date: e.date, sets: v.sets, minutes: v.minutes, top: top ? { weightKg: top.weightKg, reps: top.reps } : null };
}

export function buildGymView(input: {
  date: string;
  today: string;
  timezone: string;
  ownExercises: readonly OwnExercise[];
  library: GymLibrary;
  /** All of the day's entries (workouts and gym). */
  entries: readonly StoredEntry[];
  last: Readonly<Record<string, GymLast | null>>;
}): GymView {
  const byId = new Map(input.entries.filter(isGymEntry).map((e) => [e.workoutId, e]));
  const view = (
    def: Omit<GymExerciseView, "entry" | "last">,
  ): GymExerciseView => {
    const e = byId.get(def.exerciseId);
    return { ...def, entry: e ? toGymEntryView(e) : null, last: input.last[def.exerciseId] ?? null };
  };
  const exercises: GymExerciseView[] = input.library.map((d) =>
    view({
      exerciseId: d.id,
      name: d.name,
      group: d.group,
      kind: d.kind,
      isBuiltIn: true,
      rateMinutes: d.rateMinutes ?? null,
      rateCalories: d.rateCalories ?? null,
    }),
  );
  const own = [...input.ownExercises].sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const o of own) {
    exercises.push(
      view({ exerciseId: o.exerciseId, name: o.name, group: o.group, kind: "strength", isBuiltIn: false, rateMinutes: null, rateCalories: null }),
    );
  }
  const shown = new Set(exercises.map((e) => e.exerciseId));
  for (const e of byId.values()) {
    if (shown.has(e.workoutId)) continue;
    const v = toGymEntryView(e);
    exercises.push({
      exerciseId: v.exerciseId,
      name: v.name,
      group: v.muscleGroup,
      kind: v.exerciseKind,
      isBuiltIn: false,
      rateMinutes: e.rateMinutes,
      rateCalories: e.rateCalories,
      entry: v,
      last: input.last[v.exerciseId] ?? null,
    });
  }
  return {
    date: input.date,
    today: input.today,
    timezone: input.timezone,
    editable: isEditableDay(input.date, input.today),
    exercises,
    summary: summarize(input.entries),
  };
}

/** A non-empty query searches every group by name (ignoring case and spacing); otherwise filter by group (FR-003, FR-004). */
export function filterExercises<T extends { name: string; group: MuscleGroup }>(list: readonly T[], group: MuscleGroup, query: string): T[] {
  const q = normalizeWorkoutName(query);
  if (q) return list.filter((e) => normalizeWorkoutName(e.name).includes(q));
  return list.filter((e) => e.group === group);
}

/** Total lifted volume (kg) of a day's gym entries; cardio and activity entries add nothing (feature 007, R7). */
export function dayGymVolume(entries: readonly StoredEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.kind === "gym" && typeof e.volumeKg === "number" ? e.volumeKg : 0), 0);
}

/**
 * Exercise id for an exact name (case and spacing ignored) among the library and the member's active own
 * exercises, or null. Used by the AI's upsert_workout_log (feature 007, R12): no fuzzy matching, so a typo never
 * logs the wrong lift.
 */
export function findGymExerciseByName(
  name: string,
  own: readonly { exerciseId: string; name: string; removedAt?: string }[],
  library: GymLibrary,
): string | null {
  const n = normalizeWorkoutName(name);
  const builtIn = library.find((e) => normalizeWorkoutName(e.name) === n);
  if (builtIn) return builtIn.id;
  return own.find((e) => !e.removedAt && normalizeWorkoutName(e.name) === n)?.exerciseId ?? null;
}
