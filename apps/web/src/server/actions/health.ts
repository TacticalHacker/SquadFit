"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HealthTokenIssuedSchema, StepSettingsSchema } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";
import type { ActionState } from "./state";

/** Apple Health sync actions (feature 012). The token is returned to the browser once and never stored here. */

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

export type IssueResult = { ok: true; token: string } | { ok: false; error: string };

/** Generate or regenerate the Health sync token; the previous one stops working at once. */
export async function issueHealthToken(): Promise<IssueResult> {
  const r = await call(() => apiFetch("/me/health-token", { method: "POST", schema: HealthTokenIssuedSchema }));
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/settings");
  return { ok: true, token: r.value.token };
}

export async function revokeHealthToken(): Promise<{ ok: boolean; error?: string }> {
  const r = await call(() => apiFetch("/me/health-token", { method: "DELETE", schema: z.undefined() }));
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/settings");
  return { ok: true };
}

/** Daily step goal and "Share my steps". */
export async function saveStepSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = StepSettingsSchema.safeParse({
    dailyStepGoal: Number(String(formData.get("dailyStepGoal") ?? "").replace(/[,\s]/g, "")),
    shareSteps: formData.get("shareSteps") === "on",
  });
  if (!parsed.success) return { error: "Step goal must be a whole number from 1,000 to 50,000", fields: { dailyStepGoal: "Use 1,000 to 50,000" } };
  const r = await call(() => apiFetch("/me/steps", { method: "PUT", body: parsed.data, schema: StepSettingsSchema }));
  if (!r.ok) return { error: r.error, ...(r.fields ? { fields: r.fields } : {}) };
  revalidatePath("/settings");
  revalidatePath("/squad", "layout");
  return { message: "Saved" };
}
