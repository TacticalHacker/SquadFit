import { describe, expect, it } from "vitest";
import { handle } from "../src/handlers/me-profile-put";
import { makeDeps, makeEvent, parse, validProfile } from "./fakes";

describe("PUT /me/profile", () => {
  it("creates the profile on first call; joinedAt = creation time; username from claims", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T10:00:00.000Z");
    const { status, body } = parse(await handle(makeEvent({ body: validProfile }), deps));
    expect(status).toBe(200);
    expect(body.username).toBe("alice");
    expect(body.profile.joinedAt).toBe("2026-11-11T10:00:00.000Z");
    expect((await profiles.get("user-1"))?.username).toBe("alice");
  });

  it("updates fields later but never changes joinedAt", async () => {
    const { deps, setNow } = makeDeps("2026-11-11T10:00:00.000Z");
    await handle(makeEvent({ body: validProfile }), deps);
    setNow("2026-11-12T10:00:00.000Z");
    const { body } = parse(
      await handle(makeEvent({ body: { ...validProfile, displayName: "Alice B", dailyCalorieTarget: 1800 } }), deps),
    );
    expect(body.profile).toMatchObject({ displayName: "Alice B", dailyCalorieTarget: 1800, joinedAt: "2026-11-11T10:00:00.000Z" });
  });

  it("trims the display name", async () => {
    const { deps } = makeDeps();
    const { body } = parse(await handle(makeEvent({ body: { ...validProfile, displayName: "  Al  " } }), deps));
    expect(body.profile.displayName).toBe("Al");
  });

  it("rejects bad input with per-field messages", async () => {
    const { deps, profiles } = makeDeps();
    const { status, body } = parse(
      await handle(makeEvent({ body: { displayName: "   ", timezone: "Mars/Base", dailyCalorieTarget: 100 } }), deps),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields).toMatchObject({
      displayName: expect.any(String),
      timezone: "Unknown timezone",
      dailyCalorieTarget: "Must be between 500 and 10,000 kcal",
    });
    expect(await profiles.get("user-1")).toBeNull();
  });

  it("rejects a non-JSON body", async () => {
    const { deps } = makeDeps();
    expect(parse(await handle(makeEvent({ rawBody: "nope" }), deps)).status).toBe(400);
  });
});

describe("PUT /me/profile body weight (feature 007)", () => {
  it("sets, keeps when absent, and clears with null", async () => {
    const { deps } = makeDeps();
    let r = parse(await handle(makeEvent({ body: { ...validProfile, bodyWeightKg: 78.5 } }), deps));
    expect(r.body.profile.bodyWeightKg).toBe(78.5);
    r = parse(await handle(makeEvent({ body: validProfile }), deps));
    expect(r.body.profile.bodyWeightKg).toBe(78.5);
    r = parse(await handle(makeEvent({ body: { ...validProfile, bodyWeightKg: null } }), deps));
    expect(r.body.profile.bodyWeightKg).toBeNull();
  });
  it("rejects an out-of-range body weight", async () => {
    const { deps } = makeDeps();
    const r = parse(await handle(makeEvent({ body: { ...validProfile, bodyWeightKg: 500 } }), deps));
    expect(r.status).toBe(400);
    expect(r.body.error.fields.bodyWeightKg).toBeDefined();
  });
});
