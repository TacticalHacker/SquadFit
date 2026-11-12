import { describe, expect, it } from "vitest";
import { formatLogId, parseLogId } from "../src/domain/log-id";

describe("formatLogId / parseLogId", () => {
  it("formats date#id and round-trips", () => {
    expect(formatLogId("2026-11-12", "gx-bench-press")).toBe("2026-11-12#gx-bench-press");
    expect(parseLogId("2026-11-12#gx-bench-press")).toEqual({ date: "2026-11-12", id: "gx-bench-press" });
    expect(parseLogId(formatLogId("2026-01-31", "01JABC_x-9"))).toEqual({ date: "2026-01-31", id: "01JABC_x-9" });
  });
  it("rejects malformed ids", () => {
    for (const bad of [
      "",
      "2026-11-12",
      "2026-11-12#",
      "#gx-bench",
      "2026-02-30#gx-bench",
      "12-11-2026#gx-bench",
      "2026-11-12#gx bench",
      "2026-11-12#a#b",
      `2026-11-12#${"a".repeat(81)}`,
    ]) {
      expect(parseLogId(bad), bad).toBeNull();
    }
  });
  it("accepts an 80-char id", () => {
    expect(parseLogId(`2026-11-12#${"a".repeat(80)}`)).not.toBeNull();
  });
});
