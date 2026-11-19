import { SQUAD_ID, STEP_STREAK_DAYS, addDays, isStepRun, localDate } from "@calci/shared";
import type { Deps } from "./deps";
import { NO_REACTIONS } from "./squad-repo";
import { stepsShared } from "./member-access";
import { stepSettingsOf } from "./profile-repo";

const PREFIX = "steps7#";

type StepDeps = Pick<Deps, "profiles" | "activity" | "squad" | "now">;

/**
 * Feature 012 (research R10): keep a member's "hit their step goal 7 days in a row" feed items true. An item is
 * created when the 7 days ending today were all goal hits and no kept item overlaps them, and removed when its days
 * stop being hits or the member stops sharing steps. Called after activity writes and step/squad settings changes.
 * Never log steps or feed text.
 */
export async function refreshStepEvents(userId: string, deps: StepDeps): Promise<void> {
  const profile = await deps.profiles.get(userId);
  if (!profile) return;
  const existing = (await deps.squad.listMemberFeed(userId)).filter((f) => f.eventId.startsWith(PREFIX));
  if (!stepsShared(profile)) {
    for (const f of existing) await deps.squad.deleteFeed(userId, f.eventId);
    return;
  }
  const goal = stepSettingsOf(profile).dailyStepGoal;
  const now = deps.now();
  const today = localDate(now, profile.timezone);
  const from = addDays(today, -(STEP_STREAK_DAYS * 2 - 1));
  const byDay = new Map((await deps.activity.listRange(userId, from, today)).map((d) => [d.date, d.steps] as const));

  const kept: string[] = [];
  for (const f of existing) {
    const end = f.eventId.slice(PREFIX.length);
    // Only items whose 7 days are inside the read window can be checked; older ones are history and stay.
    if (end >= addDays(from, STEP_STREAK_DAYS - 1) && !isStepRun(byDay, end, goal)) await deps.squad.deleteFeed(userId, f.eventId);
    else kept.push(end);
  }
  const covered = kept.some((end) => end > addDays(today, -STEP_STREAK_DAYS));
  if (!covered && isStepRun(byDay, today, goal)) {
    await deps.squad.putFeed({
      userId,
      squadId: SQUAD_ID,
      eventId: `${PREFIX}${today}`,
      kind: "step_streak",
      eventDate: today,
      payload: { days: STEP_STREAK_DAYS },
      reactions: { ...NO_REACTIONS },
      createdAt: now.toISOString(),
    });
  }
}

/** Never throws: the write already succeeded; the next one repairs it. Logs only the error name. */
export async function safeRefreshSteps(userId: string, deps: StepDeps): Promise<void> {
  try {
    await refreshStepEvents(userId, deps);
  } catch (err) {
    console.error("step events refresh failed", err instanceof Error ? err.name : "unknown");
  }
}
