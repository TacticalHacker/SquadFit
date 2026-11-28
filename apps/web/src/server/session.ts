import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { MeResponseSchema, type OwnProfile } from "@calci/shared";
import { apiFetch, UnauthorizedError } from "./api";

/**
 * Data access layer for "who is signed in". Memoised per request with React `cache()`:
 * a cross-request cache here would serve a stale `profile: null` right after setup (analysis U2).
 * Must be called inside a <Suspense> boundary (it reads cookies; Cache Components).
 */
export const getMe = cache(async () => {
  try {
    return await apiFetch("/me", { schema: MeResponseSchema });
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    throw err;
  }
});

/** Signed in AND profile complete (FR-011); otherwise redirects. */
export async function requireProfile(): Promise<{ username: string; userId: string; profile: OwnProfile }> {
  const me = await getMe();
  if (!me.profile) redirect("/setup");
  return { username: me.username, userId: me.userId, profile: me.profile };
}

/** For /setup: signed in but profile not yet complete. */
export async function requireNoProfile(): Promise<{ username: string }> {
  const me = await getMe();
  if (me.profile) redirect("/workouts/gym");
  return { username: me.username };
}
