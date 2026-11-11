"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DateSchema,
  EntryCreateSchema,
  EntryPatchSchema,
  FoodDayViewSchema,
  OwnFoodInputSchema,
  OwnFoodResponseSchema,
  PhotoEntryCreateSchema,
  type EntryCreate,
  type PhotoEntryCreate,
  type EntryPatch,
  type FoodDayView,
} from "@calci/shared";
import { z } from "zod";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";
import type { ActionState } from "./state";

export type FoodResult = { ok: true; view: FoodDayView } | { ok: false; error: string; fields?: Record<string, string> };

const GENERIC = "Couldn't save. Try again.";
const ENTRY_ID = /^\d{13}-[0-9a-f]{6}$/;

async function run(fn: () => Promise<FoodDayView>): Promise<FoodResult> {
  try {
    return { ok: true, view: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      if (err.code === "DAY_LOCKED") return { ok: false, error: "This day can no longer be edited" };
      if (err.code === "NOT_FOUND") return { ok: false, error: "That entry was already removed" };
      const first = err.fields ? Object.values(err.fields)[0] : undefined;
      return { ok: false, error: first ?? GENERIC, ...(err.fields ? { fields: err.fields } : {}) };
    }
    return { ok: false, error: GENERIC };
  }
}

function fieldErrors(error: z.ZodError): { ok: false; error: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  return { ok: false, error: Object.values(fields)[0] ?? GENERIC, fields };
}

/** Add a typed entry, or one from the built-in or own foods. */
export async function addEntry(date: string, input: EntryCreate): Promise<FoodResult> {
  if (!DateSchema.safeParse(date).success) return { ok: false, error: GENERIC };
  const parsed = EntryCreateSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return run(() =>
    apiFetch(`/food/entries/${date}`, { method: "POST", body: parsed.data, schema: FoodDayViewSchema }),
  );
}

/** Add a photo meal, saved as pending analysis (feature 005). The browser already reduced the picture. */
export async function addPhotoEntry(date: string, input: PhotoEntryCreate): Promise<FoodResult> {
  if (!DateSchema.safeParse(date).success) return { ok: false, error: GENERIC };
  const parsed = PhotoEntryCreateSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  return run(() =>
    apiFetch(`/food/photos/${date}`, { method: "POST", body: parsed.data, schema: FoodDayViewSchema }),
  );
}

export async function updateEntry(date: string, entryId: string, patch: EntryPatch): Promise<FoodResult> {
  if (!DateSchema.safeParse(date).success || !ENTRY_ID.test(entryId)) return { ok: false, error: GENERIC };
  const parsed = EntryPatchSchema.safeParse(patch);
  if (!parsed.success) return fieldErrors(parsed.error);
  return run(() =>
    apiFetch(`/food/entries/${date}/${entryId}`, { method: "PUT", body: parsed.data, schema: FoodDayViewSchema }),
  );
}

export async function removeEntry(date: string, entryId: string): Promise<FoodResult> {
  if (!DateSchema.safeParse(date).success || !ENTRY_ID.test(entryId)) return { ok: false, error: GENERIC };
  return run(() => apiFetch(`/food/entries/${date}/${entryId}`, { method: "DELETE", schema: FoodDayViewSchema }));
}

// ---- own foods (forms) ----

const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const num = (fd: FormData, key: string) => {
  const t = str(fd, key).trim();
  return t === "" ? Number.NaN : Number(t);
};

function parseOwnFoodForm(fd: FormData) {
  const raw = (k: string) => str(fd, k).trim();
  const grams = (k: string) => (raw(k) === "" ? undefined : Number(raw(k)));
  const any = ["protein", "carbs", "fat"].some((k) => raw(k) !== "");
  return OwnFoodInputSchema.safeParse({
    name: str(fd, "name"),
    serving: str(fd, "serving"),
    calories: num(fd, "calories"),
    ...(any
      ? { macros: { protein: grams("protein") ?? 0, carbs: grams("carbs") ?? 0, fat: grams("fat") ?? 0 } }
      : {}),
  });
}

function formErrors(error: z.ZodError): ActionState {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] === "macros" ? String(issue.path[1] ?? "protein") : issue.path.join(".");
    fields[key] ??= issue.message;
  }
  return { fields };
}

async function formCall(fn: () => Promise<unknown>, okMessage: string): Promise<ActionState> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      return { error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    }
    return { error: GENERIC };
  }
  revalidatePath("/food", "layout");
  return { message: okMessage };
}

export async function createOwnFood(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseOwnFoodForm(formData);
  if (!parsed.success) return formErrors(parsed.error);
  return formCall(
    () => apiFetch("/food/foods", { method: "POST", body: parsed.data, schema: OwnFoodResponseSchema }),
    "Added",
  );
}

export async function updateOwnFood(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = str(formData, "foodId");
  if (!/^f-[A-Za-z0-9-]+$/.test(id)) return { error: GENERIC };
  const parsed = parseOwnFoodForm(formData);
  if (!parsed.success) return formErrors(parsed.error);
  return formCall(
    () => apiFetch(`/food/foods/${id}`, { method: "PUT", body: parsed.data, schema: OwnFoodResponseSchema }),
    "Saved",
  );
}

export async function removeOwnFood(foodId: string): Promise<void> {
  if (!/^f-[A-Za-z0-9-]+$/.test(foodId)) return;
  await formCall(
    () => apiFetch(`/food/foods/${foodId}`, { method: "DELETE", schema: z.object({ ok: z.literal(true) }) }),
    "Removed",
  );
}
