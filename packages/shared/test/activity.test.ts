import { describe, expect, it } from "vitest";
import {
  extractActivityDays,
  formatProblems,
  isStepRun,
  parseActivityDays,
  rankSteps,
  stepsBoardRow,
  toNumber,
} from "../src/domain/activity";

const today = "2026-11-18";

describe("toNumber (Shortcut quirks)", () => {
  it("reads numbers, numeric text with separators and decimals", () => {
    expect(toNumber(8423)).toBe(8423);
    expect(toNumber("8,423.0")).toBe(8423);
    expect(toNumber(" 6.15 ")).toBe(6.15);
    expect(toNumber("eight")).toBeNull();
    expect(toNumber(true)).toBeNull();
  });
});

describe("extractActivityDays", () => {
  it("accepts a list, a single day object and { days: object }", () => {
    expect(extractActivityDays({ days: [{ date: today, steps: 1 }], source: "shortcut" })).toMatchObject({ ok: true, source: "shortcut", days: [{ date: today }] });
    expect(extractActivityDays({ date: today, steps: "1" })).toMatchObject({ ok: true, days: [{ date: today }] });
    expect(extractActivityDays({ days: { date: today, steps: 1 } })).toMatchObject({ ok: true, days: [{ date: today }] });
    // A client cannot claim to be the AI agent.
    expect(extractActivityDays({ days: [], source: "mcp" })).toMatchObject({ source: "shortcut" });
  });

  it("detects Health Auto Export, sums samples per day and converts units", () => {
    const r = extractActivityDays({
      data: {
        metrics: [
          { name: "step_count", units: "count", data: [{ date: "2026-11-17 08:00:00 +0530", qty: 3000 }, { date: "2026-11-17 18:00:00 +0530", qty: 2000.4 }, { date: "2026-11-18 09:00:00 +0530", qty: 100 }] },
          { name: "active_energy", units: "kJ", data: [{ date: "2026-11-17 08:00:00 +0530", qty: 418.4 }] },
          { name: "walking_running_distance", units: "mi", data: [{ date: "2026-11-17 08:00:00 +0530", qty: 1 }] },
          { name: "heart_rate", units: "bpm", data: [{ date: "2026-11-17 08:00:00 +0530", qty: 70 }] },
        ],
      },
    });
    expect(r).toMatchObject({ ok: true, source: "health_auto_export" });
    const parsed = parseActivityDays(r.ok ? r.days : [], today);
    expect(parsed).toEqual({
      ok: true,
      days: [
        { date: "2026-11-17", steps: 5000, activeKcal: 100, distanceKm: 1.61 },
        { date: "2026-11-18", steps: 100, activeKcal: null, distanceKm: null },
      ],
    });
  });
});

describe("parseActivityDays", () => {
  it("rounds, keeps optional fields unknown, and lets the last duplicate date win", () => {
    const r = parseActivityDays(
      [
        { date: today, steps: "4,100" },
        { date: today, steps: "8,423.4", active_kcal: "512.6", distance_km: 6.126 },
      ],
      today,
    );
    expect(r).toEqual({ ok: true, days: [{ date: today, steps: 8423, activeKcal: 513, distanceKm: 6.13 }] });
    expect(parseActivityDays([{ date: today, steps: 0 }], today)).toEqual({ ok: true, days: [{ date: today, steps: 0, activeKcal: null, distanceKm: null }] });
  });

  it("refuses the whole request with readable messages naming the date and field", () => {
    const r = parseActivityDays(
      [
        { date: today, steps: 200000 },
        { date: "2026-11-19", steps: 10 },
        { date: "2026-10-18", steps: 10 },
        { date: "2026-11-17", steps: 10, distance_km: 151 },
      ],
      today,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(formatProblems(r.problems)).toBe(
      "18 Nov: steps must be between 0 and 100,000; 19 Nov: date is in the future; 18 Oct: date is more than 30 days ago; 17 Nov: distance_km must be between 0 and 150",
    );
  });

  it("judges 'today' by the date it is given (the member's local date), never server time", () => {
    // 2026-11-19 is already today in Asia/Kolkata while it is still 2026-11-18 in UTC.
    expect(parseActivityDays([{ date: "2026-11-19", steps: 5 }], "2026-11-19").ok).toBe(true);
    expect(parseActivityDays([{ date: "2026-11-19", steps: 5 }], "2026-11-18").ok).toBe(false);
  });
});

describe("steps board", () => {
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18"];

  it("averages over synced days, counts goal hits over elapsed days, and leaves out members with no data", () => {
    expect(stepsBoardRow(new Map([["2026-11-16", 9000], ["2026-11-18", 6001]]), dates, 8000)).toEqual({ avgSteps: 7501, hitDays: 1, periodDays: 3, syncedDays: 2 });
    expect(stepsBoardRow(new Map([["2026-11-01", 9000]]), dates, 8000)).toBeNull();
  });

  it("ranks by average, ties share a rank", () => {
    const ranked = rankSteps([
      { name: "B", avgSteps: 5000 },
      { name: "A", avgSteps: 9000 },
      { name: "C", avgSteps: 9000 },
    ]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([["A", 1], ["C", 1], ["B", 3]]);
  });

  it("detects a 7-day goal run; an unsynced or short day breaks it", () => {
    const days = new Map(Array.from({ length: 7 }, (_, i) => [`2026-11-${String(12 + i).padStart(2, "0")}`, 8000] as const));
    expect(isStepRun(days, "2026-11-18", 8000)).toBe(true);
    expect(isStepRun(new Map([...days, ["2026-11-15", 7999]]), "2026-11-18", 8000)).toBe(false);
    const gap = new Map(days);
    gap.delete("2026-11-14");
    expect(isStepRun(gap, "2026-11-18", 8000)).toBe(false);
  });
});
