import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { exerciseNameKey, notificationTtl, type CatalogExercise, type ReactionRecord, type StoredNotification } from "@calci/shared";
import type { ActivitySource, ActivityValues, GymLastIndex, OverallNoteInput, ProfileInput, ReactionType, SquadSettingsInput, SquadStats, StepSettings } from "@calci/shared";
import { toActivityItem, type ActivityItem, type ActivityRepo } from "../src/lib/activity-repo";
import type { WeightItem, WeightRepo } from "../src/lib/weight-repo";
import type { HealthTokenRepo } from "../src/lib/health-token-repo";
import type { UserDirectory } from "../src/lib/user-directory";
import type { CatalogPatch, CatalogRepo, CatalogUpdateResult } from "../src/lib/catalog-repo";
import type { AvatarStore } from "../src/lib/avatar-store";
import { newCoachItem, toCoachNote, type CoachNoteItem, type CoachRepo, type TickResult } from "../src/lib/coach-repo";
import type { CredentialRepo } from "../src/lib/credential-repo";
import { photoKey, type PhotoContentType, type PhotoStore } from "../src/lib/photo-store";
import { sharePhotoKey, type SharePhotoStore } from "../src/lib/share-photo-store";
import type { Deps } from "../src/lib/deps";
import type { FoodEntryItem, FoodRepo, OwnFoodItem, EntryUpdate } from "../src/lib/food-repo";
import type { CustomWorkoutItem, EntryItem, WorkoutRepo } from "../src/lib/workout-repo";
import type { GymEntryItem, GymRepo, MergeTarget, OwnExerciseItem } from "../src/lib/gym-repo";
import { ProfileMissingError, type ProfileItem, type ProfileRepo } from "../src/lib/profile-repo";
import type { WaitlistEntry, WaitlistRepo } from "../src/lib/waitlist-repo";
import { feedId, reactionKey, type FeedItem, type FeedKey, type ReactionCounts, type SquadRepo } from "../src/lib/squad-repo";
import type { RaidContribution, RaidPatch, RaidRepo, RaidSticker } from "../src/lib/raid-repo";
import type { Raid } from "@calci/shared";

export class InMemoryProfileRepo implements ProfileRepo {
  readonly items = new Map<string, ProfileItem>();

  async get(userId: string) {
    return this.items.get(userId) ?? null;
  }

  async upsert(userId: string, username: string, input: ProfileInput, nowIso: string) {
    const existing = this.items.get(userId);
    const item: ProfileItem = {
      ...(existing?.avatarKey ? { avatarKey: existing.avatarKey } : {}),
      ...(existing?.weeklyTarget !== undefined ? { weeklyTarget: existing.weeklyTarget } : {}),
      ...(existing?.leaderboardVisible !== undefined ? { leaderboardVisible: existing.leaderboardVisible } : {}),
      ...(existing?.shareBodyWeight !== undefined ? { shareBodyWeight: existing.shareBodyWeight } : {}),
      ...(existing?.nutritionSharing !== undefined ? { nutritionSharing: existing.nutritionSharing } : {}),
      ...(existing?.nutritionPromptSeen !== undefined ? { nutritionPromptSeen: existing.nutritionPromptSeen } : {}),
      ...(existing?.dailyStepGoal !== undefined ? { dailyStepGoal: existing.dailyStepGoal } : {}),
      ...(existing?.shareSteps !== undefined ? { shareSteps: existing.shareSteps } : {}),
      ...(existing?.targetsPromptDismissed !== undefined ? { targetsPromptDismissed: existing.targetsPromptDismissed } : {}),
      targetsConfirmedAt: nowIso,
      userId,
      username,
      displayName: input.displayName,
      timezone: input.timezone,
      dailyCalorieTarget: input.dailyCalorieTarget,
      ...(input.dailyProteinTarget != null ? { dailyProteinTarget: input.dailyProteinTarget } : {}),
      ...(input.bodyWeightKg === undefined
        ? existing?.bodyWeightKg !== undefined ? { bodyWeightKg: existing.bodyWeightKg } : {}
        : input.bodyWeightKg !== null ? { bodyWeightKg: input.bodyWeightKg } : {}),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    this.items.set(userId, item);
    return item;
  }

  async setTargets(userId: string, targets: { dailyCalorieTarget?: number; dailyProteinTarget?: number | null }, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) return null;
    const { dailyProteinTarget: _drop, ...rest } = existing;
    const protein = targets.dailyProteinTarget === undefined ? existing.dailyProteinTarget : (targets.dailyProteinTarget ?? undefined);
    const next: ProfileItem = {
      ...rest,
      ...(targets.dailyCalorieTarget !== undefined ? { dailyCalorieTarget: targets.dailyCalorieTarget } : {}),
      ...(protein !== undefined ? { dailyProteinTarget: protein } : {}),
      targetsConfirmedAt: nowIso,
      updatedAt: nowIso,
    };
    this.items.set(userId, next);
    return next;
  }

  async dismissTargetsPrompt(userId: string, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) return null;
    const next = { ...existing, targetsPromptDismissed: true, updatedAt: nowIso };
    this.items.set(userId, next);
    return next;
  }

  async setSquadSettings(userId: string, settings: SquadSettingsInput, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) return null;
    const { dismissPrompt, nutritionSharing, ...rest } = settings;
    const next: ProfileItem = {
      ...existing,
      ...rest,
      ...(nutritionSharing ? { nutritionSharing } : {}),
      ...(nutritionSharing || dismissPrompt ? { nutritionPromptSeen: true } : {}),
      updatedAt: nowIso,
    };
    this.items.set(userId, next);
    return next;
  }

  async setStepSettings(userId: string, settings: StepSettings, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) return null;
    const next: ProfileItem = { ...existing, ...settings, updatedAt: nowIso };
    this.items.set(userId, next);
    return next;
  }

  async setBodyWeight(userId: string, kg: number, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) return null;
    const next: ProfileItem = { ...existing, bodyWeightKg: kg, updatedAt: nowIso };
    this.items.set(userId, next);
    return next;
  }

  async setAvatarKey(userId: string, key: string | null, nowIso: string) {
    const existing = this.items.get(userId);
    if (!existing) throw new ProfileMissingError();
    const { avatarKey: previous, ...rest } = existing;
    this.items.set(userId, { ...rest, ...(key ? { avatarKey: key } : {}), updatedAt: nowIso });
    return previous ?? null;
  }

  async listCommunity() {
    return [...this.items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemoryWorkoutRepo implements WorkoutRepo {
  /** key = `${userId}|${sk}` so ordering by sk mirrors DynamoDB. */
  readonly entries = new Map<string, EntryItem>();
  readonly gymLast = new Map<string, GymLastIndex>();

  async getGymLastIndex(userId: string) {
    return this.gymLast.get(userId) ?? null;
  }
  async putGymLastIndex(userId: string, index: GymLastIndex) {
    this.gymLast.set(userId, structuredClone(index));
  }
  readonly customs = new Map<string, CustomWorkoutItem>();

  private k = (userId: string, id: string) => `${userId}|${id}`;
  private entryKey = (u: string, d: string, w: string) => this.k(u, `ENTRY#${d}#${w}`);

  async listEntriesForDay(userId: string, date: string) {
    return this.listEntriesInRange(userId, date, date);
  }
  async listEntriesInRange(userId: string, from: string, to: string) {
    return [...this.entries.entries()]
      .filter(([key, e]) => key.startsWith(`${userId}|`) && e.date >= from && e.date <= to)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, e]) => e);
  }
  async getEntry(userId: string, date: string, workoutId: string) {
    return this.entries.get(this.entryKey(userId, date, workoutId)) ?? null;
  }
  async putEntryIfAbsent(userId: string, entry: EntryItem) {
    const key = this.entryKey(userId, entry.date, entry.workoutId);
    if (this.entries.has(key)) return false;
    this.entries.set(key, entry);
    return true;
  }
  async updateEntryMinutes(userId: string, date: string, workoutId: string, minutes: number, calories: number, nowIso: string) {
    const key = this.entryKey(userId, date, workoutId);
    const e = this.entries.get(key);
    if (!e) return false;
    const { aiNote: _cleared, ...rest } = e;
    this.entries.set(key, { ...rest, minutes, calories, updatedAt: nowIso });
    return true;
  }
  /** Test hook: runs between the agent's read and its conditional write (simulates a concurrent member edit). */
  beforeAiWrite: (() => Promise<void>) | null = null;
  async setAiAdjustment(
    userId: string,
    date: string,
    workoutId: string,
    fields: { minutes: number; calories: number; aiNote: string },
    expectedUpdatedAt: string,
    nowIso: string,
  ) {
    if (this.beforeAiWrite) await this.beforeAiWrite();
    const key = this.entryKey(userId, date, workoutId);
    const e = this.entries.get(key);
    if (!e) return "missing" as const;
    if (e.updatedAt !== expectedUpdatedAt) return "conflict" as const;
    this.entries.set(key, { ...e, ...fields, updatedAt: nowIso });
    return "ok" as const;
  }
  async confirmJump(userId: string, date: string, workoutId: string, expectedUpdatedAt: string, nowIso: string) {
    const key = this.entryKey(userId, date, workoutId);
    const e = this.entries.get(key);
    if (!e) return "missing" as const;
    if (e.updatedAt !== expectedUpdatedAt) return "conflict" as const;
    this.entries.set(key, { ...e, jumpConfirmedAt: nowIso });
    return "ok" as const;
  }
  async deleteEntry(userId: string, date: string, workoutId: string) {
    this.entries.delete(this.entryKey(userId, date, workoutId));
  }
  async listCustomWorkouts(userId: string) {
    return [...this.customs.entries()]
      .filter(([key, w]) => key.startsWith(`${userId}|`) && !w.removedAt)
      .map(([, w]) => w);
  }
  async getCustomWorkout(userId: string, workoutId: string) {
    return this.customs.get(this.k(userId, workoutId)) ?? null;
  }
  async putCustomWorkout(userId: string, item: CustomWorkoutItem) {
    this.customs.set(this.k(userId, item.workoutId), item);
  }
  async updateCustomWorkout(userId: string, workoutId: string, fields: { name: string; defaultMinutes: number; defaultCalories: number }, nowIso: string) {
    const w = this.customs.get(this.k(userId, workoutId));
    if (!w || w.removedAt) return false;
    this.customs.set(this.k(userId, workoutId), { ...w, ...fields, updatedAt: nowIso });
    return true;
  }
  async markCustomRemoved(userId: string, workoutId: string, nowIso: string) {
    const w = this.customs.get(this.k(userId, workoutId));
    if (!w) return false;
    this.customs.set(this.k(userId, workoutId), { ...w, removedAt: w.removedAt ?? nowIso, updatedAt: nowIso });
    return true;
  }
}

/** Gym repo over the workout fake's entry map, so day/range reads see gym entries like DynamoDB does. */
export class InMemoryGymRepo implements GymRepo {
  readonly exercises = new Map<string, OwnExerciseItem>();
  /** Counts `lastBefore` calls (save responses must not fan out, SC-006). */
  lastQueries = 0;

  constructor(private readonly workouts: InMemoryWorkoutRepo) {}

  private key = (u: string, d: string, id: string) => `${u}|ENTRY#${d}#${id}`;

  async getGymEntry(userId: string, date: string, exerciseId: string) {
    return this.workouts.entries.get(this.key(userId, date, exerciseId)) ?? null;
  }
  async putGymEntry(userId: string, entry: GymEntryItem) {
    this.workouts.entries.set(this.key(userId, entry.date, entry.workoutId), entry);
  }
  async deleteGymEntry(userId: string, date: string, exerciseId: string) {
    this.workouts.entries.delete(this.key(userId, date, exerciseId));
  }
  async lastBefore(userId: string, exerciseId: string, date: string) {
    this.lastQueries++;
    const hits = [...this.workouts.entries.entries()]
      .filter(([k, e]) => k.startsWith(`${userId}|`) && e.kind === "gym" && e.workoutId === exerciseId && e.date < date)
      .map(([, e]) => e)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return hits[0] ?? null;
  }
  async listOwnExercises(userId: string) {
    return [...this.exercises.entries()].filter(([k, e]) => k.startsWith(`${userId}|`) && !e.removedAt).map(([, e]) => e);
  }
  async getOwnExercise(userId: string, exerciseId: string) {
    return this.exercises.get(`${userId}|${exerciseId}`) ?? null;
  }
  async putOwnExercise(userId: string, item: OwnExerciseItem) {
    this.exercises.set(`${userId}|${item.exerciseId}`, item);
  }
  async updateOwnExercise(userId: string, exerciseId: string, fields: { name: string; group: OwnExerciseItem["group"] }, nowIso: string) {
    const e = this.exercises.get(`${userId}|${exerciseId}`);
    if (!e || e.removedAt) return false;
    this.exercises.set(`${userId}|${exerciseId}`, { ...e, ...fields, updatedAt: nowIso });
    return true;
  }
  async markOwnRemoved(userId: string, exerciseId: string, nowIso: string) {
    const e = this.exercises.get(`${userId}|${exerciseId}`);
    if (!e) return false;
    this.exercises.set(`${userId}|${exerciseId}`, { ...e, removedAt: e.removedAt ?? nowIso, updatedAt: nowIso });
    return true;
  }
  async listEntriesByExercise(userId: string, exerciseId: string) {
    return [...this.workouts.entries.entries()]
      .filter(([k, e]) => k.startsWith(`${userId}|`) && e.kind === "gym" && e.workoutId === exerciseId)
      .map(([, e]) => e);
  }
  async moveEntry(userId: string, date: string, sourceId: string, target: MergeTarget) {
    const from = this.key(userId, date, sourceId);
    const to = this.key(userId, date, target.id);
    const e = this.workouts.entries.get(from);
    if (!e || this.workouts.entries.has(to)) return "conflict" as const;
    this.workouts.entries.delete(from);
    this.workouts.entries.set(to, { ...e, workoutId: target.id, name: target.name, muscleGroup: target.group });
    return "moved" as const;
  }
  async markOwnExerciseMerged(userId: string, sourceId: string, _targetId: string, nowIso: string) {
    const e = this.exercises.get(`${userId}|${sourceId}`);
    if (e) this.exercises.set(`${userId}|${sourceId}`, { ...e, removedAt: e.removedAt ?? nowIso });
  }
}

/** Mirrors the DynamoDB update: caption/photoStatus live on `photo`. */
function applyFields(e: FoodEntryItem, fields: EntryUpdate, nowIso: string): FoodEntryItem {
  const { caption, photoStatus, ...rest } = fields;
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const photo = e.photo
    ? { ...e.photo, ...(caption !== undefined ? { caption } : {}), ...(photoStatus !== undefined ? { status: photoStatus } : {}) }
    : undefined;
  return { ...e, ...defined, ...(photo ? { photo } : {}), updatedAt: nowIso };
}

export class InMemoryFoodRepo implements FoodRepo {
  readonly entries = new Map<string, FoodEntryItem>();
  readonly foods = new Map<string, OwnFoodItem>();

  private k = (userId: string, id: string) => `${userId}|${id}`;
  private entryKey = (u: string, d: string, id: string) => this.k(u, `FOODLOG#${d}#${id}`);

  async listEntriesForDay(userId: string, date: string) {
    return this.listEntriesInRange(userId, date, date);
  }
  async listEntriesInRange(userId: string, from: string, to: string) {
    return [...this.entries.entries()]
      .filter(([key, e]) => key.startsWith(`${userId}|`) && e.date >= from && e.date <= to)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, e]) => e);
  }
  async getEntry(userId: string, date: string, entryId: string) {
    return this.entries.get(this.entryKey(userId, date, entryId)) ?? null;
  }
  async putEntry(userId: string, entry: FoodEntryItem) {
    const key = this.entryKey(userId, entry.date, entry.entryId);
    if (this.entries.has(key)) return false;
    this.entries.set(key, entry);
    return true;
  }
  async updateEntry(userId: string, date: string, entryId: string, fields: EntryUpdate, nowIso: string) {
    const key = this.entryKey(userId, date, entryId);
    const e = this.entries.get(key);
    if (!e) return false;
    this.entries.set(key, applyFields(e, fields, nowIso));
    return true;
  }
  async updateEntryIf(userId: string, date: string, entryId: string, fields: EntryUpdate, nowIso: string, allowed: readonly string[]) {
    const e = this.entries.get(this.entryKey(userId, date, entryId));
    if (!e?.photo || !allowed.includes(e.photo.status)) return false;
    return this.updateEntry(userId, date, entryId, fields, nowIso);
  }
  async deleteEntry(userId: string, date: string, entryId: string) {
    this.entries.delete(this.entryKey(userId, date, entryId));
  }
  async listOwnFoods(userId: string) {
    return [...this.foods.entries()].filter(([key]) => key.startsWith(`${userId}|`)).map(([, f]) => f);
  }
  async getOwnFood(userId: string, foodId: string) {
    return this.foods.get(this.k(userId, foodId)) ?? null;
  }
  async putOwnFood(userId: string, item: OwnFoodItem) {
    this.foods.set(this.k(userId, item.foodId), item);
  }
  async updateOwnFood(userId: string, foodId: string, fields: { name: string; serving: string; calories: number; macros: OwnFoodItem["macros"] }, nowIso: string) {
    const f = this.foods.get(this.k(userId, foodId));
    if (!f) return false;
    this.foods.set(this.k(userId, foodId), { ...f, ...fields, updatedAt: nowIso });
    return true;
  }
  async deleteOwnFood(userId: string, foodId: string) {
    return this.foods.delete(this.k(userId, foodId));
  }
}

export class InMemoryCoachRepo implements CoachRepo {
  /** Raw stored items, so legacy (feature 004) markdown notes can be seeded too. */
  readonly notes = new Map<string, Record<string, unknown>>();
  async get(userId: string, date: string) {
    return toCoachNote(this.notes.get(`${userId}|${date}`));
  }
  async listInRange(userId: string, from: string, to: string) {
    return [...this.notes.entries()]
      .filter(([k]) => k.startsWith(`${userId}|`))
      .map(([, v]) => toCoachNote(v))
      .filter((n): n is CoachNoteItem => n !== null && n.date >= from && n.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async put(userId: string, note: OverallNoteInput, nowIso: string) {
    this.notes.set(`${userId}|${note.date}`, structuredClone(newCoachItem(note, nowIso)));
  }
  async setActionDone(userId: string, date: string, index: number, done: boolean, expectedUpdatedAt: string): Promise<TickResult> {
    const raw = this.notes.get(`${userId}|${date}`);
    const note = toCoachNote(raw);
    if (!note) return "missing";
    if (note.updatedAt !== expectedUpdatedAt || index >= note.actions.length) return "conflict";
    (raw!.actions as { done: boolean }[])[index]!.done = done;
    return "ok";
  }
  /** A feature 004 markdown note, which v2 readers must ignore. */
  seedLegacy(userId: string, date: string) {
    this.notes.set(`${userId}|${date}`, { date, summaryMarkdown: "old", recommendations: ["a"], generatedBy: "AI", createdAt: "t", updatedAt: "t" });
  }
}

export class InMemoryCredentialRepo implements CredentialRepo {
  readonly byHash = new Map<string, string>();
  readonly byUser = new Map<string, { tokenHash: string; createdAt: string }>();
  readonly counts = new Map<string, number>();
  async findUserId(hash: string) {
    return this.byHash.get(hash) ?? null;
  }
  async get(userId: string) {
    return this.byUser.get(userId) ?? null;
  }
  async issue(userId: string, hash: string, nowIso: string) {
    const prev = this.byUser.get(userId);
    if (prev) this.byHash.delete(prev.tokenHash);
    this.byHash.set(hash, userId);
    this.byUser.set(userId, { tokenHash: hash, createdAt: nowIso });
  }
  async revoke(userId: string) {
    const prev = this.byUser.get(userId);
    if (!prev) return false;
    this.byHash.delete(prev.tokenHash);
    this.byUser.delete(userId);
    return true;
  }
  async hit(userId: string, nowMs: number) {
    const k = `${userId}#${Math.floor(nowMs / 60_000)}`;
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
}

export class InMemoryWaitlistRepo implements WaitlistRepo {
  readonly entries: WaitlistEntry[] = [];
  readonly counts = new Map<string, number>();
  async add(entry: Omit<WaitlistEntry, "createdAt">, nowIso: string) {
    if (this.entries.some((e) => e.email === entry.email)) return "exists" as const;
    this.entries.push({ ...entry, createdAt: nowIso });
    return "created" as const;
  }
  async hit(key: string, hour: number) {
    const k = `${key}#${hour}`;
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
  async list() {
    return [...this.entries].reverse();
  }
}

export class FakePhotoStore implements PhotoStore {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: PhotoContentType }>();
  /** Set to make the next `put` fail (cleanup tests). */
  failNextPut = false;
  async put(userId: string, entryId: string, bytes: Uint8Array, contentType: PhotoContentType) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("s3 down");
    }
    const key = photoKey(userId, entryId, contentType);
    this.objects.set(key, { bytes, contentType });
    return key;
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async urlFor(key: string) {
    return `https://fake.s3/${key}?sig=1`;
  }
}

export class FakeSharePhotoStore implements SharePhotoStore {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: PhotoContentType }>();
  async put(userId: string, date: string, bytes: Uint8Array, contentType: PhotoContentType) {
    const key = sharePhotoKey(userId, date, contentType);
    this.objects.set(key, { bytes, contentType });
    return key;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async urlFor(key: string) {
    return `https://fake.s3/${key}?sig=1`;
  }
}

export class FakeAvatarStore implements AvatarStore {
  readonly objects = new Map<string, Uint8Array>();
  private n = 0;

  async put(userId: string, bytes: Uint8Array) {
    const key = `avatars/${userId}/${++this.n}.webp`;
    this.objects.set(key, bytes);
    return key;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async urlFor(key: string) {
    return `https://fake.s3/${key}?sig=1`;
  }
}

export class InMemorySquadRepo implements SquadRepo {
  readonly stats = new Map<string, SquadStats>();
  readonly feed = new Map<string, FeedItem>();
  /** `${author}~${eventId}~${type}~${reactor}` */
  readonly reactions = new Set<string>();
  /** Feature 022: reaction times, same keys as `reactions`. */
  readonly reactedAt = new Map<string, string>();
  /** Feature 022: `${owner}~${eventId}~${reactor}` → notification. */
  readonly notifications = new Map<string, StoredNotification & { ownerId: string }>();
  readonly seen = new Map<string, string>();
  /** Test hook: make the next `putStats` fail (the service must swallow it). */
  failNextPut = false;

  async getStats(userId: string) {
    return structuredClone(this.stats.get(userId) ?? null);
  }
  async putStats(userId: string, stats: SquadStats, expectedVersion: number | null) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("boom");
    }
    const current = this.stats.get(userId);
    if ((current?.version ?? null) !== expectedVersion) return "conflict" as const;
    this.stats.set(userId, structuredClone({ ...stats, version: (expectedVersion ?? 0) + 1 }));
    return "ok" as const;
  }
  async batchGetStats(userIds: readonly string[]) {
    return new Map(userIds.flatMap((u) => (this.stats.has(u) ? [[u, structuredClone(this.stats.get(u)!)] as const] : [])));
  }
  async listMemberFeed(userId: string) {
    return [...this.feed.values()].filter((f) => f.userId === userId).map((f) => structuredClone(f));
  }
  async getFeed(userId: string, eventId: string) {
    return structuredClone(this.feed.get(feedId(userId, eventId)) ?? null);
  }
  async putFeed(item: FeedItem, opts: { ifAbsent?: boolean } = {}) {
    if (opts.ifAbsent && this.feed.has(feedId(item.userId, item.eventId))) return;
    this.feed.set(feedId(item.userId, item.eventId), structuredClone(item));
  }
  async postDay(userId: string, squadId: string, date: string, nowIso: string, photoKey: string | null | "keep") {
    const id = feedId(userId, `day#${date}`);
    const have = this.feed.get(id);
    const base: FeedItem = have ?? { userId, squadId, eventId: `day#${date}`, kind: "workout_day", eventDate: date, payload: {}, reactions: { fire: 0, muscle: 0, crown: 0 }, createdAt: nowIso };
    const { listed: _l, photoKey: oldPhoto, ...rest } = base;
    const photo = photoKey === "keep" ? oldPhoto : (photoKey ?? undefined);
    const next: FeedItem = { ...rest, postedAt: base.postedAt ?? nowIso, ...(photo ? { photoKey: photo } : {}) };
    this.feed.set(id, next);
    return structuredClone(next);
  }
  async unpostDay(userId: string, date: string) {
    const id = feedId(userId, `day#${date}`);
    const have = this.feed.get(id);
    if (!have) return null;
    const { postedAt: _p, photoKey: _k, ...rest } = have;
    this.feed.set(id, { ...rest, listed: false });
    return structuredClone(have);
  }
  async updateFeed(userId: string, eventId: string, eventDate: string, payload: Record<string, unknown>) {
    const f = this.feed.get(feedId(userId, eventId));
    if (f) this.feed.set(feedId(userId, eventId), { ...f, eventDate, payload });
  }
  async deleteFeed(userId: string, eventId: string) {
    this.feed.delete(feedId(userId, eventId));
    for (const r of [...this.reactions]) if (r.startsWith(`${feedId(userId, eventId)}~`)) this.reactions.delete(r);
    for (const k of [...this.notifications.keys()]) if (k.startsWith(`${feedId(userId, eventId)}~`)) this.notifications.delete(k);
  }
  async listSquadFeed(squadId: string, pageSize: number, startKey?: Record<string, unknown>) {
    const all = [...this.feed.values()]
      .filter((f) => f.squadId === squadId && f.listed !== false)
      .sort((a, b) => `${b.postedAt ?? b.createdAt}#${b.userId}#${b.eventId}`.localeCompare(`${a.postedAt ?? a.createdAt}#${a.userId}#${a.eventId}`));
    const from = typeof startKey?.offset === "number" ? startKey.offset : 0;
    const items = all.slice(from, from + pageSize).map((f) => structuredClone(f));
    return { items, ...(from + pageSize < all.length ? { lastKey: { offset: from + pageSize } } : {}) };
  }
  private bump(author: FeedKey, type: ReactionType, by: number) {
    const f = this.feed.get(feedId(author.userId, author.eventId))!;
    this.feed.set(feedId(author.userId, author.eventId), { ...f, reactions: { ...f.reactions, [type]: Math.max(0, f.reactions[type] + by) } });
  }
  async addReaction(author: FeedKey, type: ReactionType, reactorId: string, nowIso = new Date().toISOString()): Promise<ReactionCounts | null> {
    if (!this.feed.has(feedId(author.userId, author.eventId))) return null;
    const key = `${feedId(author.userId, author.eventId)}~${type}~${reactorId}`;
    if (!this.reactions.has(key)) {
      this.reactions.add(key);
      this.reactedAt.set(key, nowIso);
      this.bump(author, type, 1);
    }
    return structuredClone(this.feed.get(feedId(author.userId, author.eventId))!.reactions);
  }
  async removeReaction(author: FeedKey, type: ReactionType, reactorId: string): Promise<ReactionCounts | null> {
    if (!this.feed.has(feedId(author.userId, author.eventId))) return null;
    if (this.reactions.delete(`${feedId(author.userId, author.eventId)}~${type}~${reactorId}`)) this.bump(author, type, -1);
    return structuredClone(this.feed.get(feedId(author.userId, author.eventId))!.reactions);
  }
  async myReactions(viewerId: string, items: readonly FeedKey[]) {
    const out = new Set<string>();
    for (const k of items) for (const type of ["fire", "muscle", "crown"] as const) {
      if (this.reactions.has(`${feedId(k.userId, k.eventId)}~${type}~${viewerId}`)) out.add(reactionKey(k.userId, k.eventId, type));
    }
    return out;
  }
  async listReactors(author: FeedKey): Promise<ReactionRecord[]> {
    const prefix = `${feedId(author.userId, author.eventId)}~`;
    return [...this.reactions]
      .filter((r) => r.startsWith(prefix))
      .map((r) => {
        const [type, reactorId] = r.slice(prefix.length).split("~") as [ReactionType, string];
        return { type, reactorId, createdAt: this.reactedAt.get(r) ?? "" };
      });
  }
  async batchGetFeed(keys: readonly FeedKey[]) {
    return keys.flatMap((k) => (this.feed.has(feedId(k.userId, k.eventId)) ? [structuredClone(this.feed.get(feedId(k.userId, k.eventId))!)] : []));
  }
  async notify(owner: FeedKey, reactorId: string, type: ReactionType, nowIso: string) {
    const key = `${feedId(owner.userId, owner.eventId)}~${reactorId}`;
    const have = this.notifications.get(key);
    const types = [...new Set([...(have?.types ?? []), type])];
    this.notifications.set(key, { ownerId: owner.userId, eventId: owner.eventId, reactorId, types, latestAt: nowIso, ttl: notificationTtl(nowIso) });
  }
  async unnotify(owner: FeedKey, reactorId: string, type: ReactionType) {
    const key = `${feedId(owner.userId, owner.eventId)}~${reactorId}`;
    const have = this.notifications.get(key);
    if (!have) return;
    const types = have.types.filter((t) => t !== type);
    if (types.length) this.notifications.set(key, { ...have, types });
    else this.notifications.delete(key);
  }
  async listNotifications(ownerId: string) {
    const items = [...this.notifications.values()].filter((n) => n.ownerId === ownerId).map(({ ownerId: _o, ...n }) => structuredClone(n));
    return { items, seenAt: this.seen.get(ownerId) ?? null };
  }
  async markNotificationsSeen(ownerId: string, upTo: string) {
    const have = this.seen.get(ownerId);
    if (!have || have < upTo) this.seen.set(ownerId, upTo);
  }
  settings = new Map<string, { timezone: string }>();
  async getSquadSettings(squadId: string) {
    return this.settings.get(squadId) ?? { timezone: "Asia/Kolkata" };
  }
  async putSquadSettings(squadId: string, settings: { timezone: string }) {
    this.settings.set(squadId, settings);
  }
}

export class InMemoryActivityRepo implements ActivityRepo {
  readonly items = new Map<string, ActivityItem>();
  async putDays(userId: string, days: readonly ActivityValues[], source: ActivitySource, nowIso: string) {
    const out = days.map((d) => toActivityItem(userId, d, source, nowIso));
    for (const i of out) this.items.set(`${userId}#${i.date}`, i);
    return out;
  }
  async listRange(userId: string, from: string, to: string) {
    return [...this.items.values()].filter((i) => i.userId === userId && i.date >= from && i.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Feature 014: sorted like the table (date, then id), scoped to the owner's partition. */
export class InMemoryWeightRepo implements WeightRepo {
  readonly items = new Map<string, WeightItem>();
  private mine(userId: string) {
    return [...this.items.values()].filter((i) => i.userId === userId).sort((a, b) => (a.date === b.date ? a.entryId.localeCompare(b.entryId) : a.date.localeCompare(b.date)));
  }
  async create(item: WeightItem) {
    this.items.set(`${item.userId}#${item.date}#${item.entryId}`, item);
  }
  async delete(userId: string, date: string, entryId: string) {
    this.items.delete(`${userId}#${date}#${entryId}`);
  }
  async listRange(userId: string, from: string, to: string) {
    return this.mine(userId).filter((i) => i.date >= from && i.date <= to);
  }
  async latest(userId: string) {
    return this.mine(userId).at(-1) ?? null;
  }
  async countDay(userId: string, date: string) {
    return this.mine(userId).filter((i) => i.date === date).length;
  }
}

export class InMemoryHealthTokenRepo implements HealthTokenRepo {
  readonly byHash = new Map<string, string>();
  readonly byUser = new Map<string, { tokenHash: string; createdAt: string; lastUsedAt: string | null }>();
  readonly counts = new Map<string, number>();
  async findUserId(hash: string) {
    return this.byHash.get(hash) ?? null;
  }
  async get(userId: string) {
    return this.byUser.get(userId) ?? null;
  }
  async issue(userId: string, hash: string, nowIso: string) {
    const prev = this.byUser.get(userId);
    if (prev) this.byHash.delete(prev.tokenHash);
    this.byHash.set(hash, userId);
    this.byUser.set(userId, { tokenHash: hash, createdAt: nowIso, lastUsedAt: null });
  }
  async revoke(userId: string) {
    const prev = this.byUser.get(userId);
    if (prev) this.byHash.delete(prev.tokenHash);
    this.byUser.delete(userId);
  }
  async touch(userId: string, nowIso: string) {
    const prev = this.byUser.get(userId);
    if (prev) this.byUser.set(userId, { ...prev, lastUsedAt: nowIso });
  }
  async hit(userId: string, nowMs: number) {
    const k = `${userId}#${Math.floor(nowMs / 3_600_000)}`;
    const n = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, n);
    return n;
  }
}

/** Feature 015: same create/update/duplicate/stale rules as the DynamoDB repo. */
export class InMemoryCatalogRepo implements CatalogRepo {
  readonly items = new Map<string, CatalogExercise>();
  /** Test hook: make `list()` fail (catalog outage). */
  failList = false;

  private nameTaken(name: string, exceptId?: string) {
    const n = exerciseNameKey(name);
    return [...this.items.values()].some((i) => i.exerciseId !== exceptId && exerciseNameKey(i.name) === n);
  }
  async list() {
    if (this.failList) throw Object.assign(new Error("boom"), { name: "ServiceUnavailable" });
    return [...this.items.values()];
  }
  async create(item: CatalogExercise) {
    if (this.items.has(item.exerciseId)) return "id_taken" as const;
    if (this.nameTaken(item.name)) return "duplicate" as const;
    this.items.set(item.exerciseId, item);
    return "ok" as const;
  }
  async update(id: string, expectedUpdatedAt: string, patch: CatalogPatch, by: string, nowIso: string): Promise<CatalogUpdateResult> {
    const current = this.items.get(id);
    if (!current) return { ok: false, reason: "not_found" };
    if (current.updatedAt !== expectedUpdatedAt) return { ok: false, reason: "stale" };
    if (patch.name !== undefined && this.nameTaken(patch.name, id)) return { ok: false, reason: "duplicate" };
    const item = { ...current, ...patch, updatedAt: nowIso, updatedBy: by };
    this.items.set(id, item);
    return { ok: true, item };
  }
  /** Seed an active exercise directly. */
  seed(exerciseId: string, name: string, group: CatalogExercise["group"] = "arms", status: CatalogExercise["status"] = "active") {
    this.items.set(exerciseId, { exerciseId, name, group, kind: "strength", status, createdAt: "t", createdBy: "roshan", updatedAt: "t", updatedBy: "roshan" });
  }
}

/** Usernames are unique ignoring case, like the Cognito pool (signInCaseSensitive: false). */
export class InMemoryUserDirectory implements UserDirectory {
  readonly users = new Map<string, string>();
  async create(username: string, temporaryPassword: string) {
    const key = username.toLowerCase();
    if (this.users.has(key)) return "taken" as const;
    this.users.set(key, temporaryPassword);
    return "ok" as const;
  }
}

/** Feature 021: same conditions as the Dynamo repo (version guard, win once, sticker once). */
export class InMemoryRaidRepo implements RaidRepo {
  readonly raids = new Map<string, Raid>();
  readonly contributions = new Map<string, RaidContribution>();
  readonly stickers = new Map<string, RaidSticker>();
  async listRaids(squadId: string) {
    return [...this.raids.values()].filter((r) => r.squadId === squadId).map((r) => structuredClone(r));
  }
  async getRaid(raidId: string) {
    const r = this.raids.get(raidId);
    return r ? structuredClone(r) : null;
  }
  async createRaid(raid: Raid) {
    if (this.raids.has(raid.raidId)) throw Object.assign(new Error("exists"), { name: "ConditionalCheckFailedException" });
    this.raids.set(raid.raidId, structuredClone(raid));
  }
  async updateRaid(raidId: string, patch: RaidPatch, expectedUpdatedAt: string) {
    const r = this.raids.get(raidId);
    if (!r || r.updatedAt !== expectedUpdatedAt) return "stale" as const;
    const next: Record<string, unknown> = { ...r };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (v === null) delete next[k];
      else next[k] = v;
    }
    this.raids.set(raidId, next as unknown as Raid);
    return "ok" as const;
  }
  async deleteRaid(raidId: string, expectedUpdatedAt: string) {
    const r = this.raids.get(raidId);
    if (!r || r.updatedAt !== expectedUpdatedAt) return "stale" as const;
    this.raids.delete(raidId);
    return "ok" as const;
  }
  async listContributions(raidId: string) {
    return [...this.contributions.values()].filter((c) => c.raidId === raidId).map((c) => ({ ...c }));
  }
  async getContribution(raidId: string, userId: string) {
    const c = this.contributions.get(`${raidId}|${userId}`);
    return c ? { ...c } : null;
  }
  async putContribution(c: RaidContribution) {
    const have = this.contributions.get(`${c.raidId}|${c.userId}`);
    if (have && have.statsVersion >= c.statsVersion) return "stale" as const;
    this.contributions.set(`${c.raidId}|${c.userId}`, { ...c });
    return "ok" as const;
  }
  async markWon(raidId: string, wonAt: string) {
    const r = this.raids.get(raidId);
    if (!r || r.wonAt || r.cancelledAt) return false;
    r.wonAt = wonAt;
    return true;
  }
  async setTotal(raidId: string, totalKg: number) {
    const r = this.raids.get(raidId);
    if (r) r.totalKg = totalKg;
  }
  async putSticker(userId: string, sticker: RaidSticker) {
    const key = `${userId}|${sticker.raidId}`;
    if (!this.stickers.has(key)) this.stickers.set(key, { ...sticker });
  }
  async listStickers(userId: string) {
    return [...this.stickers.entries()].filter(([k]) => k.startsWith(`${userId}|`)).map(([, v]) => ({ ...v }));
  }
}

export function makeDeps(now = "2026-11-11T10:00:00.000Z") {
  const profiles = new InMemoryProfileRepo();
  const workouts = new InMemoryWorkoutRepo();
  const gym = new InMemoryGymRepo(workouts);
  const food = new InMemoryFoodRepo();
  const coach = new InMemoryCoachRepo();
  const credentials = new InMemoryCredentialRepo();
  const avatars = new FakeAvatarStore();
  const photos = new FakePhotoStore();
  const sharePhotos = new FakeSharePhotoStore();
  const waitlist = new InMemoryWaitlistRepo();
  const squad = new InMemorySquadRepo();
  const activity = new InMemoryActivityRepo();
  const healthTokens = new InMemoryHealthTokenRepo();
  const catalog = new InMemoryCatalogRepo();
  const weights = new InMemoryWeightRepo();
  const users = new InMemoryUserDirectory();
  const raids = new InMemoryRaidRepo();
  let clock = new Date(now);
  const deps: Deps = { profiles, workouts, gym, food, coach, credentials, avatars, photos, sharePhotos, waitlist, squad, activity, healthTokens, weights, catalog, users, raids, now: () => clock };
  return { deps, profiles, workouts, gym, food, coach, credentials, avatars, photos, sharePhotos, waitlist, squad, activity, healthTokens, weights, catalog, users, raids, setNow: (iso: string) => (clock = new Date(iso)) };
}

export function makeEvent(opts: {
  sub?: string;
  username?: string;
  body?: unknown;
  rawBody?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  /** Feature 015: the `cognito:groups` claim as the HTTP API authorizer passes it, e.g. "[admin]". */
  groups?: string;
}): APIGatewayProxyEventV2WithJWTAuthorizer {
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: opts.sub ?? "user-1", username: opts.username ?? "alice", ...(opts.groups ? { "cognito:groups": opts.groups } : {}) },
          scopes: [],
        },
      },
    },
    ...(body !== undefined ? { body } : {}),
    ...(opts.pathParameters ? { pathParameters: opts.pathParameters } : {}),
    ...(opts.queryStringParameters ? { queryStringParameters: opts.queryStringParameters } : {}),
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

export function parse(res: unknown) {
  const r = res as APIGatewayProxyStructuredResultV2;
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
}

export const validProfile = { displayName: "Alice", timezone: "Asia/Kolkata", dailyCalorieTarget: 2200 };

/** Smallest byte sequence our WebP check accepts: RIFF....WEBP */
export function webpBytes(extra = 0): Buffer {
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "ascii");
  head.write("WEBP", 8, "ascii");
  return Buffer.concat([head, Buffer.alloc(extra)]);
}

/** Create the caller's profile directly in the fake repo. */
export async function seedProfile(profiles: InMemoryProfileRepo, sub = "user-1", timezone = "Asia/Kolkata", username = "alice") {
  await profiles.upsert(sub, username, { ...validProfile, timezone }, "2026-01-01T00:00:00.000Z");
}

/** A workout entry that burned `calories` on `date`, for ledger tests. */
export async function seedWorkoutEntry(workouts: InMemoryWorkoutRepo, userId: string, date: string, calories: number, workoutId = "std-running") {
  await workouts.putEntryIfAbsent(userId, {
    date, workoutId, name: workoutId, rateMinutes: 30, rateCalories: calories, minutes: 30, calories,
    createdAt: "t", updatedAt: "t",
  });
}

/** Own activities standing in for the former built-ins (feature 007): Running 30/300, Yoga 30/90, Strength 45/220. */
export async function seedActivities(workouts: InMemoryWorkoutRepo, userId = "user-1") {
  for (const [workoutId, name, defaultMinutes, defaultCalories] of [
    ["c-run", "Running", 30, 300],
    ["c-yoga", "Yoga", 30, 90],
    ["c-strength", "Strength training", 45, 220],
  ] as const) {
    await workouts.putCustomWorkout(userId, { workoutId, name, defaultMinutes, defaultCalories, createdAt: "t", updatedAt: "t" });
  }
}
