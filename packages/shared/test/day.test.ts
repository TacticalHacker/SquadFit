import { describe, expect, it } from "vitest";
import { DateSchema, addDays, dateRange, daysBetween, isEditableDay, localDate } from "../src/domain/day";

describe("localDate", () => {
  const instant = new Date("2026-11-11T20:00:00Z");
  it.each([
    ["Asia/Kolkata", "2026-11-12"],
    ["America/Los_Angeles", "2026-11-11"],
    ["Pacific/Kiritimati", "2026-11-12"],
    ["UTC", "2026-11-11"],
    ["Europe/London", "2026-11-11"],
  ])("%s", (tz, expected) => expect(localDate(instant, tz)).toBe(expected));

  it("handles US spring-forward day (23h)", () => {
    expect(localDate(new Date("2026-03-08T04:59:00Z"), "America/New_York")).toBe("2026-03-07");
    expect(localDate(new Date("2026-03-08T05:00:00Z"), "America/New_York")).toBe("2026-03-08");
    expect(localDate(new Date("2026-03-09T03:59:00Z"), "America/New_York")).toBe("2026-03-08");
    expect(localDate(new Date("2026-03-09T04:00:00Z"), "America/New_York")).toBe("2026-03-09");
  });
  it("handles US fall-back day (25h)", () => {
    expect(localDate(new Date("2026-11-01T03:59:00Z"), "America/New_York")).toBe("2026-10-31");
    expect(localDate(new Date("2026-11-01T04:00:00Z"), "America/New_York")).toBe("2026-11-01");
    expect(localDate(new Date("2026-11-02T04:59:00Z"), "America/New_York")).toBe("2026-11-01");
    expect(localDate(new Date("2026-11-02T05:00:00Z"), "America/New_York")).toBe("2026-11-02");
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("isEditableDay", () => {
  const today = "2026-11-11";
  it("allows today and the two days before", () => {
    expect(isEditableDay("2026-11-11", today)).toBe(true);
    expect(isEditableDay("2026-11-10", today)).toBe(true);
    expect(isEditableDay("2026-11-09", today)).toBe(true);
  });
  it("refuses older and future days", () => {
    expect(isEditableDay("2026-11-08", today)).toBe(false);
    expect(isEditableDay("2026-11-12", today)).toBe(false);
  });
});

describe("DateSchema", () => {
  it("accepts a real date", () => expect(DateSchema.safeParse("2026-11-11").success).toBe(true));
  it.each(["2026-02-30", "2026-13-01", "26-11-11", "2026-11-11T00:00", ""])("rejects %j", (v) =>
    expect(DateSchema.safeParse(v).success).toBe(false),
  );
});

describe("dateRange / daysBetween", () => {
  it("lists dates oldest first", () => {
    expect(dateRange("2026-11-09", "2026-11-11")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
  });
  it("counts across a month end", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});
