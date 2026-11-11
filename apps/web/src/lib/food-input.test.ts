import { describe, expect, it } from "vitest";
import { parseCaloriesInput, parseGramsInput } from "./food-input";

const CAL = "Calories must be a whole number from 1 to 5,000";
const GRAMS = "Grams must be from 0 to 500 with at most one decimal";

describe("parseCaloriesInput", () => {
  it("accepts whole calories in range", () => {
    expect(parseCaloriesInput("650")).toEqual({ ok: true, value: 650 });
    expect(parseCaloriesInput(" 5000 ")).toEqual({ ok: true, value: 5000 });
  });
  it.each(["", "0", "5001", "99.5", "abc", "4e3", "-3"])("rejects %j", (raw) => {
    expect(parseCaloriesInput(raw)).toEqual({ ok: false, error: CAL });
  });
});

describe("parseGramsInput", () => {
  it("blank means not entered", () => {
    expect(parseGramsInput("")).toEqual({ ok: true, value: undefined });
    expect(parseGramsInput("  ")).toEqual({ ok: true, value: undefined });
  });
  it("accepts 0-500 with one decimal", () => {
    expect(parseGramsInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseGramsInput("12.5")).toEqual({ ok: true, value: 12.5 });
    expect(parseGramsInput("500")).toEqual({ ok: true, value: 500 });
  });
  it.each(["-1", "500.1", "12.34", "abc", "1e2"])("rejects %j", (raw) => {
    expect(parseGramsInput(raw)).toEqual({ ok: false, error: GRAMS });
  });
});
