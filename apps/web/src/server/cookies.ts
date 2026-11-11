import "server-only";
import { cookies } from "next/headers";
import {
  accessCookieOptions,
  challengeCookieOptions,
  COOKIE,
  jwtExp,
  refreshCookieOptions,
} from "./cookie-config";

export async function setSessionCookies(tokens: { accessToken: string; refreshToken?: string }) {
  const jar = await cookies();
  jar.set(COOKIE.access, tokens.accessToken, accessCookieOptions(jwtExp(tokens.accessToken)));
  if (tokens.refreshToken) jar.set(COOKIE.refresh, tokens.refreshToken, refreshCookieOptions());
  jar.delete(COOKIE.challenge);
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of Object.values(COOKIE)) jar.delete(name);
}

export async function setChallengeCookie(username: string, session: string) {
  (await cookies()).set(COOKIE.challenge, JSON.stringify({ username, session }), challengeCookieOptions());
}

export async function readChallenge(): Promise<{ username: string; session: string } | null> {
  const raw = (await cookies()).get(COOKIE.challenge)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { username?: unknown; session?: unknown };
    return typeof v.username === "string" && typeof v.session === "string"
      ? { username: v.username, session: v.session }
      : null;
  } catch {
    return null;
  }
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE.access)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE.refresh)?.value;
}
