import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { OverallNoteInput, ProfileInput } from "@calci/shared";
import type { AvatarStore } from "../src/lib/avatar-store";
import { newCoachItem, toCoachNote, type CoachNoteItem, type CoachRepo, type TickResult } from "../src/lib/coach-repo";
import type { CredentialRepo } from "../src/lib/credential-repo";
import { photoKey, type PhotoContentType, type PhotoStore } from "../src/lib/photo-store";
import type { Deps } from "../src/lib/deps";
import type { FoodEntryItem, FoodRepo, OwnFoodItem, EntryUpdate } from "../src/lib/food-repo";
import type { CustomWorkoutItem, EntryItem, WorkoutRepo } from "../src/lib/workout-repo";
import type { GymEntryItem, GymRepo, OwnExerciseItem } from "../src/lib/gym-repo";
import { ProfileMissingError, type ProfileItem, type ProfileRepo } from "../src/lib/profile-repo";
import type { WaitlistEntry, WaitlistRepo } from "../src/lib/waitlist-repo";

export class InMemoryProfileRepo implements ProfileRepo {
  readonly items = new Map<string, ProfileItem>();

  async get(userId: string) {
    return this.items.get(userId) ?? null;
  }

  async upsert(userId: string, username: string, input: ProfileInput, nowIso: string) {
    const existing = this.items.get(userId);
    const item: ProfileItem = {
      ...(existing?.avatarKey ? { avatarKey: existing.avatarKey } : {}),
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
      updatedAt: nowIso,
    };
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

export function makeDeps(now = "2026-11-11T10:00:00.000Z") {
  const profiles = new InMemoryProfileRepo();
  const workouts = new InMemoryWorkoutRepo();
  const gym = new InMemoryGymRepo(workouts);
  const food = new InMemoryFoodRepo();
  const coach = new InMemoryCoachRepo();
  const credentials = new InMemoryCredentialRepo();
  const avatars = new FakeAvatarStore();
  const photos = new FakePhotoStore();
  const waitlist = new InMemoryWaitlistRepo();
  let clock = new Date(now);
  const deps: Deps = { profiles, workouts, gym, food, coach, credentials, avatars, photos, waitlist, now: () => clock };
  return { deps, profiles, workouts, gym, food, coach, credentials, avatars, photos, waitlist, setNow: (iso: string) => (clock = new Date(iso)) };
}

export function makeEvent(opts: {
  sub?: string;
  username?: string;
  body?: unknown;
  rawBody?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}): APIGatewayProxyEventV2WithJWTAuthorizer {
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return {
    requestContext: {
      authorizer: {
        jwt: { claims: { sub: opts.sub ?? "user-1", username: opts.username ?? "alice" }, scopes: [] },
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
