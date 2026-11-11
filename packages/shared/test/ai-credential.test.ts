import { describe, expect, it } from "vitest";
import { generateToken, hashToken, parseBearer } from "../src/domain/ai-credential";

describe("ai credential", () => {
  it("generates sfk_ + 43 base64url chars, unique each time", () => {
    const a = generateToken();
    expect(a).toMatch(/^sfk_[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });

  it("hashes to SHA-256 hex deterministically", () => {
    expect(hashToken("sfk_abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("sfk_abc")).toBe(hashToken("sfk_abc"));
    expect(hashToken("sfk_abd")).not.toBe(hashToken("sfk_abc"));
  });

  it("parses only `Bearer sfk_...` headers", () => {
    const t = generateToken();
    expect(parseBearer(`Bearer ${t}`)).toBe(t);
    expect(parseBearer(`bearer ${t}`)).toBe(t);
    expect(parseBearer(t)).toBeNull();
    expect(parseBearer("Bearer abc")).toBeNull();
    expect(parseBearer("Bearer sfk_short")).toBeNull();
    expect(parseBearer(`Basic ${t}`)).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
  });
});
