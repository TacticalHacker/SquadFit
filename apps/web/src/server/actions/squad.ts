"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateSchema, HighFiveResultSchema, SquadSettingsSchema, type HighFiveResult } from "@calci/shared";
import { z } from "zod";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";
import type { ActionState } from "./state";

/** Squad leaderboard actions (feature 010). Input is re-validated here; the API is the authority. */

const GENERIC = "Couldn't save. Check your connection and try again.";

async function call<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      return { ok: false, error: err.message || GENERIC, ...(err.fields ? { fields: err.fields } : {}) };
    }
    return { ok: false, error: GENERIC };
  }
}

/** Settings: weekly target, show me on the leaderboard, share body weight. */
export async function saveSquadSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SquadSettingsSchema.safeParse({
    weeklyTarget: Number(formData.get("weeklyTarget")),
    leaderboardVisible: formData.get("leaderboardVisible") === "on",
    shareBodyWeight: formData.get("shareBodyWeight") === "on",
  });
  if (!parsed.success) return { error: "Choose a weekly target from 1 to 7" };
  const r = await call(() => apiFetch("/me/squad", { method: "PUT", body: parsed.data, schema: SquadSettingsSchema }));
  if (!r.ok) return { error: r.error, ...(r.fields ? { fields: r.fields } : {}) };
  // The target and visibility change what the boards, the feed and the Workouts streak show.
  revalidatePath("/squad");
  revalidatePath("/workouts", "layout");
  return { message: "Saved" };
}

export type HighFiveActionResult = ({ ok: true } & HighFiveResult) | { ok: false; error: string };

/** Add or take back the caller's high-five on a feed item. */
export async function toggleHighFive(id: string, on: boolean): Promise<HighFiveActionResult> {
  if (!z.string().min(3).max(300).safeParse(id).success) return { ok: false, error: GENERIC };
  const r = await call(() =>
    apiFetch(`/squad/feed/${encodeURIComponent(id)}/high-five`, { method: on ? "PUT" : "DELETE", schema: HighFiveResultSchema }),
  );
  if (!r.ok) return r;
  revalidatePath("/squad");
  return { ok: true, ...r.value };
}

const ID_RE = /^g[xc]-[A-Za-z0-9-]+$/;

/** "Looks right" on an unusual jump: the set then counts toward PRs and the Lift board. */
export async function confirmJump(date: string, exerciseId: string, updatedAt: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!DateSchema.safeParse(date).success || !ID_RE.test(exerciseId) || !z.iso.datetime().safeParse(updatedAt).success) {
    return { ok: false, error: GENERIC };
  }
  const r = await call(() =>
    apiFetch(`/workouts/gym/entries/${date}/${encodeURIComponent(exerciseId)}/confirm`, {
      method: "PUT",
      body: { updatedAt },
      schema: z.object({ ok: z.literal(true) }),
    }),
  );
  if (!r.ok) return r;
  revalidatePath("/workouts/gym");
  revalidatePath("/squad");
  return { ok: true };
}
