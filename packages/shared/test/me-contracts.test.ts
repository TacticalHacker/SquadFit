import { describe, expect, it } from "vitest";
import { OwnProfileSchema, ProfileInputSchema } from "../src/contracts/me";
import { PublicMemberSchema } from "../src/contracts/people";

const base = { displayName: "Ro", timezone: "Asia/Kolkata", dailyCalorieTarget: 2200 };

describe("body weight in profile contracts (feature 007)", () => {
  it("ProfileInputSchema accepts a number, null or no body weight", () => {
    expect(ProfileInputSchema.parse({ ...base, bodyWeightKg: 78.5 }).bodyWeightKg).toBe(78.5);
    expect(ProfileInputSchema.parse({ ...base, bodyWeightKg: null }).bodyWeightKg).toBeNull();
    expect(ProfileInputSchema.parse(base).bodyWeightKg).toBeUndefined();
  });
  it("ProfileInputSchema rejects an out-of-range body weight", () => {
    expect(ProfileInputSchema.safeParse({ ...base, bodyWeightKg: 500 }).success).toBe(false);
  });
  it("OwnProfileSchema defaults bodyWeightKg to null", () => {
    const p = OwnProfileSchema.parse({
      displayName: "Ro",
      timezone: "Asia/Kolkata",
      dailyCalorieTarget: 2200,
      avatarUrl: null,
      joinedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(p.bodyWeightKg).toBeNull();
  });
  it("PublicMemberSchema never carries body weight (FR-003)", () => {
    expect(Object.keys(PublicMemberSchema.shape)).not.toContain("bodyWeightKg");
  });
});
