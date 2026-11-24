import { describe, expect, it } from "vitest";
import { buildWeightView, latestEntry, nearestSlot, rangeWindow, stepWeightKg, weightAxis, type WeightEntryLike } from "../src/domain/bodyweight";

const today = "2026-11-24"; // a Tuesday
let n = 0;
const e = (date: string, weightKg: number, time = "07:00"): WeightEntryLike => {
  const recordedAt = `${date}T${time}:00.000Z`;
  return { id: `${recordedAt.replace(/[-:.]/g, "").slice(0, 18)}Z-a${String(n++).padStart(5, "0")}`, date, recordedAt, weightKg };
};

describe("rangeWindow", () => {
  it("W and M are daily slots ending today, with a 6-day lead-in for the trend", () => {
    const w = rangeWindow("W", today);
    expect(w.slots).toHaveLength(7);
    expect(w.slots[0]).toEqual({ start: "2026-11-18", end: "2026-11-18" });
    expect(w.fetchFrom).toBe("2026-11-12");
    expect(rangeWindow("M", today).slots).toHaveLength(30);
    expect(rangeWindow("M", today).start).toBe("2026-10-26");
  });

  it("6M is 26 Monday weeks and Y is 12 calendar months, last slot clamped to today", () => {
    const h = rangeWindow("6M", today);
    expect(h.slots).toHaveLength(26);
    expect(h.slots[25]).toEqual({ start: "2026-11-23", end: today });
    expect(h.slots[0]!.start).toBe("2026-06-01");
    const y = rangeWindow("Y", today);
    expect(y.slots).toHaveLength(12);
    expect(y.slots[0]).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(y.slots[11]).toEqual({ start: "2026-11-01", end: today });
    expect(y.fetchFrom).toBe("2025-12-01");
  });
});

describe("buildWeightView", () => {
  it("matches the worked example (data-model.md)", () => {
    const entries = [e("2026-11-20", 78.0), e("2026-11-20", 78.6, "19:00"), e("2026-11-22", 77.9), e("2026-11-24", 78.3)];
    const v = buildWeightView({ range: "M", today, entries, latest: latestEntry(entries), profileWeightKg: 78.3 });
    expect(v.summary).toEqual({ average: 78.2, min: 77.9, max: 78.6 });
    const s20 = v.slots.find((s) => s.start === "2026-11-20")!;
    expect(s20).toMatchObject({ count: 2, min: 78.0, max: 78.6, average: 78.3 });
    expect(v.slots.at(-1)!.trend).toBe(78.2);
    expect(v.editableDays.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-23", "2026-11-22"]);
    expect(v.editableDays[2]!.entries).toHaveLength(1);
  });

  it("averages day averages in a week, and an empty window has no summary", () => {
    // Monday: 80, 80, 80 (day avg 80); Wednesday: 70 → week avg 75, not 77.5.
    const entries = [e("2026-11-16", 80), e("2026-11-16", 80, "08:00"), e("2026-11-16", 80, "09:00"), e("2026-11-18", 70)];
    const v = buildWeightView({ range: "6M", today, entries, latest: null, profileWeightKg: null });
    expect(v.slots[24]).toMatchObject({ start: "2026-11-16", count: 4, average: 75, min: 70, max: 80, trend: null });
    expect(buildWeightView({ range: "W", today, entries: [], latest: null, profileWeightKg: null }).summary).toBeNull();
  });

  it("the trend uses days before the visible range", () => {
    const entries = [e("2026-11-15", 80), e("2026-11-18", 78)];
    const v = buildWeightView({ range: "W", today, entries, latest: null, profileWeightKg: null });
    expect(v.slots[0]!.trend).toBe(79); // 11-18 looks back to 11-12..11-18
    expect(v.summary!.average).toBe(78); // the lead-in day is not in the summary
  });
});

describe("weightAxis", () => {
  it("covers min − 1 … max + 1 with 3–4 round gridlines", () => {
    const a = weightAxis(76.2, 79.8);
    expect(a.lo).toBeLessThanOrEqual(75.2);
    expect(a.hi).toBeGreaterThanOrEqual(80.8);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(4);
    expect(weightAxis(78, 78).ticks).toEqual([77, 78, 79]);
  });
});

describe("latestEntry / nearestSlot / stepWeightKg", () => {
  it("orders by date then time, not insertion (a backfill never wins)", () => {
    const todayEntry = e(today, 78.0, "07:00");
    const backfill = { ...e("2026-11-23", 79.5, "07:05"), recordedAt: `${today}T07:05:00.000Z` };
    expect(latestEntry([todayEntry, backfill])).toBe(todayEntry);
  });

  it("snaps to the nearest slot with data", () => {
    const slots = [{ count: 1 }, { count: 0 }, { count: 0 }, { count: 2 }];
    expect(nearestSlot(slots, 1.2)).toBe(0);
    expect(nearestSlot(slots, 2.1)).toBe(3);
    expect(nearestSlot([{ count: 0 }], 0)).toBe(-1);
  });

  it("steps by 0.1 kg within 20–400", () => {
    expect(stepWeightKg(78.4, 1)).toBe(78.5);
    expect(stepWeightKg(20, -1)).toBe(20);
  });
});
