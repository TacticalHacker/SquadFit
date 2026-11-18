import {
  DayCardSchema,
  buildDayCard,
  buildFoodDay,
  localDate,
  nutritionFor,
  type DayCard,
  type NutritionLevel,
  type PrDay,
  type SquadStats,
} from "@calci/shared";
import type { Deps } from "./deps";
import type { ProfileItem } from "./profile-repo";
import { feedId, type FeedItem } from "./squad-repo";
import type { EntryItem } from "./workout-repo";

/** Feature 011: builds day cards for one member. Never log entries, sets, meals or photo keys. */

export const dayEventId = (date: string) => `day#${date}`;

export const prsOf = (stats: SquadStats | null): Record<string, readonly PrDay[]> =>
  Object.fromEntries(Object.entries(stats?.lifts ?? {}).map(([id, l]) => [id, l.prDays]));

/** The member's own `FEED#` items by event id, plus which the viewer has high-fived. */
export async function loadHighFives(ownerId: string, viewerId: string, deps: Deps) {
  const items = await deps.squad.listMemberFeed(ownerId);
  const mine = await deps.squad.myHighFives(viewerId, items.map((f) => ({ userId: ownerId, eventId: f.eventId })));
  return { byEvent: new Map<string, FeedItem>(items.map((f) => [f.eventId, f])), mine };
}
export type HighFives = Awaited<ReturnType<typeof loadHighFives>>;

/**
 * Nutrition for one day at the given level. At `off` nothing is read and `undefined` is returned, so the key is
 * absent from the response. Photo links are signed only at `meals`.
 */
export async function nutritionOn(owner: ProfileItem, level: NutritionLevel, date: string, workouts: readonly EntryItem[], deps: Deps) {
  if (level === "off") return undefined;
  const entries = await deps.food.listEntriesForDay(owner.userId, date);
  const withUrls =
    level === "meals"
      ? await Promise.all(entries.map(async (e) => (e.photo && e.photoKey ? { ...e, photo: { ...e.photo, url: await deps.photos.urlFor(e.photoKey) } } : e)))
      : entries;
  const view = buildFoodDay({
    date,
    today: localDate(deps.now(), owner.timezone),
    timezone: owner.timezone,
    target: owner.dailyCalorieTarget,
    proteinTarget: owner.dailyProteinTarget ?? null,
    burnedCalories: workouts.reduce((t, w) => t + w.calories, 0),
    entries: withUrls,
  });
  return nutritionFor(level, view, workouts.some((w) => w.aiNote !== undefined));
}

/** A strict-parsed card for `date`, or null when it was not a workout day. `workouts` are that member's entries (any days). */
export async function dayCard(args: {
  owner: ProfileItem;
  viewerId: string;
  level: NutritionLevel;
  date: string;
  workouts: readonly EntryItem[];
  stats: SquadStats | null;
  hi5: HighFives;
  withSets: boolean;
  deps: Deps;
}): Promise<(DayCard & { updatedAt: string }) | null> {
  const { owner, viewerId, date, hi5 } = args;
  const day = args.workouts.filter((w) => w.date === date);
  const card = buildDayCard(date, day, prsOf(args.stats), { withSets: args.withSets });
  if (!card) return null;
  const { updatedAt, ...shown } = card;
  const id = feedId(owner.userId, dayEventId(date));
  const nutrition = await nutritionOn(owner, args.level, date, day, args.deps);
  const parsed = DayCardSchema.parse({
    ...shown,
    id,
    highFives: hi5.byEvent.get(dayEventId(date))?.hi5Count ?? 0,
    highFivedByMe: hi5.mine.has(id),
    canHighFive: owner.userId !== viewerId,
    ...(nutrition ? { nutrition } : {}),
  });
  return { ...parsed, updatedAt };
}
