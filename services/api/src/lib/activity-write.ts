import {
  formatProblems,
  isStepGoalHit,
  localDate,
  parseActivityDays,
  type ActivityProblem,
  type ActivitySaveResult,
  type ActivitySource,
} from "@calci/shared";
import type { Deps } from "./deps";
import type { ProfileItem } from "./profile-repo";
import { stepSettingsOf } from "./profile-repo";
import { safeRefreshSteps } from "./step-events";

export type ActivitySaveOutcome = { ok: true; result: ActivitySaveResult } | { ok: false; message: string; problems: ActivityProblem[] };

/**
 * Feature 012: the one save path for daily activity, used by the Shortcut endpoint and the MCP tool. Validates raw
 * days against the member's local today (constitution V), replaces each day whole (latest write wins), then keeps the
 * step-run feed items true. Never log values.
 */
export async function saveActivity(profile: ProfileItem, rawDays: readonly unknown[], source: ActivitySource, deps: Deps): Promise<ActivitySaveOutcome> {
  const now = deps.now();
  const parsed = parseActivityDays(rawDays, localDate(now, profile.timezone));
  if (!parsed.ok) return { ok: false, message: formatProblems(parsed.problems), problems: parsed.problems };
  const saved = await deps.activity.putDays(profile.userId, parsed.days, source, now.toISOString());
  await safeRefreshSteps(profile.userId, deps);
  const goal = stepSettingsOf(profile).dailyStepGoal;
  return {
    ok: true,
    result: {
      saved: saved.map((d) => ({ date: d.date, steps: d.steps, activeKcal: d.activeKcal, distanceKm: d.distanceKm, goalHit: isStepGoalHit(d.steps, goal) })),
      stepGoal: goal,
      source,
    },
  };
}
