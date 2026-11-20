"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DateSchema, SharePostInputSchema, SharePostResultSchema, ShareSummarySchema, type SharePostInput, type SharePostState, type ShareSummary } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Share a workout day (feature 016). The API computes every figure; the photo is only sent when the member opts in. */

const GENERIC = "Couldn't load this workout. Try again.";
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function call<T>(fn: () => Promise<T>, fallback: string): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      return { ok: false, error: err.message || fallback };
    }
    return { ok: false, error: fallback };
  }
}

export async function loadShare(date: string): Promise<Result<ShareSummary>> {
  if (!DateSchema.safeParse(date).success) return { ok: false, error: GENERIC };
  return call(() => apiFetch(`/me/share/${date}`, { schema: ShareSummarySchema }), GENERIC);
}

export async function postShare(date: string, photo: SharePostInput["photo"]): Promise<Result<SharePostState>> {
  const body = SharePostInputSchema.safeParse({ photo });
  if (!DateSchema.safeParse(date).success || !body.success) return { ok: false, error: "Couldn't post. Try again." };
  const r = await call(() => apiFetch(`/squad/posts/${date}`, { method: "PUT", body: body.data, schema: SharePostResultSchema }), "Couldn't post. Try again.");
  if (!r.ok) return r;
  revalidatePath("/squad", "layout");
  return { ok: true, value: r.value.post };
}

export async function removePost(date: string): Promise<Result<SharePostState>> {
  if (!DateSchema.safeParse(date).success) return { ok: false, error: "Couldn't remove the post. Try again." };
  const r = await call(() => apiFetch(`/squad/posts/${date}`, { method: "DELETE", schema: SharePostResultSchema }), "Couldn't remove the post. Try again.");
  if (!r.ok) return r;
  revalidatePath("/squad", "layout");
  return { ok: true, value: r.value.post };
}
