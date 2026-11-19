"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DayLogSchema,
  DateSchema,
  NutritionSharingSchema,
  ReactionResultSchema,
  ReactionTypeSchema,
  SquadSettingsSchema,
  TimelineSchema,
  type DayLog,
  type ReactionType,
  type Reactions,
  type Timeline,
} from "@calci/shared";
import { requireProfile } from "../session";
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
    nutritionSharing: formData.get("nutritionSharing") ?? "off",
  });
  if (!parsed.success) return { error: "Choose a weekly target from 1 to 7" };
  const r = await call(() => apiFetch("/me/squad", { method: "PUT", body: parsed.data, schema: SquadSettingsSchema }));
  if (!r.ok) return { error: r.error, ...(r.fields ? { fields: r.fields } : {}) };
  // The target and visibility change what the boards, the feed and the Workouts streak show.
  revalidatePath("/squad");
  revalidatePath("/workouts", "layout");
  return { message: "Saved" };
}

/** Add or take back one of the caller's reactions on a feed item or workout day (feature 013). */
export async function toggleReaction(id: string, type: ReactionType, on: boolean): Promise<{ ok: true; reactions: Reactions } | { ok: false; error: string }> {
  if (!z.string().min(3).max(300).safeParse(id).success || !ReactionTypeSchema.safeParse(type).success) return { ok: false, error: GENERIC };
  const r = await call(() =>
    apiFetch(`/squad/feed/${encodeURIComponent(id)}/reactions/${type}`, { method: on ? "PUT" : "DELETE", schema: ReactionResultSchema }),
  );
  if (!r.ok) return r;
  revalidatePath("/squad", "layout");
  return { ok: true, reactions: r.value.reactions };
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

/** The one-time card on /squad: pick a sharing level, or "dismiss" to keep Off and stop asking (feature 011, FR-026). */
export async function saveNutritionSharing(choice: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const level = NutritionSharingSchema.safeParse(choice);
  if (!level.success && choice !== "dismiss") return { ok: false, error: GENERIC };
  const { profile } = await requireProfile();
  const { weeklyTarget, leaderboardVisible, shareBodyWeight } = profile.squad;
  const r = await call(() =>
    apiFetch("/me/squad", {
      method: "PUT",
      body: { weeklyTarget, leaderboardVisible, shareBodyWeight, ...(level.success ? { nutritionSharing: level.data } : { dismissPrompt: true }) },
      schema: SquadSettingsSchema,
    }),
  );
  if (!r.ok) return r;
  revalidatePath("/squad");
  return { ok: true };
}

const MEMBER_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Lazy set-by-set log of one day (leaderboard rows and profile day cards). The API enforces visibility and sharing. */
export async function loadDay(memberId: string, date: string): Promise<{ ok: true; log: DayLog } | { ok: false; error: string }> {
  if (!MEMBER_ID.test(memberId) || !DateSchema.safeParse(date).success) return { ok: false, error: GENERIC };
  const r = await call(() => apiFetch(`/squad/members/${memberId}/days/${date}`, { schema: DayLogSchema }));
  return r.ok ? { ok: true, log: r.value } : { ok: false, error: r.error };
}

/** The next page of a member's timeline. */
export async function loadTimeline(memberId: string, cursor: string): Promise<{ ok: true; data: Timeline } | { ok: false; error: string }> {
  if (!MEMBER_ID.test(memberId) || !DateSchema.safeParse(cursor).success) return { ok: false, error: GENERIC };
  const r = await call(() => apiFetch(`/squad/members/${memberId}/timeline?cursor=${cursor}`, { schema: TimelineSchema }));
  return r.ok ? { ok: true, data: r.value } : { ok: false, error: r.error };
}
