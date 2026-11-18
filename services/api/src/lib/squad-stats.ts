import { SQUAD_ID, buildMemberStats, isWorkoutEntry, localDate } from "@calci/shared";
import type { Deps } from "./deps";
import { squadSettingsOf } from "./profile-repo";

/** What the rebuild needs, so the operator backfill can run it without the S3 stores. */
export type StatsDeps = Pick<Deps, "profiles" | "workouts" | "squad" | "now">;

/**
 * Feature 010 (research R1, R2, R6, R13): rebuild one member's cached squad stats from all of their entries and
 * bring their feed items in line. Shared by every path that changes workout entries (HTTP and MCP), so the AI agent
 * triggers exactly the same updates as the app. Never log entries, sets or feed text (constitution VI).
 *
 * `seed` is the launch backfill: history is trusted (nothing is flagged), every event that exists now is recorded as
 * seeded so it never reaches the feed, and no feed item is created.
 */
export async function refreshSquadStats(userId: string, deps: StatsDeps, opts: { seed?: boolean } = {}): Promise<void> {
  const profile = await deps.profiles.get(userId);
  if (!profile) return;
  const weeklyTarget = squadSettingsOf(profile).weeklyTarget;

  for (let attempt = 0; attempt < 2; attempt++) {
    const now = deps.now();
    const nowIso = now.toISOString();
    const today = localDate(now, profile.timezone);
    const [entries, prev, feed] = await Promise.all([
      deps.workouts.listEntriesInRange(userId, "0000-01-01", today),
      deps.squad.getStats(userId),
      deps.squad.listMemberFeed(userId),
    ]);
    const existing = new Map(feed.map((f) => [f.eventId, f]));

    const { stats, events } = buildMemberStats(entries, prev, {
      weeklyTarget,
      today,
      nowIso,
      ...(opts.seed ? { trustedBefore: prev?.trustedBefore ?? nowIso } : {}),
    });
    if (opts.seed) {
      const seeded = new Set(stats.seededEventIds);
      for (const e of events) if (!existing.has(e.id)) seeded.add(e.id);
      stats.seededEventIds = [...seeded];
    }

    if ((await deps.squad.putStats(userId, stats, prev?.version ?? null)) === "conflict") continue;

    const derived = new Set(events.map((e) => e.id));
    // Day high-five targets (feature 011) stay while that date is still a workout day; they are never created here.
    // Protein events belong to protein-events.ts.
    const workoutDays = new Set(entries.filter((e) => isWorkoutEntry(e)).map((e) => e.date));
    for (const f of feed) {
      if (f.eventId.startsWith("day#") && workoutDays.has(f.eventId.slice("day#".length))) derived.add(f.eventId);
      if (f.eventId.startsWith("protein7#")) derived.add(f.eventId);
    }
    for (const e of events) {
      const have = existing.get(e.id);
      if (!have) {
        if (!opts.seed) {
          await deps.squad.putFeed({ userId, squadId: SQUAD_ID, eventId: e.id, kind: e.kind, eventDate: e.date, payload: e.payload, hi5Count: 0, createdAt: nowIso });
        }
      } else if (have.eventDate !== e.date || JSON.stringify(have.payload) !== JSON.stringify(e.payload)) {
        await deps.squad.updateFeed(userId, e.id, e.date, e.payload);
      }
    }
    // An event that is no longer true (edited or deleted inside the edit window) disappears with its high-fives.
    for (const f of feed) if (!derived.has(f.eventId)) await deps.squad.deleteFeed(userId, f.eventId);
    return;
  }
}

/** Never throws: the workout write already succeeded, and the next write or a backfill repairs the stats (R2). */
export async function safeRefresh(userId: string, deps: Deps): Promise<void> {
  try {
    await refreshSquadStats(userId, deps);
  } catch (err) {
    console.error("squad-stats refresh failed", err instanceof Error ? err.name : "unknown");
  }
}
