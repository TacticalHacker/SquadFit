import { describe, expect, it } from "vitest";
import { DAILY_GOAL_MINUTES, currentStreak, goalProgress } from "../src/domain/streak";

const day = (date: string, totalMinutes: number) => ({ date, totalMinutes, totalCalories: totalMinutes * 5 });

describe("currentStreak (provisional rule: consecutive days with at least one workout)", () => {
  it("counts back from today", () => {
    const days = [day("2026-11-09", 30), day("2026-11-10", 15), day("2026-11-11", 40)];
    expect(currentStreak(days, "2026-11-11")).toBe(3);
  });
  it("is not broken by an empty today (the day isn't over)", () => {
    const days = [day("2026-11-09", 30), day("2026-11-10", 15), day("2026-11-11", 0)];
    expect(currentStreak(days, "2026-11-11")).toBe(2);
  });
  it("stops at the first empty day before that", () => {
    const days = [day("2026-11-08", 20), day("2026-11-09", 0), day("2026-11-10", 15), day("2026-11-11", 40)];
    expect(currentStreak(days, "2026-11-11")).toBe(2);
  });
  it("is 0 when today and yesterday are empty, or there is no data", () => {
    expect(currentStreak([day("2026-11-10", 0), day("2026-11-11", 0)], "2026-11-11")).toBe(0);
    expect(currentStreak([], "2026-11-11")).toBe(0);
  });
});

describe("goalProgress", () => {
  it("is a 0..1 fraction of the daily goal and flags a met goal", () => {
    expect(DAILY_GOAL_MINUTES).toBe(30);
    expect(goalProgress(0)).toEqual({ fraction: 0, met: false });
    expect(goalProgress(15)).toEqual({ fraction: 0.5, met: false });
    expect(goalProgress(30)).toEqual({ fraction: 1, met: true });
    expect(goalProgress(90)).toEqual({ fraction: 1, met: true });
  });
});
