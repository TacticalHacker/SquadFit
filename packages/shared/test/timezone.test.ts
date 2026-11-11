import { describe, expect, it } from "vitest";
import { isValidTimeZone, listTimeZones } from "../src/domain/timezone";

describe("isValidTimeZone", () => {
  it.each(["Asia/Kolkata", "Asia/Calcutta", "America/New_York", "UTC"])("accepts %s", (tz) => {
    expect(isValidTimeZone(tz)).toBe(true);
  });
  it.each(["Mars/Base", "", "Asia/", "not a zone"])("rejects %j", (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });
});

describe("listTimeZones", () => {
  it("is sorted, unique, and includes common zones even if the runtime omits them", () => {
    const list = listTimeZones();
    expect(list).toContain("Europe/London");
    expect(list).toContain("UTC");
    expect(new Set(list).size).toBe(list.length);
    expect([...list].sort()).toEqual(list);
  });
  it("includes an extra device zone when given and valid", () => {
    expect(listTimeZones("Asia/Kolkata")).toContain("Asia/Kolkata");
  });
  it("ignores an invalid extra zone", () => {
    expect(listTimeZones("Mars/Base")).not.toContain("Mars/Base");
  });
});
