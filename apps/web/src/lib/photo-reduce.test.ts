import { describe, expect, it } from "vitest";
import { fitWithin, MAX_EDGE, nextQuality } from "./photo-reduce";

describe("fitWithin", () => {
  it("shrinks the long edge to the limit and keeps the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
  it("uses a 1280 px default edge", () => {
    expect(MAX_EDGE).toBe(1280);
  });
});

describe("nextQuality", () => {
  it("steps quality down while the file is over the limit, then stops at the floor", () => {
    expect(nextQuality(2_000_000, 1_500_000, 0.85)).toBeCloseTo(0.75);
    expect(nextQuality(1_000_000, 1_500_000, 0.85)).toBeNull(); // fits
    expect(nextQuality(2_000_000, 1_500_000, 0.35)).toBeNull(); // cannot go lower
  });
});
