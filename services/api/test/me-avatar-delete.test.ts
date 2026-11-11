import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/me-avatar-delete";
import { makeDeps, makeEvent, parse, validProfile } from "./fakes";

describe("DELETE /me/avatar", () => {
  it("removes the object and clears the key", async () => {
    const { deps, profiles, avatars } = makeDeps();
    await profiles.upsert("user-1", "alice", validProfile, "2026-11-11T10:00:00.000Z");
    const key = await avatars.put("user-1", new Uint8Array([1]));
    await profiles.setAvatarKey("user-1", key, "2026-11-11T10:00:01.000Z");

    const { status, body } = parse(await handle(makeEvent({}), deps));
    expect(status).toBe(200);
    expect(body.profile.avatarUrl).toBeNull();
    expect(avatars.objects.size).toBe(0);
    expect((await profiles.get("user-1"))?.avatarKey).toBeUndefined();
  });

  it("is idempotent when there is no avatar", async () => {
    const { deps, profiles } = makeDeps();
    await profiles.upsert("user-1", "alice", validProfile, "2026-11-11T10:00:00.000Z");
    expect(parse(await handle(makeEvent({}), deps)).status).toBe(200);
  });

  it("409 PROFILE_REQUIRED without a profile", async () => {
    const { deps } = makeDeps();
    expect(parse(await handle(makeEvent({}), deps)).status).toBe(409);
  });
});
