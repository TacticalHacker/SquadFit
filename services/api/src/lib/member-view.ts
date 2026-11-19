import {
  DayCardSchema,
  buildDayCard,
  buildFoodDay,
  isStepGoalHit,
  localDate,
  nutritionFor,
  type DayCard,
  type NutritionLevel,
  type PrDay,
  type SquadStats,
} from "@calci/shared";
import type { Deps } from "./deps";
import { stepsVisibleTo } from "./member-access";
import { stepSettingsOf, type ProfileItem } from "./profile-repo";
import { feedId, reactionKey, type FeedItem, type ReactionCounts } from "./squad-repo";
import type { EntryItem } from "./workout-repo";

/** Feature 011: builds day cards for one member. Never log entries, sets, meals or photo keys. */

export const dayEventId = (date: string) => `day#${date}`;

export const prsOf = (stats: SquadStats | null): Record<string, readonly PrDay[]> =>
  Object.fromEntries(Object.entries(stats?.lifts ?? {}).map(([id, l]) => [id, l.prDays]));

/** The member's own `FEED#` items by event id, plus the viewer's reactions on them (feature 013). */
export async function loadReactions(ownerId: string, viewerId: string, deps: Deps) {
  const items = await deps.squad.listMemberFeed(ownerId);
  const mine = await deps.squad.myReactions(viewerId, items.map((f) => ({ userId: ownerId, eventId: f.eventId })));
  return { byEvent: new Map<string, FeedItem>(items.map((f) => [f.eventId, f])), mine };
}
export type LoadedReactions = Awaited<ReturnType<typeof loadReactions>>;

/** The response shape of one item's reactions (`ReactionsSchema`). */
export function reactionsView(counts: ReactionCounts | undefined, mine: ReadonlySet<string>, ownerId: string, eventId: string) {
  const one = (type: "fire" | "muscle" | "crown") => ({ count: counts?.[type] ?? 0, mine: mine.has(reactionKey(ownerId, eventId, type)) });
  return { fire: one("fire"), muscle: one("muscle"), crown: one("crown") };
}

/**
 * Nutrition for one day at the given level. At `off` nothing is read and `undefined` is returned, so the key is
 * absent from the response. Photo links are signed only at `meals`.
 */
export async function nutritionOn(owner: ProfileItem, viewerId: string, level: NutritionLevel, date: string, workouts: readonly EntryItem[], deps: Deps) {
  if (level === "off") return undefined;
  // Feature 013: targets the owner never confirmed are never shown to anyone else.
  const showTargets = owner.userId === viewerId || owner.targetsConfirmedAt !== undefined;
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
  const shared = nutritionFor(level, view, workouts.some((w) => w.aiNote !== undefined));
  return showTargets ? shared : { ...shared, calorieTarget: null, proteinTarget: null };
}

export type StepsByDay = ReadonlyMap<string, { steps: number; goalHit: boolean }>;

/**
 * Feature 012: a member's synced steps in [from, to] as the viewer may see them, through the one steps gate
 * (`stepsVisibleTo`). Empty when the owner does not share steps, so no caller can leak them by accident.
 */
export async function stepsFor(owner: ProfileItem, viewerId: string, from: string, to: string, deps: Deps): Promise<StepsByDay> {
  if (!stepsVisibleTo(owner, viewerId)) return new Map();
  const goal = stepSettingsOf(owner).dailyStepGoal;
  const days = await deps.activity.listRange(owner.userId, from, to);
  return new Map(days.map((d) => [d.date, { steps: d.steps, goalHit: isStepGoalHit(d.steps, goal) }]));
}

/** A strict-parsed card for `date`, or null when it was not a workout day. `workouts` are that member's entries (any days). */
export async function dayCard(args: {
  owner: ProfileItem;
  viewerId: string;
  level: NutritionLevel;
  date: string;
  workouts: readonly EntryItem[];
  stats: SquadStats | null;
  rx: LoadedReactions;
  withSets: boolean;
  /** Feature 012: from `stepsFor`; absent or missing the date = no steps line. */
  steps?: StepsByDay;
  deps: Deps;
}): Promise<(DayCard & { updatedAt: string }) | null> {
  const { owner, viewerId, date, rx } = args;
  const day = args.workouts.filter((w) => w.date === date);
  const card = buildDayCard(date, day, prsOf(args.stats), { withSets: args.withSets });
  if (!card) return null;
  const { updatedAt, ...shown } = card;
  const id = feedId(owner.userId, dayEventId(date));
  const nutrition = await nutritionOn(owner, viewerId, args.level, date, day, args.deps);
  const parsed = DayCardSchema.parse({
    ...shown,
    id,
    reactions: reactionsView(rx.byEvent.get(dayEventId(date))?.reactions, rx.mine, owner.userId, dayEventId(date)),
    canReact: owner.userId !== viewerId,
    ...(nutrition ? { nutrition } : {}),
    ...(args.steps?.get(date) ? { steps: args.steps.get(date) } : {}),
  });
  return { ...parsed, updatedAt };
}
