import { describe, expect, it } from "vitest";
import { PeopleResponseSchema } from "@calci/shared";
import { handle } from "../src/handlers/people-get";
import { makeDeps, makeEvent, parse, validProfile } from "./fakes";

async function seed() {
  const ctx = makeDeps();
  await ctx.profiles.upsert("user-2", "bob", { ...validProfile, displayName: "Bob" }, "2026-11-11T11:00:00.000Z");
  await ctx.profiles.upsert("user-1", "alice", { ...validProfile, displayName: "Alice" }, "2026-11-11T10:00:00.000Z");
  return ctx;
}

describe("GET /people", () => {
  it("lists members in join order and marks only the caller as you", async () => {
    const { deps } = await seed();
    const { status, body } = parse(await handle(makeEvent({ sub: "user-2", username: "bob" }), deps));
    expect(status).toBe(200);
    expect(PeopleResponseSchema.safeParse(body).success).toBe(true);
    expect(body.members.map((m: { displayName: string }) => m.displayName)).toEqual(["Alice", "Bob"]);
    expect(body.members.map((m: { isYou: boolean }) => m.isYou)).toEqual([false, true]);
  });

  it("never exposes calorie target, timezone or username (FR-018)", async () => {
    const { deps } = await seed();
    const res = (await handle(makeEvent({ sub: "user-1" }), deps)) as { body: string };
    for (const secret of ["dailyCalorieTarget", "timezone", "username", "2200", "Asia/Kolkata", "bob"]) {
      expect(res.body).not.toContain(secret);
    }
  });

  it("includes presigned avatar urls or null", async () => {
    const { deps, profiles, avatars } = await seed();
    const key = await avatars.put("user-1", new Uint8Array([1]));
    await profiles.setAvatarKey("user-1", key, "2026-11-11T12:00:00.000Z");
    const { body } = parse(await handle(makeEvent({ sub: "user-2" }), deps));
    expect(body.members[0].avatarUrl).toContain(key);
    expect(body.members[1].avatarUrl).toBeNull();
  });

  it("does not list a user who never completed setup", async () => {
    const { deps } = await seed(); // "user-3" exists in the identity provider only
    const { body } = parse(await handle(makeEvent({ sub: "user-1" }), deps));
    expect(body.members).toHaveLength(2);
  });

  it("409 PROFILE_REQUIRED when the caller has no profile (FR-011)", async () => {
    const { deps } = await seed();
    const { status, body } = parse(await handle(makeEvent({ sub: "user-3", username: "carol" }), deps));
    expect(status).toBe(409);
    expect(body.error.code).toBe("PROFILE_REQUIRED");
  });
});
