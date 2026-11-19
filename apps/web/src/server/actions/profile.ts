"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MeResponseSchema, MeTargetsInputSchema, ProfileInputSchema } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";
import type { ActionState } from "./state";

const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");

async function guard<T>(fn: () => Promise<T>): Promise<T | ActionState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      return { error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    }
    throw err;
  }
}

/**
 * Create (first time, then go Home) or update the profile; optionally attach a new avatar that the
 * browser already resized to 256px WebP (research R6).
 */
export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawTarget = str(formData, "dailyCalorieTarget").trim();
  const rawProtein = str(formData, "dailyProteinTarget").trim();
  // Only the settings form has the field: absent keeps the stored weight, blank clears it (feature 007).
  const rawWeight = formData.has("bodyWeightKg") ? str(formData, "bodyWeightKg").trim() : undefined;
  const parsed = ProfileInputSchema.safeParse({
    displayName: str(formData, "displayName"),
    timezone: str(formData, "timezone"),
    dailyCalorieTarget: rawTarget === "" ? Number.NaN : Number(rawTarget),
    // Optional: blank clears the protein target.
    dailyProteinTarget: rawProtein === "" ? null : Number(rawProtein),
    ...(rawWeight === undefined ? {} : { bodyWeightKg: rawWeight === "" ? null : Number(rawWeight.replace(",", ".")) }),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".")] ??= issue.message;
    return { fields };
  }

  const isFirstSave = str(formData, "mode") === "setup";
  const avatarBase64 = str(formData, "avatarBase64");

  const outcome = await guard(async () => {
    await apiFetch("/me/profile", { method: "PUT", body: parsed.data, schema: MeResponseSchema });
    if (avatarBase64) {
      await apiFetch("/me/avatar", {
        method: "PUT",
        body: { contentType: "image/webp", dataBase64: avatarBase64 },
        schema: MeResponseSchema,
      });
    }
    return null;
  });
  if (outcome) return outcome;

  revalidatePath("/", "layout");
  if (isFirstSave) redirect("/workouts/gym");
  return { message: "Saved" };
}

export async function removeAvatar(): Promise<void> {
  const outcome = await guard(() => apiFetch("/me/avatar", { method: "DELETE", schema: MeResponseSchema }));
  void outcome;
  revalidatePath("/", "layout");
}

/** Feature 013: the "Set your daily goals" prompt. Saving confirms the targets so the squad may see them. */
export async function saveTargets(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawProtein = str(formData, "dailyProteinTarget").trim();
  const parsed = MeTargetsInputSchema.safeParse({
    dailyCalorieTarget: Number(str(formData, "dailyCalorieTarget").trim() || Number.NaN),
    dailyProteinTarget: rawProtein === "" ? null : Number(rawProtein),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.at(-1);
      if (typeof key === "string" && key !== "dismiss") fields[key] ??= issue.message;
    }
    return { fields: Object.keys(fields).length ? fields : { dailyCalorieTarget: "Enter your daily calorie goal" } };
  }
  const outcome = await guard(() => apiFetch("/me/targets", { method: "PUT", body: parsed.data, schema: MeResponseSchema }));
  if (!("profile" in outcome)) return outcome;
  revalidatePath("/", "layout");
  return { message: "Saved" };
}

/** Hide the prompt without confirming; Settings still shows that the goals are not confirmed. */
export async function dismissTargetsPrompt(): Promise<void> {
  await guard(() => apiFetch("/me/targets", { method: "PUT", body: { dismiss: true }, schema: MeResponseSchema }));
  revalidatePath("/", "layout");
}
