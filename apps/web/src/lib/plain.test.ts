import { describe, expect, it } from "vitest";
import { isDumbbell, setSummary, weekCompare, weeksInARow } from "./plain";

const s = (weightKg: number, reps: number, completed = true) => ({ weightKg, reps, completed });

describe("plain wording", () => {
  it("summarises sets the way a non-lifter reads them", () => {
    expect(setSummary([s(15, 10), s(15, 10), s(15, 10)], false)).toBe("3 sets of 10 reps at 15 kg");
    expect(setSummary([s(25, 10), s(30, 10), s(35, 10)], false)).toBe("3 sets · 25 kg → 30 kg → 35 kg · 10 reps each");
    expect(setSummary([s(25, 12), s(30, 10), s(35, 8), s(40, 1, false)], false)).toBe("3 sets · 25 kg → 30 kg → 35 kg · 12, 10, 8 reps");
    expect(setSummary([s(15, 12), s(15, 10)], true)).toBe("2 sets at 15 kg per dumbbell · 12, 10 reps");
    expect(setSummary([s(20, 5, false)], false)).toBe("No sets finished");
  });

  it("compares this week's weight lifted with last week", () => {
    expect(weekCompare(1080, 1000)).toBe("8% more than last week");
    expect(weekCompare(500, 1000)).toBe("50% less than last week so far");
    expect(weekCompare(1000, 1000)).toBe("Same as last week");
    expect(weekCompare(800, 0)).toBeNull();
  });

  it("hides a zero streak and knows dumbbell lifts", () => {
    expect(weeksInARow(0)).toBe("");
    expect(weeksInARow(1)).toBe("1 week in a row");
    expect(isDumbbell("gx-incline-dumbbell-press", "Incline Dumbbell Press")).toBe(true);
    expect(isDumbbell("gx-hammer-curl", "Hammer Curl")).toBe(true);
    expect(isDumbbell("gx-bench-press", "Bench Press")).toBe(false);
  });
});
