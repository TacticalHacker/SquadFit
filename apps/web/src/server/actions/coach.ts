"use server";

import { redirect } from "next/navigation";
import { CoachActionPutSchema, CoachActionsResponseSchema, DateSchema, MAX_ACTIONS, type CoachActionsResponse } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Tick or untick one action item of the day's AI coach note (feature 007, FR-017). */
export type CoachActionResult =
  | { ok: true; actions: CoachActionsResponse["actions"] }
  | { ok: false; conflict: boolean; error: string };

const GENERIC = "Couldn't save, try again";

export async function setCoachAction(date: string, index: number, done: boolean, noteUpdatedAt: string): Promise<CoachActionResult> {
  const body = CoachActionPutSchema.safeParse({ done, noteUpdatedAt });
  if (!DateSchema.safeParse(date).success || !Number.isInteger(index) || index < 0 || index >= MAX_ACTIONS || !body.success) {
    return { ok: false, conflict: false, error: GENERIC };
  }
  try {
    const r = await apiFetch(`/coach-note/${date}/actions/${index}`, { method: "PUT", body: body.data, schema: CoachActionsResponseSchema });
    return { ok: true, actions: r.actions };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      // 404 (note gone) and 409 (note replaced) both mean the page is stale.
      if (err.status === 409 || err.status === 404) return { ok: false, conflict: true, error: "This note was updated; refresh" };
    }
    return { ok: false, conflict: false, error: GENERIC };
  }
}
