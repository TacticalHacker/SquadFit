import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PulseResponseSchema } from "@calci/shared";
import { handle } from "../src/handlers/public-pulse-get";
import { makeDeps, parse, validProfile } from "./fakes";

const entry = (date: string, id: string) => ({
  date, workoutId: id, name: id, rateMinutes: 30, rateCalories: 100, minutes: 30, calories: 100, createdAt: "t", updatedAt: "t",
});

describe("GET /public/pulse", () => {
  it("counts lifters and each member's workouts in their own last 7 days, nothing else", async () => {
    // 20:00 UTC: already 2026-11-12 in Kolkata, still 2026-11-11 in Los Angeles.
    const { deps, profiles, workouts } = makeDeps("2026-11-11T20:00:00.000Z");
    await profiles.upsert("u1", "alice", { ...validProfile, displayName: "Alice", timezone: "Asia/Kolkata" }, "t");
    await profiles.upsert("u2", "bob", { ...validProfile, displayName: "Bob", timezone: "America/Los_Angeles" }, "t");
    await workouts.putEntryIfAbsent("u1", entry("2026-11-12", "a"));
    await workouts.putEntryIfAbsent("u1", entry("2026-11-06", "b"));
    await workouts.putEntryIfAbsent("u1", entry("2026-11-05", "outside")); // 8th day back for Kolkata
    await workouts.putEntryIfAbsent("u2", entry("2026-11-05", "c")); // 7th day back for Los Angeles
    await workouts.putEntryIfAbsent("u2", entry("2026-11-12", "future")); // tomorrow in Los Angeles

    const res = await handle({} as APIGatewayProxyEventV2, deps);
    const { status, body } = parse(res);
    expect(status).toBe(200);
    expect(PulseResponseSchema.parse(body)).toEqual({ lifters: 2, workoutsLast7Days: 3, computedAt: "2026-11-11T20:00:00.000Z" });
    for (const secret of ["Alice", "Bob", "alice", "Kolkata"]) expect((res as { body: string }).body).not.toContain(secret);
  });
});
