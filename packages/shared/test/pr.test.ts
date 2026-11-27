import { describe, expect, it } from "vitest";
import { addToBests, bestsBefore, EMPTY_BESTS, previewPr, type PrBase } from "../src/domain/pr";

const bench = addToBests(EMPTY_BESTS, [{ weightKg: 80, reps: 8 }], "2026-11-25");
const one = (weightKg: number, reps: number) => previewPr(bench, [{ weightKg, reps }]);

describe("PR rules (spec acceptance table, best 80 × 8)", () => {
  it.each([
    [82.5, 5, { type: "weight", value: 82.5, gain: 2.5, bigJump: false }],
    [80, 10, { type: "reps", value: 10, gain: 2 }],
    [77.5, 12, { type: "reps", value: 12, gain: 4 }],
    [125, 3, { type: "weight", gain: 45, bigJump: true }],
    [110, 3, { type: "weight", gain: 30, bigJump: false }],
  ] as const)("%s kg × %s", (w, r, expected) => {
    expect(one(w, r)).toMatchObject(expected);
  });

  it.each([
    [60, 15],
    [80, 8],
    [0, 12],
  ])("%s kg × %s is not a PR", (w, r) => expect(one(w, r)).toBeNull());

  it("gives no PR on the first session (baseline)", () => {
    expect(previewPr(EMPTY_BESTS, [{ weightKg: 100, reps: 5 }])).toBeNull();
  });

  it("counts an estimate PR only for 1–10 reps", () => {
    const heavy = addToBests(EMPTY_BESTS, [{ weightKg: 100, reps: 2 }], "2026-11-25"); // ~106.7
    expect(previewPr(heavy, [{ weightKg: 75, reps: 10 }])).toBeNull(); // below 80% of 100, estimate 100
    expect(previewPr(heavy, [{ weightKg: 95, reps: 5 }])).toMatchObject({ type: "reps" });
    expect(previewPr(heavy, [{ weightKg: 70, reps: 12 }])).toBeNull();
  });

  it("shows the top PR of several sets", () => {
    expect(previewPr(bench, [{ weightKg: 80, reps: 10 }, { weightKg: 82.5, reps: 5 }])).toMatchObject({ type: "weight", setIndex: 1 });
  });

  it("keeps a frontier of the most reps at or above each weight", () => {
    const b = addToBests(bench, [{ weightKg: 70, reps: 12 }, { weightKg: 60, reps: 10 }], "2026-11-26");
    expect(b.frontier).toEqual([{ weightKg: 80, reps: 8 }, { weightKg: 70, reps: 12 }]);
    expect(b.sessions).toBe(2);
  });
});

describe("bestsBefore", () => {
  const before = { "2026-11-25": EMPTY_BESTS, "2026-11-27": bench };
  const base: PrBase = { all: bench, before, complete: true };

  it("uses the snapshot of the day, the next kept day, or everything", () => {
    expect(bestsBefore(base, "2026-11-27")).toBe(bench);
    expect(bestsBefore(base, "2026-11-26")).toBe(bench);
    expect(bestsBefore(base, "2026-11-28")).toBe(bench);
    expect(bestsBefore(base, "2026-11-20")).toBe(EMPTY_BESTS);
  });

  it("can't tell for a day older than every kept entry when older entries exist", () => {
    expect(bestsBefore({ ...base, complete: false }, "2026-11-20")).toBeNull();
    expect(bestsBefore(undefined, "2026-11-27")).toBeNull();
  });
});
