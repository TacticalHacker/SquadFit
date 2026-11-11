import { describe, expect, it } from "vitest";
import {
  ACCESS_REFRESH_MARGIN_S,
  accessCookieOptions,
  challengeCookieOptions,
  COOKIE,
  isExpiringSoon,
  jwtExp,
  REFRESH_MAX_AGE_S,
  refreshCookieOptions,
  safeNextPath,
  withCookie,
} from "./cookie-config";

const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("cookie options", () => {
  it("are httpOnly, lax, path=/ (research R3)", () => {
    for (const o of [accessCookieOptions(9999999999), refreshCookieOptions(), challengeCookieOptions()]) {
      expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    }
  });
  it("refresh lasts 30 days, challenge 3 minutes", () => {
    expect(refreshCookieOptions().maxAge).toBe(30 * 24 * 3600);
    expect(REFRESH_MAX_AGE_S).toBe(30 * 24 * 3600);
    expect(challengeCookieOptions().maxAge).toBe(180);
  });
  it("access cookie lives until the token's exp", () => {
    const now = Math.floor(Date.now() / 1000);
    const age = accessCookieOptions(now + 3600).maxAge ?? 0;
    expect(age).toBeGreaterThan(3590);
    expect(age).toBeLessThanOrEqual(3600);
  });
  it("names are stable", () => {
    expect(COOKIE).toEqual({ access: "sf_at", refresh: "sf_rt", challenge: "sf_ch" });
  });
});

describe("jwtExp / isExpiringSoon", () => {
  it("reads exp from the payload", () => {
    expect(jwtExp(jwt({ exp: 1234 }))).toBe(1234);
  });
  it("returns 0 for garbage", () => {
    expect(jwtExp("nope")).toBe(0);
    expect(jwtExp("a.b.c")).toBe(0);
  });
  it("treats missing, garbage and near-expiry tokens as expiring", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isExpiringSoon(undefined)).toBe(true);
    expect(isExpiringSoon("garbage")).toBe(true);
    expect(isExpiringSoon(jwt({ exp: now + ACCESS_REFRESH_MARGIN_S - 5 }))).toBe(true);
    expect(isExpiringSoon(jwt({ exp: now + 3000 }))).toBe(false);
  });
});

describe("withCookie (forwarding a refreshed token to the same request, analysis U1)", () => {
  it("replaces an existing cookie and keeps others", () => {
    expect(withCookie("a=1; sf_at=old; b=2", "sf_at", "new")).toBe("a=1; b=2; sf_at=new");
  });
  it("adds a cookie when absent or when the header is empty", () => {
    expect(withCookie("a=1", "sf_at", "new")).toBe("a=1; sf_at=new");
    expect(withCookie("", "sf_at", "new")).toBe("sf_at=new");
  });
  it("does not touch cookies whose names merely contain the name", () => {
    expect(withCookie("xsf_at=keep; sf_at=old", "sf_at", "new")).toBe("xsf_at=keep; sf_at=new");
  });
});

describe("safeNextPath (analysis U4: no open redirects)", () => {
  it.each(["/people", "/settings?tab=1", "/"])("allows %s", (p) => expect(safeNextPath(p)).toBe(p));
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, undefined, "/%2F%2Fevil.com"])(
    "falls back to / for %j",
    (p) => expect(safeNextPath(p)).toBe("/"),
  );
  it("never allows control characters", () => {
    expect(safeNextPath("/a\r\nSet-Cookie: x=1")).toBe("/");
  });
});
