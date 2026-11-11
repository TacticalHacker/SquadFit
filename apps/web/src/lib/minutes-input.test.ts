import { describe, expect, it } from "vitest";
import { parseMinutesInput } from "./minutes-input";

const MSG = "Minutes must be a whole number from 1 to 600";

describe("parseMinutesInput", () => {
  it("accepts whole minutes in range", () => {
    expect(parseMinutesInput("45")).toEqual({ ok: true, minutes: 45 });
    expect(parseMinutesInput(" 600 ")).toEqual({ ok: true, minutes: 600 });
  });
  it.each(["", "0", "601", "12.5", "abc", "4e1", "-3"])("rejects %j", (raw) => {
    expect(parseMinutesInput(raw)).toEqual({ ok: false, error: MSG });
  });
});
