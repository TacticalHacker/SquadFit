import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ProfileInput } from "@calci/shared";
import type { AvatarStore } from "../src/lib/avatar-store";
import type { Deps } from "../src/lib/deps";
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
  const avatars = new FakeAvatarStore();
  let clock = new Date(now);
  const deps: Deps = { profiles, avatars, now: () => clock };
  return { deps, profiles, avatars, setNow: (iso: string) => (clock = new Date(iso)) };
}

export function makeEvent(opts: {
  sub?: string;
  username?: string;
  body?: unknown;
  rawBody?: string;
}): APIGatewayProxyEventV2WithJWTAuthorizer {
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return {
    requestContext: {
      authorizer: {
        jwt: { claims: { sub: opts.sub ?? "user-1", username: opts.username ?? "alice" }, scopes: [] },
      },
    },
    ...(body !== undefined ? { body } : {}),
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
