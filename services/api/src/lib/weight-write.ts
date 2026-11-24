import type { APIGatewayProxyResultV2 } from "aws-lambda";
import {
  WEIGHT_ID_PATTERN,
  WEIGHT_MAX_PER_DAY,
  buildWeightView,
  newWeightEntryId,
  rangeWindow,
  type WeightEntryLike,
  type WeightRange,
  type WeightView,
} from "@calci/shared";
import type { Caller } from "./auth";
import { loadDayContext, resolveWriteDate } from "./day-context";
import type { Deps } from "./deps";
import { apiError } from "./http";
import type { WeightItem } from "./weight-repo";

/**
 * Feature 014: the one write path for weigh-ins (HTTP routes and Settings). Today and the edit window come from the
 * member's timezone (constitution V); the profile body weight is re-synced to the latest entry after every write.
 * Never log weights.
 */

export type WeightResult = { ok: true; view: WeightView } | { ok: false; response: APIGatewayProxyResultV2 };

const toEntry = (i: WeightItem): WeightEntryLike => ({ id: i.entryId, date: i.date, recordedAt: i.recordedAt, weightKg: i.weightKg });

export async function loadWeightView(userId: string, today: string, range: WeightRange, deps: Deps): Promise<WeightView> {
  const win = rangeWindow(range, today);
  const [items, latest, profile] = await Promise.all([
    deps.weights.listRange(userId, win.fetchFrom, today),
    deps.weights.latest(userId),
    deps.profiles.get(userId),
  ]);
  return buildWeightView({
    range,
    today,
    entries: items.map(toEntry),
    latest: latest ? toEntry(latest) : null,
    profileWeightKg: profile?.bodyWeightKg ?? null,
  });
}

/** Profile `bodyWeightKg` = latest entry (date, then save time). No entries: left alone. Best effort; the next write repairs it. */
export async function syncProfileWeight(userId: string, deps: Deps): Promise<void> {
  try {
    const latest = await deps.weights.latest(userId);
    if (latest) await deps.profiles.setBodyWeight(userId, latest.weightKg, deps.now().toISOString());
  } catch (err) {
    console.error("weight profile sync failed", err instanceof Error ? err.name : "unknown");
  }
}

export async function logWeight(caller: Caller, input: { weightKg: number; date?: string | undefined }, range: WeightRange, deps: Deps): Promise<WeightResult> {
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c;
  const d = resolveWriteDate(input.date ?? c.ctx.today, c.ctx.today);
  if (!d.ok) return d;
  if ((await deps.weights.countDay(caller.userId, d.date)) >= WEIGHT_MAX_PER_DAY) {
    return { ok: false, response: apiError(409, "DAY_FULL", `You can log up to ${WEIGHT_MAX_PER_DAY} weigh-ins a day`) };
  }
  const now = deps.now();
  await deps.weights.create({ userId: caller.userId, entryId: newWeightEntryId(now), date: d.date, weightKg: input.weightKg, recordedAt: now.toISOString() });
  await syncProfileWeight(caller.userId, deps);
  return { ok: true, view: await loadWeightView(caller.userId, c.ctx.today, range, deps) };
}

/** Idempotent; only the caller's own partition is ever addressed (spec US3 #3). */
export async function deleteWeight(caller: Caller, rawDate: string | undefined, entryId: string, range: WeightRange, deps: Deps): Promise<WeightResult> {
  const c = await loadDayContext(caller, deps);
  if (!c.ok) return c;
  const d = resolveWriteDate(rawDate, c.ctx.today);
  if (!d.ok) return d;
  if (WEIGHT_ID_PATTERN.test(entryId)) {
    await deps.weights.delete(caller.userId, d.date, entryId);
    await syncProfileWeight(caller.userId, deps);
  }
  return { ok: true, view: await loadWeightView(caller.userId, c.ctx.today, range, deps) };
}
