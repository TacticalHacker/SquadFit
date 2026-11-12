import { describe, expect, it } from "vitest";
import {
  HISTORY_MAX_DAYS,
  NOTE_WINDOW_DAYS,
  validateHistoryWindow,
  validateNoteDate,
} from "../src/domain/coach-note";
import { HistoryInputSchema, OverallNoteInputSchema, TargetsInputSchema } from "../src/contracts/coach";

const today = "2026-11-11";

describe("validateNoteDate", () => {
  it("allows today and the 30 days before", () => {
    expect(validateNoteDate("2026-11-11", today)).toBeNull();
    expect(validateNoteDate("2026-10-12", today)).toBeNull();
    expect(NOTE_WINDOW_DAYS).toBe(30);
  });
  it("rejects future, older and invalid dates", () => {
    expect(validateNoteDate("2026-11-12", today)).toMatch(/future/i);
    expect(validateNoteDate("2026-10-11", today)).toMatch(/30 days/);
    expect(validateNoteDate("2026-02-30", today)).toMatch(/YYYY-MM-DD/);
  });
});

describe("validateHistoryWindow", () => {
  it("accepts a window ending today of up to 31 days", () => {
    expect(validateHistoryWindow("2026-11-11", "2026-11-11", today)).toBeNull();
    expect(validateHistoryWindow("2026-10-12", "2026-11-11", today)).toBeNull(); // 31 days inclusive
    expect(HISTORY_MAX_DAYS).toBe(31);
  });
  it("rejects reversed, too long, future and invalid windows", () => {
    expect(validateHistoryWindow("2026-11-11", "2026-11-10", today)).toMatch(/before/);
    expect(validateHistoryWindow("2026-10-11", "2026-11-11", today)).toMatch(/31 days/);
    expect(validateHistoryWindow("2026-11-10", "2026-11-12", today)).toMatch(/future/i);
    expect(validateHistoryWindow("nope", "2026-11-11", today)).toMatch(/YYYY-MM-DD/);
  });
});

describe("TargetsInputSchema", () => {
  it("needs at least one field and validates ranges", () => {
    expect(TargetsInputSchema.safeParse({}).success).toBe(false);
    expect(TargetsInputSchema.safeParse({ dailyCalorieTarget: 2400 }).success).toBe(true);
    expect(TargetsInputSchema.safeParse({ dailyProteinTarget: 130 }).success).toBe(true);
    expect(TargetsInputSchema.safeParse({ dailyProteinTarget: null }).success).toBe(true);
    expect(TargetsInputSchema.safeParse({ dailyCalorieTarget: 499 }).success).toBe(false);
    expect(TargetsInputSchema.safeParse({ dailyCalorieTarget: 2000.5 }).success).toBe(false);
    expect(TargetsInputSchema.safeParse({ dailyProteinTarget: 9 }).success).toBe(false);
    expect(TargetsInputSchema.safeParse({ dailyProteinTarget: 501 }).success).toBe(false);
  });
});

describe("HistoryInputSchema", () => {
  it("requires both dates as strings", () => {
    expect(HistoryInputSchema.safeParse({ startDate: "2026-11-01", endDate: "2026-11-11" }).success).toBe(true);
    expect(HistoryInputSchema.safeParse({ startDate: "2026-11-01" }).success).toBe(false);
  });
});

describe("OverallNoteInputSchema (feature 007)", () => {
  const good = {
    date: "2026-11-11",
    headline: "Chest PR today, protein 30 g short",
    status: "pr_alert",
    highlights: ["Bench 3×8 @ 62.5 kg", "Protein 110/140 g"],
    actionItems: ["Protein shake after dinner"],
  };
  it("accepts a valid note and trims strings", () => {
    const r = OverallNoteInputSchema.parse({ ...good, headline: `  ${good.headline}  ` });
    expect(r.headline).toBe(good.headline);
    expect(OverallNoteInputSchema.safeParse({ ...good, actionItems: [] }).success).toBe(true);
    expect(OverallNoteInputSchema.safeParse({ ...good, headline: "a".repeat(65) }).success).toBe(true);
  });
  it.each([
    ["empty headline", { headline: "  " }],
    ["66-char headline", { headline: "a".repeat(66) }],
    ["multi-line headline", { headline: "one\ntwo" }],
    ["unknown status", { status: "great" }],
    ["no highlights", { highlights: [] }],
    ["4 highlights", { highlights: ["a", "b", "c", "d"] }],
    ["121-char highlight", { highlights: ["a".repeat(121)] }],
    ["blank highlight", { highlights: ["  "] }],
    ["4 action items", { actionItems: ["a", "b", "c", "d"] }],
    ["81-char action", { actionItems: ["a".repeat(81)] }],
    ["blank action", { actionItems: [" "] }],
  ])("rejects %s", (_n, patch) => {
    expect(OverallNoteInputSchema.safeParse({ ...good, ...patch }).success).toBe(false);
  });
});
