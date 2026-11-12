import { NextResponse, type NextRequest } from "next/server";
import { refreshAccessToken } from "@/server/cognito";
import {
  accessCookieOptions,
  COOKIE,
  isExpiringSoon,
  jwtExp,
  refreshCookieOptions,
  withCookie,
} from "@/server/cookie-config";

/**
 * Optimistic gate + token refresh (spec 001 research R3). The authoritative check is the data access
 * layer in src/server/session.ts, and API Gateway verifies the token on every API call.
 */
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-in/new-password"]);
/** Where members land (feature 006 made Gym the default tab; feature 009 made `/` the public landing page). */
const HOME = "/workouts/gym";

function toSignIn(request: NextRequest, clearCookies: boolean) {
  const url = new URL("/sign-in", request.url);
  if (request.method === "GET") {
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== "/") url.searchParams.set("next", target);
  }
  const res = NextResponse.redirect(url);
  if (clearCookies) for (const name of [COOKIE.access, COOKIE.refresh]) res.cookies.delete(name);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value;

  if (!refreshToken) return isPublic ? NextResponse.next() : toSignIn(request, false);

  let accessToken = request.cookies.get(COOKIE.access)?.value;
  let refreshed = false;
  if (isExpiringSoon(accessToken)) {
    const result = await refreshAccessToken(refreshToken);
    if (result.kind !== "tokens") {
      // Refresh token revoked/expired: signed out.
      if (isPublic) {
        const res = NextResponse.next();
        for (const name of [COOKIE.access, COOKIE.refresh]) res.cookies.delete(name);
        return res;
      }
      return toSignIn(request, true);
    }
    accessToken = result.accessToken;
    refreshed = true;
  }

  // A signed-in member skips the landing page and the sign-in page (feature 009, research R1).
  if (pathname === "/" || pathname === "/sign-in") return NextResponse.redirect(new URL(HOME, request.url));

  // Make the fresh token visible to THIS request's Server Components/Actions, not just the next one (analysis U1).
  const headers = new Headers(request.headers);
  if (refreshed && accessToken) {
    headers.set("cookie", withCookie(request.headers.get("cookie") ?? "", COOKIE.access, accessToken));
  }
  const response = NextResponse.next({ request: { headers } });

  // Server Actions (sign-out, password change) manage cookies themselves; don't race them with Set-Cookie here.
  const isServerAction = request.headers.has("next-action");
  if (!isServerAction) {
    if (refreshed && accessToken) {
      response.cookies.set(COOKIE.access, accessToken, accessCookieOptions(jwtExp(accessToken)));
    }
    // Sliding window: 30 days of inactivity, not 30 days since sign-in (FR-005).
    response.cookies.set(COOKIE.refresh, refreshToken, refreshCookieOptions());
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
