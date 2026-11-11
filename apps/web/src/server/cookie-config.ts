/**
 * Pure helpers for the session cookies (spec 001 research R3). No Next.js imports so they are unit-testable.
 *
 *  sf_at  access token   — lives until the token's own exp (60 min)
 *  sf_rt  refresh token  — 30 days, re-issued on every request (sliding inactivity window, FR-005)
 *  sf_ch  password challenge {username, session} — 3 minutes
 */
export const COOKIE = { access: "sf_at", refresh: "sf_rt", challenge: "sf_ch" } as const;

export const REFRESH_MAX_AGE_S = 30 * 24 * 60 * 60;
export const CHALLENGE_MAX_AGE_S = 180;
/** Refresh the access token when it has less than this left. */
export const ACCESS_REFRESH_MARGIN_S = 60;

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge?: number;
}

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

export const accessCookieOptions = (exp: number): CookieOptions => ({
  ...base(),
  maxAge: Math.max(1, exp - Math.floor(Date.now() / 1000)),
});
export const refreshCookieOptions = (): CookieOptions => ({ ...base(), maxAge: REFRESH_MAX_AGE_S });
export const challengeCookieOptions = (): CookieOptions => ({ ...base(), maxAge: CHALLENGE_MAX_AGE_S });

/** Reads `exp` (seconds) from a JWT payload WITHOUT verifying it: API Gateway verifies on every call. 0 if unreadable. */
export function jwtExp(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const exp = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : 0;
  } catch {
    return 0;
  }
}

export function isExpiringSoon(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  return jwtExp(accessToken) - Math.floor(Date.now() / 1000) < ACCESS_REFRESH_MARGIN_S;
}

/** Return a Cookie request-header value with `name` set to `value` (replacing any existing one). */
export function withCookie(cookieHeader: string, name: string, value: string): string {
  const kept = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${name}=`));
  return [...kept, `${name}=${value}`].join("; ");
}

/** Only same-site relative paths survive; anything else (//host, /\host, absolute URLs) becomes "/". */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !/^\/(?![/\\])/.test(next)) return "/";
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const decoded = decodeURIComponent(next);
    if (/^\/[/\\]/.test(decoded)) return "/";
  } catch {
    return "/";
  }
  return next;
}
