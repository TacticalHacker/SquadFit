import { PROTEIN_STREAK_DAYS, SQUAD_ID, addDays, isProteinRun, localDate, proteinByDay } from "@calci/shared";
import type { Deps } from "./deps";
import { squadSettingsOf } from "./profile-repo";

const PREFIX = "protein7#";

/**
 * Feature 011 (research R9): keep a member's "hit protein 7 days in a row" feed items true. An event is created when the
 * 7 days ending today were all hits (and no event already covers them), and removed when its 7 days are no longer all
 * hits, when sharing is off or when the member has no protein target. Called after food writes, target and sharing
 * changes. Never log entries or feed text.
 */
export async function refreshProteinEvents(userId: string, deps: Pick<Deps, "profiles" | "food" | "squad" | "now">): Promise<void> {
  const profile = await deps.profiles.get(userId);
  if (!profile) return;
  const target = profile.dailyProteinTarget;
  const sharing = squadSettingsOf(profile).nutritionSharing !== "off" && target !== undefined;
  const existing = (await deps.squad.listMemberFeed(userId)).filter((f) => f.eventId.startsWith(PREFIX));
  if (!sharing) {
    for (const f of existing) await deps.squad.deleteFeed(userId, f.eventId);
    return;
  }
  const now = deps.now();
  const today = localDate(now, profile.timezone);
  const from = addDays(today, -(PROTEIN_STREAK_DAYS * 2 - 1));
  const byDay = proteinByDay(await deps.food.listEntriesInRange(userId, from, today));

  const kept: string[] = [];
  for (const f of existing) {
    const end = f.eventId.slice(PREFIX.length);
    // Only events inside the window can be checked; older ones are history and stay.
    if (end >= addDays(from, PROTEIN_STREAK_DAYS - 1) && !isProteinRun(byDay, end, target)) await deps.squad.deleteFeed(userId, f.eventId);
    else kept.push(end);
  }
  const covered = kept.some((end) => end > addDays(today, -PROTEIN_STREAK_DAYS));
  if (!covered && isProteinRun(byDay, today, target)) {
    await deps.squad.putFeed({
      userId,
      squadId: SQUAD_ID,
      eventId: `${PREFIX}${today}`,
      kind: "protein_streak",
      eventDate: today,
      payload: { days: PROTEIN_STREAK_DAYS },
      hi5Count: 0,
      createdAt: now.toISOString(),
    });
  }
}

/** Never throws: the food write already succeeded; the next write repairs it. Logs only the error name. */
export async function safeRefreshProtein(userId: string, deps: Pick<Deps, "profiles" | "food" | "squad" | "now">): Promise<void> {
  try {
    await refreshProteinEvents(userId, deps);
  } catch (err) {
    console.error("protein events refresh failed", err instanceof Error ? err.name : "unknown");
  }
}
