import { describe, expect, it } from "vitest";
import { MeResponseSchema } from "@calci/shared";
import { handle } from "../src/handlers/me-get";
import { makeDeps, makeEvent, parse, validProfile } from "./fakes";

describe("GET /me", () => {
  it("returns profile: null before setup", async () => {
    const { deps } = makeDeps();
    const { status, body } = parse(await handle(makeEvent({}), deps));
    expect(status).toBe(200);
    expect(body).toEqual({ username: "alice", userId: "user-1", profile: null, isAdmin: false, unreadNotifications: 0 });
  });

  it("isAdmin follows the caller's admin group (feature 015)", async () => {
    const { deps } = makeDeps();
    expect(parse(await handle(makeEvent({ groups: "[admin]" }), deps)).body.isAdmin).toBe(true);
  });

  it("returns the private profile including calorie target and presigned avatar", async () => {
    const { deps, profiles, avatars } = makeDeps();
    await profiles.upsert("user-1", "alice", validProfile, "2026-11-11T10:00:00.000Z");
    const key = await avatars.put("user-1", new Uint8Array([1]));
    await profiles.setAvatarKey("user-1", key, "2026-11-11T10:01:00.000Z");

    const { body } = parse(await handle(makeEvent({}), deps));
    expect(MeResponseSchema.safeParse(body).success).toBe(true);
    expect(body.profile).toMatchObject({ ...validProfile, joinedAt: "2026-11-11T10:00:00.000Z" });
    expect(body.profile.avatarUrl).toContain(key);
  });

  it("avatarUrl is null without an avatar", async () => {
    const { deps, profiles } = makeDeps();
    await profiles.upsert("user-1", "alice", validProfile, "2026-11-11T10:00:00.000Z");
    expect(parse(await handle(makeEvent({}), deps)).body.profile.avatarUrl).toBeNull();
  });
});
