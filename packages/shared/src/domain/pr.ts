/**
 * Feature 019: the one PR definition, used by the server's PR walk (`squad.ts`) and the drawer's live badge.
 * Pure. Weight PR > Rep PR > estimate PR; ties never count; the first session is a baseline; 0 kg never counts.
 */

export const JUMP_RATIO = 1.5;
export const JUMP_MIN_KG = 20;
/** A Rep PR needs at least this share of the best weight. */
export const REP_PR_MIN_SHARE = 0.8;

export type PrType = "weight" | "reps" | "e1rm";
const TYPE_ORDER: Record<PrType, number> = { weight: 0, reps: 1, e1rm: 2 };

export interface PrBests {
  /** Earlier days with at least one counted set; 0 = baseline mode. */
  sessions: number;
  bestWeight: { weightKg: number; reps: number; date: string } | null;
  bestE1rm: number | null;
  /** Non-dominated (weight, reps) points: weight descending, reps strictly increasing. */
  frontier: { weightKg: number; reps: number }[];
}

/** Stored per lift: bests before each of its latest entry dates, plus over everything. */
export interface PrBase {
  all: PrBests;
  before: Record<string, PrBests>;
  /** True when `before` covers every entry date of the lift. */
  complete: boolean;
}

export interface PrHit {
  type: PrType;
  /** kg (weight, e1rm) or reps (reps). */
  value: number;
  previous: number;
  gain: number;
  weightKg: number;
  reps: number;
  setIndex: number;
}

export interface PrPreview extends PrHit {
  bigJump: boolean;
}

export const EMPTY_BESTS: PrBests = { sessions: 0, bestWeight: null, bestE1rm: null, frontier: [] };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Epley estimate, only for 1-10 reps (higher reps make it unreliable). */
export function e1rm(weightKg: number, reps: number): number | null {
  return reps >= 1 && reps <= 10 ? round1(weightKg * (1 + reps / 30)) : null;
}

/** The unusual-jump rule (feature 010): more than 50% and more than 20 kg above the previous best. */
export const isSuspicious = (value: number | null, prev: number | null) =>
  value !== null && prev !== null && prev > 0 && value > prev * JUMP_RATIO && value - prev > JUMP_MIN_KG;

/** Most reps ever done at this weight or heavier (0 when none). */
export function maxRepsAtOrAbove(bests: PrBests, weightKg: number): number {
  let best = 0;
  for (const p of bests.frontier) if (p.weightKg >= weightKg && p.reps > best) best = p.reps;
  return best;
}

export function classifySet(bests: PrBests, set: { weightKg: number; reps: number }, setIndex = 0): PrHit | null {
  const { weightKg: w, reps: r } = set;
  if (bests.sessions === 0 || bests.bestWeight === null || r < 1 || w <= 0) return null;
  const base = { weightKg: w, reps: r, setIndex };
  const bw = bests.bestWeight.weightKg;
  if (w > bw) return { type: "weight", value: w, previous: bw, gain: round1(w - bw), ...base };
  if (w >= bw * REP_PR_MIN_SHARE) {
    const prev = maxRepsAtOrAbove(bests, w);
    if (r > prev) return { type: "reps", value: r, previous: prev, gain: r - prev, ...base };
  }
  const est = e1rm(w, r);
  if (est !== null && bests.bestE1rm !== null && est > bests.bestE1rm) {
    return { type: "e1rm", value: est, previous: bests.bestE1rm, gain: round1(est - bests.bestE1rm), ...base };
  }
  return null;
}

/** Highest type first, then the bigger gain, then the earlier set. */
export const comparePr = (a: PrHit, b: PrHit) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.gain - a.gain || a.setIndex - b.setIndex;

export function pickTopPr<T extends PrHit>(hits: readonly T[]): T | null {
  return hits.length ? [...hits].sort(comparePr)[0]! : null;
}

export function isBigJump(bests: PrBests, set: { weightKg: number; reps: number }): boolean {
  return isSuspicious(set.weightKg, bests.bestWeight?.weightKg ?? null) || isSuspicious(e1rm(set.weightKg, set.reps), bests.bestE1rm);
}

/** Fold one day's counted sets into the bests. */
export function addToBests(bests: PrBests, sets: readonly { weightKg: number; reps: number }[], date: string): PrBests {
  const counted = sets.filter((s) => s.reps >= 1 && s.weightKg > 0);
  if (counted.length === 0) return bests;
  let bestWeight = bests.bestWeight;
  let bestE1rm = bests.bestE1rm;
  for (const s of counted) {
    if (!bestWeight || s.weightKg > bestWeight.weightKg || (s.weightKg === bestWeight.weightKg && s.reps > bestWeight.reps)) {
      bestWeight = { weightKg: s.weightKg, reps: s.reps, date };
    }
    const est = e1rm(s.weightKg, s.reps);
    if (est !== null && (bestE1rm === null || est > bestE1rm)) bestE1rm = est;
  }
  const points = [...bests.frontier, ...counted.map((s) => ({ weightKg: s.weightKg, reps: s.reps }))].sort(
    (a, b) => b.weightKg - a.weightKg || b.reps - a.reps,
  );
  const frontier: PrBests["frontier"] = [];
  for (const p of points) if (p.reps > (frontier.at(-1)?.reps ?? 0)) frontier.push(p);
  return { sessions: bests.sessions + 1, bestWeight, bestE1rm, frontier };
}

/** The bests before `date`, or null when the stored snapshots can't tell (only for days older than every kept entry). */
export function bestsBefore(base: PrBase | undefined, date: string): PrBests | null {
  if (!base) return null;
  const exact = base.before[date];
  if (exact) return exact;
  const kept = Object.keys(base.before).sort();
  const later = kept.find((d) => d > date);
  if (later === undefined) return base.all;
  if (later === kept[0] && !base.complete) return null;
  return base.before[later]!;
}

/** The drawer's live check: every set with weight and reps, ticked or not. */
export function previewPr(bests: PrBests | null, sets: readonly { weightKg: number; reps: number }[]): PrPreview | null {
  if (!bests) return null;
  const hits = sets.flatMap((s, i) => {
    const h = classifySet(bests, s, i);
    return h ? [h] : [];
  });
  const top = pickTopPr(hits);
  return top ? { ...top, bigJump: isBigJump(bests, top) } : null;
}
