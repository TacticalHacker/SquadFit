import { describe, expect, it } from "vitest";
import { CalorieTargetSchema, DisplayNameSchema, initials, PasswordSchema, ProteinTargetSchema } from "../src/domain/profile";

describe("DisplayNameSchema", () => {
  it("trims and accepts 1–40 chars", () => {
    expect(DisplayNameSchema.parse("  Roshan  ")).toBe("Roshan");
    expect(DisplayNameSchema.safeParse("a".repeat(40)).success).toBe(true);
  });
  it("rejects empty, whitespace-only and > 40 chars", () => {
    expect(DisplayNameSchema.safeParse("").success).toBe(false);
    expect(DisplayNameSchema.safeParse("   ").success).toBe(false);
    expect(DisplayNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});

describe("CalorieTargetSchema", () => {
  it.each([500, 2200, 10000])("accepts %d", (v) => {
    expect(CalorieTargetSchema.safeParse(v).success).toBe(true);
  });
  it.each([499, 10001, 2000.5, -5, 0, Number.NaN])("rejects %d", (v) => {
    const r = CalorieTargetSchema.safeParse(v);
    expect(r.success).toBe(false);
  });
  it("uses the documented message", () => {
    const r = CalorieTargetSchema.safeParse(100);
    expect(r.success ? "" : r.error.issues[0]?.message).toBe("Must be between 500 and 10,000 kcal");
  });
});

describe("PasswordSchema", () => {
  it("requires at least 8 characters", () => {
    expect(PasswordSchema.safeParse("12345678").success).toBe(true);
    const r = PasswordSchema.safeParse("short");
    expect(r.success ? "" : r.error.issues[0]?.message).toBe("Password must be at least 8 characters");
  });
});

describe("initials", () => {
  it("takes up to two uppercase initials", () => {
    expect(initials("Roshan Raj")).toBe("RR");
    expect(initials("alice")).toBe("A");
    expect(initials("john ronald reuel")).toBe("JR");
    expect(initials("  bob   smith ")).toBe("BS");
  });
});

describe("ProteinTargetSchema", () => {
  it.each([10, 130, 500])("accepts %d", (v) => {
    expect(ProteinTargetSchema.safeParse(v).success).toBe(true);
  });
  it.each([9, 501, 100.5, 0, Number.NaN])("rejects %d", (v) => {
    expect(ProteinTargetSchema.safeParse(v).success).toBe(false);
  });
});
