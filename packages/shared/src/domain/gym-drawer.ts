import {
  GYM_CARDIO_STEP,
  GYM_DEFAULT_INCLINE,
  GYM_DEFAULT_SPEED,
  GYM_INCLINE_STEP,
  GYM_MAX_INCLINE,
  GYM_MAX_SPEED,
  GYM_MIN_SPEED,
  GYM_SPEED_STEP,
  GYM_DEFAULT_CARDIO_MINUTES,
  GYM_DEFAULT_REPS,
  GYM_DEFAULT_SETS,
  GYM_MAX_REPS,
  GYM_MAX_SETS,
  GYM_MAX_WEIGHT,
  cardioEntryTotals,
  gymTotals,
  parseIncline,
  parseMinutes,
  parseReps,
  parseSpeed,
  parseWeight,
  stepWeight,
  type ExerciseKind,
  type GymSet,
  type ParseResult,
} from "./gym";
import { DEFAULT_BODY_WEIGHT_KG } from "./profile";

/**
 * Pure state machine behind the gym drawer (research R7). Shared so the steppers are unit-tested
 * without a DOM, and so the footer preview uses the same math as the server (FR-013, FR-014).
 */

export interface DrawerRow {
  weightKg: number;
  reps: number;
  completed: boolean;
  /** True once the member changed this row's reps by hand (FR-010). */
  repsEdited: boolean;
}

export interface DrawerState {
  mode: ExerciseKind;
  defaultReps: number;
  rows: DrawerRow[];
  minutes: number;
  /** Treadmill details; null = not logged. Optional so drafts saved before them still load. */
  inclinePct?: number | null;
  speedKmh?: number | null;
  /** True once anything changed since the drawer opened. */
  dirty: boolean;
}

export type DrawerAction =
  | { type: "addSet" }
  | { type: "removeSet" }
  | { type: "defaultReps"; delta: number }
  | { type: "setDefaultReps"; value: number }
  | { type: "weight"; index: number; delta: number }
  | { type: "setWeight"; index: number; value: number }
  | { type: "reps"; index: number; delta: number }
  | { type: "setReps"; index: number; value: number }
  | { type: "toggleDone"; index: number }
  | { type: "minutes"; delta: number }
  | { type: "setMinutes"; value: number }
  | { type: "incline"; delta: number }
  | { type: "setIncline"; value: number | null }
  | { type: "speed"; delta: number }
  | { type: "setSpeed"; value: number | null };

export interface DrawerExercise {
  kind: ExerciseKind;
  rateMinutes?: number | null;
  rateCalories?: number | null;
  /** Incline Treadmill Walk: calories follow incline, speed and the member's body weight once both are set. */
  treadmill?: boolean;
  bodyWeightKg?: number;
}

type Source = { sets?: readonly GymSet[] | null; minutes?: number; inclinePct?: number | null; speedKmh?: number | null };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampWeight = (n: number) => clamp(Math.round(n * 2) / 2, 0, GYM_MAX_WEIGHT);
const clampReps = (n: number) => clamp(Math.round(n), 1, GYM_MAX_REPS);
const clampMinutes = (n: number) => clamp(Math.round(n), 1, 600);
const clampIncline = (n: number) => clamp(Math.round(n * 2) / 2, 0, GYM_MAX_INCLINE);
const clampSpeed = (n: number) => clamp(Math.round(n * 10) / 10, GYM_MIN_SPEED, GYM_MAX_SPEED);

/** Starting state: draft → saved entry → last earlier entry → defaults (data-model "Drawer state"). */
export function initDrawer(input: { exercise: DrawerExercise; draft?: DrawerState | null; entry?: Source | null; last?: Source | null }): DrawerState {
  if (input.draft) return input.draft;
  const from = input.entry ?? input.last ?? null;
  if (input.exercise.kind === "cardio") {
    return {
      mode: "cardio",
      defaultReps: GYM_DEFAULT_REPS,
      rows: [],
      minutes: from?.minutes ?? GYM_DEFAULT_CARDIO_MINUTES,
      // Prefilled from the saved entry or last time; nothing is logged until the member sets a value.
      inclinePct: from?.inclinePct ?? null,
      speedKmh: from?.speedKmh ?? null,
      dirty: false,
    };
  }
  const keepTicks = Boolean(input.entry);
  const sets = from?.sets ?? [];
  if (sets.length === 0) {
    const rows = Array.from({ length: GYM_DEFAULT_SETS }, () => ({ weightKg: 0, reps: GYM_DEFAULT_REPS, completed: false, repsEdited: false }));
    return { mode: "strength", defaultReps: GYM_DEFAULT_REPS, rows, minutes: 0, dirty: false };
  }
  const rows = sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, completed: keepTicks && s.completed, repsEdited: false }));
  return { mode: "strength", defaultReps: rows[rows.length - 1]!.reps, rows, minutes: 0, dirty: false };
}

function updateRow(state: DrawerState, index: number, fn: (r: DrawerRow) => DrawerRow): DrawerRow[] {
  return state.rows.map((r, i) => (i === index ? fn(r) : r));
}

function withDefaultReps(state: DrawerState, value: number): DrawerState {
  const defaultReps = clampReps(value);
  return { ...state, defaultReps, rows: state.rows.map((r) => (r.repsEdited ? r : { ...r, reps: defaultReps })) };
}

function reduce(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case "addSet": {
      if (state.rows.length >= GYM_MAX_SETS) return state;
      const last = state.rows[state.rows.length - 1];
      const row = last
        ? { ...last, completed: false }
        : { weightKg: 0, reps: state.defaultReps, completed: false, repsEdited: false };
      return { ...state, rows: [...state.rows, row] };
    }
    case "removeSet":
      return state.rows.length <= 1 ? state : { ...state, rows: state.rows.slice(0, -1) };
    case "defaultReps":
      return withDefaultReps(state, state.defaultReps + action.delta);
    case "setDefaultReps":
      return withDefaultReps(state, action.value);
    case "weight":
      return { ...state, rows: updateRow(state, action.index, (r) => ({ ...r, weightKg: clampWeight(stepWeight(r.weightKg, action.delta < 0 ? -1 : 1)) })) };
    case "setWeight":
      return { ...state, rows: updateRow(state, action.index, (r) => ({ ...r, weightKg: clampWeight(action.value) })) };
    case "reps":
      return { ...state, rows: updateRow(state, action.index, (r) => ({ ...r, reps: clampReps(r.reps + action.delta), repsEdited: true })) };
    case "setReps":
      return { ...state, rows: updateRow(state, action.index, (r) => ({ ...r, reps: clampReps(action.value), repsEdited: true })) };
    case "toggleDone":
      return { ...state, rows: updateRow(state, action.index, (r) => ({ ...r, completed: !r.completed })) };
    case "minutes":
      return { ...state, minutes: clampMinutes(state.minutes + action.delta * GYM_CARDIO_STEP) };
    case "setMinutes":
      return { ...state, minutes: clampMinutes(action.value) };
    // The first tap on an unset value starts at a sensible default instead of 0.
    case "incline":
      return { ...state, inclinePct: state.inclinePct == null ? GYM_DEFAULT_INCLINE : clampIncline(state.inclinePct + action.delta * GYM_INCLINE_STEP) };
    case "setIncline":
      return { ...state, inclinePct: action.value === null ? null : clampIncline(action.value) };
    case "speed":
      return { ...state, speedKmh: state.speedKmh == null ? GYM_DEFAULT_SPEED : clampSpeed(state.speedKmh + action.delta * GYM_SPEED_STEP) };
    case "setSpeed":
      return { ...state, speedKmh: action.value === null ? null : clampSpeed(action.value) };
  }
}

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  const next = reduce(state, action);
  if (next === state) return state;
  return next.dirty ? next : { ...next, dirty: true };
}

/** Validates a typed value before it becomes a `set*` action (FR-011, US2-6). */
export function commitTyped(field: "weight" | "reps" | "minutes" | "incline" | "speed", raw: string): ParseResult {
  if (field === "weight") return parseWeight(raw);
  if (field === "reps") return parseReps(raw);
  if (field === "incline") return parseIncline(raw);
  if (field === "speed") return parseSpeed(raw);
  return parseMinutes(raw);
}

/** The PUT body: never includes totals (FR-014). */
export function drawerToBody(state: DrawerState): { sets: GymSet[] } | { minutes: number; inclinePct?: number; speedKmh?: number } {
  if (state.mode === "cardio") {
    return {
      minutes: state.minutes,
      ...(state.inclinePct != null ? { inclinePct: state.inclinePct } : {}),
      ...(state.speedKmh != null ? { speedKmh: state.speedKmh } : {}),
    };
  }
  return { sets: state.rows.map((r, i) => ({ setNumber: i + 1, reps: r.reps, weightKg: r.weightKg, completed: r.completed })) };
}

/** Footer preview. Same functions the server uses. */
export function drawerTotals(state: DrawerState, exercise: DrawerExercise): { volumeKg: number | null; minutes: number; calories: number } {
  if (state.mode === "cardio") {
    const t = cardioEntryTotals({
      rateMinutes: exercise.rateMinutes ?? 1,
      rateCalories: exercise.rateCalories ?? 0,
      minutes: state.minutes,
      treadmill: exercise.treadmill
        ? { inclinePct: state.inclinePct, speedKmh: state.speedKmh, bodyWeightKg: exercise.bodyWeightKg ?? DEFAULT_BODY_WEIGHT_KG }
        : null,
    });
    return { volumeKg: null, ...t };
  }
  return gymTotals(state.rows);
}
