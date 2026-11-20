import { buildShareSummary, isWorkoutEntry, localDate, type FeedWorkout, type ShareFigures, type SharePostState, type SquadStats } from "@calci/shared";
import type { Caller } from "./auth";
import type { Deps } from "./deps";
import { apiError } from "./http";
import { resolveReadDate } from "./day-context";
import { squadSettingsOf, type ProfileItem } from "./profile-repo";
import type { FeedItem } from "./squad-repo";
import type { EntryItem } from "./workout-repo";

/** Feature 016: shared by the share and post handlers. Never log entries, figures or photo keys. */

export const canPost = (profile: ProfileItem) => profile.leaderboardVisible !== false;

export const postState = (profile: ProfileItem, item: FeedItem | null): SharePostState => ({
  posted: item?.postedAt !== undefined,
  hasPhoto: item?.postedAt !== undefined && item.photoKey !== undefined,
  canPost: canPost(profile),
});

/** The caller's profile, a valid date up to their today, and that day's entries when it is a workout day. */
export async function loadOwnWorkoutDay(caller: Caller, rawDate: string | undefined, deps: Deps) {
  const profile = await deps.profiles.get(caller.userId);
  if (!profile) return { ok: false as const, response: apiError(409, "PROFILE_REQUIRED", "Complete your profile first") };
  const day = resolveReadDate(rawDate ?? "", localDate(deps.now(), profile.timezone));
  if (!day.ok) return day;
  const entries = await deps.workouts.listEntriesForDay(caller.userId, day.date);
  if (!entries.some((e) => isWorkoutEntry(e))) {
    return { ok: false as const, response: apiError(404, "NOT_A_WORKOUT_DAY", "Nothing logged on this day yet") };
  }
  return { ok: true as const, profile, date: day.date, entries };
}

export function figuresFor(profile: ProfileItem, date: string, entries: readonly EntryItem[], stats: SquadStats | null, steps: number | null): ShareFigures {
  return buildShareSummary({ date, entries, stats, weeklyTarget: squadSettingsOf(profile).weeklyTarget, steps });
}

/** The feed's workout block: no steps or streak, and PRs on built-in lifts only (as in the rest of the feed). */
export async function feedWorkout(profile: ProfileItem, item: FeedItem, stats: SquadStats | null, deps: Deps): Promise<FeedWorkout> {
  const entries = await deps.workouts.listEntriesForDay(profile.userId, item.eventDate);
  const { label, durationMin, exerciseCount, liftsImproved, rows, moreCount, prs } = figuresFor(profile, item.eventDate, entries, stats, null);
  return {
    label,
    durationMin,
    exerciseCount,
    liftsImproved,
    rows,
    moreCount,
    prs: prs.filter((p) => p.exerciseId.startsWith("gx-")),
    photoUrl: item.photoKey ? await deps.sharePhotos.urlFor(item.photoKey) : null,
  };
}
