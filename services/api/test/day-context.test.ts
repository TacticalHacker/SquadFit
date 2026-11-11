import { describe, expect, it } from "vitest";
import { loadDayContext, resolveReadDate, resolveWriteDate } from "../src/lib/day-context";
import { makeDeps, parse, seedProfile } from "./fakes";

const caller = { userId: "user-1", username: "alice" };

describe("loadDayContext", () => {
  it("computes today from the profile timezone", async () => {
    const { deps, profiles } = makeDeps("2026-11-11T20:00:00.000Z");
    await seedProfile(profiles, "user-1", "Asia/Kolkata");
    await seedProfile(profiles, "user-2", "America/Los_Angeles");
    const a = await loadDayContext(caller, deps);
    const b = await loadDayContext({ userId: "user-2", username: "bob" }, deps);
    expect(a).toEqual({ ok: true, ctx: { timezone: "Asia/Kolkata", today: "2026-11-12", target: 2200 } });
    expect(b).toEqual({ ok: true, ctx: { timezone: "America/Los_Angeles", today: "2026-11-11", target: 2200 } });
  });

  it("409 PROFILE_REQUIRED without a profile", async () => {
    const { deps } = makeDeps();
    const r = await loadDayContext(caller, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const p = parse(r.response);
      expect(p.status).toBe(409);
      expect(p.body.error.code).toBe("PROFILE_REQUIRED");
    }
  });
});

describe("resolveReadDate", () => {
  it("defaults to today, rejects malformed and future", () => {
    expect(resolveReadDate(undefined, "2026-11-11")).toEqual({ ok: true, date: "2026-11-11" });
    expect(resolveReadDate("2026-01-01", "2026-11-11")).toEqual({ ok: true, date: "2026-01-01" });
    for (const raw of ["nope", "2026-11-12"]) {
      const r = resolveReadDate(raw, "2026-11-11");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(parse(r.response).status).toBe(400);
    }
  });
});

describe("resolveWriteDate", () => {
  it("allows today and today-2", () => {
    expect(resolveWriteDate("2026-11-11", "2026-11-11").ok).toBe(true);
    expect(resolveWriteDate("2026-11-09", "2026-11-11").ok).toBe(true);
  });
  it("locks older days with 409 DAY_LOCKED", () => {
    const r = resolveWriteDate("2026-11-08", "2026-11-11");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const p = parse(r.response);
      expect(p.status).toBe(409);
      expect(p.body.error).toMatchObject({ code: "DAY_LOCKED", message: "This day can no longer be edited" });
    }
  });
  it("rejects future and malformed dates with 400", () => {
    for (const raw of ["2026-11-12", "x"]) {
      const r = resolveWriteDate(raw, "2026-11-11");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(parse(r.response).status).toBe(400);
    }
  });
});
