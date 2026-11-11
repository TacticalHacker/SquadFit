import { describe, expect, it } from "vitest";
import { hasDayChanged } from "./rollover";

describe("hasDayChanged", () => {
  it("is false within the same local day and true after local midnight", () => {
    expect(hasDayChanged(new Date("2026-11-11T10:00:00Z"), "UTC", "2026-11-11")).toBe(false);
    expect(hasDayChanged(new Date("2026-11-12T00:00:00Z"), "UTC", "2026-11-11")).toBe(true);
  });
  it("depends on the zone at the same instant", () => {
    const t = new Date("2026-11-11T20:00:00Z");
    expect(hasDayChanged(t, "Asia/Kolkata", "2026-11-11")).toBe(true);
    expect(hasDayChanged(t, "America/Los_Angeles", "2026-11-11")).toBe(false);
  });
});
