import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ProfileInput } from "@calci/shared";
import type { AvatarStore } from "../src/lib/avatar-store";
import type { Deps } from "../src/lib/deps";
import type { FoodEntryItem, FoodRepo, OwnFoodItem, EntryUpdate } from "../src/lib/food-repo";
import type { CustomWorkoutItem, EntryItem, WorkoutRepo } from "../src/lib/workout-repo";
import { ProfileMissingError, type ProfileItem, type ProfileRepo } from "../src/lib/profile-repo";

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
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    this.items.set(userId, item);
    return item;
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
    this.entries.set(key, { ...e, minutes, calories, updatedAt: nowIso });
    return true;
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
    const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    this.entries.set(key, { ...e, ...defined, updatedAt: nowIso });
    return true;
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
  const food = new InMemoryFoodRepo();
  const avatars = new FakeAvatarStore();
  let clock = new Date(now);
  const deps: Deps = { profiles, workouts, food, avatars, now: () => clock };
  return { deps, profiles, workouts, food, avatars, setNow: (iso: string) => (clock = new Date(iso)) };
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
