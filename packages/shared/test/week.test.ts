import { describe, expect, it } from "vitest";
import { localDate } from "../src/domain/day";
import { isWeekEnded, weekStart } from "../src/domain/week";

describe("weekStart", () => {
  it("returns the Monday on or before the date", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-16"); // Wednesday
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
  });

  it("puts a Sunday-night UTC instant in the new week for a timezone ahead of UTC", () => {
    const instant = new Date("2026-11-15T23:30:00Z"); // Sunday in London, already Monday 05:00 in Kolkata
    expect(weekStart(localDate(instant, "Asia/Kolkata"))).toBe("2026-11-16");
    expect(weekStart(localDate(instant, "Europe/London"))).toBe("2026-11-09");
  });
});

describe("isWeekEnded", () => {
  it("is true only after the Sunday", () => {
    expect(isWeekEnded("2026-11-09", "2026-11-16")).toBe(true);
    expect(isWeekEnded("2026-11-09", "2026-11-15")).toBe(false);
  });
});
