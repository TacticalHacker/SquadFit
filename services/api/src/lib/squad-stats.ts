import { SQUAD_ID, buildGymLastIndex, buildMemberStats, isWorkoutEntry, localDate } from "@calci/shared";
import type { Deps } from "./deps";
import { NO_REACTIONS } from "./squad-repo";
import { squadSettingsOf } from "./profile-repo";
import { refreshRaids } from "./raid-refresh";

/** What the rebuild needs, so the operator backfill can run it without the S3 stores. */
export type StatsDeps = Pick<Deps, "profiles" | "workouts" | "squad" | "raids" | "now"> & Partial<Pick<Deps, "sharePhotos">>;

/**
 * Feature 010 (research R1, R2, R6, R13): rebuild one member's cached squad stats from all of their entries and
 * bring their feed items in line. Shared by every path that changes workout entries (HTTP and MCP), so the AI agent
 * triggers exactly the same updates as the app. Never log entries, sets or feed text (constitution VI).
 *
 * `seed` is the launch backfill: history is trusted (nothing is flagged), every event that exists now is recorded as
 * seeded so it never reaches the feed, and no feed item is created.
 *
 * Feature 021: also recomputes the member's raid contributions from the same entries; returns the counted kg added.
 */
export async function refreshSquadStats(userId: string, deps: StatsDeps, opts: { seed?: boolean } = {}): Promise<{ raidKg: number }> {
  const profile = await deps.profiles.get(userId);
  if (!profile) return { raidKg: 0 };
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

    const { stats, events, held } = buildMemberStats(entries, prev, {
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
    // The Gym tab's "last time" index comes from the same full read of the member's entries.
    await deps.workouts.putGymLastIndex(userId, buildGymLastIndex(entries), nowIso);

    const derived = new Set(events.map((e) => e.id));
    // Day high-five targets (feature 011) stay while that date is still a workout day; they are never created here.
    // Protein and step-run events belong to protein-events.ts and step-events.ts.
    const workoutDays = new Set(entries.filter((e) => isWorkoutEntry(e)).map((e) => e.date));
    for (const f of feed) {
      if (f.eventId.startsWith("day#") && workoutDays.has(f.eventId.slice("day#".length))) derived.add(f.eventId);
      if (f.eventId.startsWith("protein7#") || f.eventId.startsWith("steps7#")) derived.add(f.eventId);
    }
    for (const e of events) {
      const have = existing.get(e.id);
      if (!have) {
        if (!opts.seed) {
          await deps.squad.putFeed({ userId, squadId: SQUAD_ID, eventId: e.id, kind: e.kind, eventDate: e.date, payload: e.payload, reactions: { ...NO_REACTIONS }, createdAt: nowIso });
        }
      } else if (have.eventDate !== e.date || JSON.stringify(have.payload) !== JSON.stringify(e.payload)) {
        await deps.squad.updateFeed(userId, e.id, e.date, e.payload);
      }
    }
    // An event that is no longer true (edited or deleted inside the edit window) disappears with its high-fives.
    for (const f of feed) {
      if (derived.has(f.eventId)) continue;
      await deps.squad.deleteFeed(userId, f.eventId);
      // Feature 016: a posted day that is no longer a workout day loses its photo too. Best effort: the item is already
      // gone, so the picture can never be shown; functions without the delete grant (MCP) leave it behind.
      if (f.photoKey) await deps.sharePhotos?.delete(f.photoKey).catch((err: unknown) => console.error("share photo delete failed", err instanceof Error ? err.name : "unknown"));
    }
    // Feature 021: raid counting reads the same entries; a failure never undoes the stats (next write repairs it).
    try {
      const raidKg = await refreshRaids({ userId, profile, entries, held, statsVersion: (prev?.version ?? 0) + 1 }, deps);
      return { raidKg };
    } catch (err) {
      console.error("raid refresh failed", err instanceof Error ? err.name : "unknown");
      return { raidKg: 0 };
    }
  }
  return { raidKg: 0 };
}

/** Never throws: the workout write already succeeded, and the next write or a backfill repairs the stats (R2). */
export async function safeRefresh(userId: string, deps: Deps): Promise<{ raidKg: number }> {
  try {
    return await refreshSquadStats(userId, deps);
  } catch (err) {
    console.error("squad-stats refresh failed", err instanceof Error ? err.name : "unknown");
    return { raidKg: 0 };
  }
}
