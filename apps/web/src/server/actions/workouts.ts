"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CustomWorkoutInputSchema,
  CustomWorkoutResponseSchema,
  DateSchema,
  DayViewSchema,
  MinutesSchema,
  type DayView,
} from "@calci/shared";
import { z } from "zod";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";
import type { ActionState } from "./state";

export type ChecklistResult = { ok: true; view: DayView } | { ok: false; error: string };

const GENERIC = "Couldn't save. Try again.";

async function run(fn: () => Promise<DayView>): Promise<ChecklistResult> {
  try {
    return { ok: true, view: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      if (err.code === "DAY_LOCKED") return { ok: false, error: "This day can no longer be edited" };
      return { ok: false, error: err.fields?.minutes ?? GENERIC };
    }
    return { ok: false, error: GENERIC };
  }
}

const entryPath = (date: string, workoutId: string) =>
  `/workouts/entries/${date}/${encodeURIComponent(workoutId)}`;

function invalid(date: string, workoutId: string): ChecklistResult | null {
  return DateSchema.safeParse(date).success && /^(std|c)-[A-Za-z0-9-]+$/.test(workoutId)
    ? null
    : { ok: false, error: GENERIC };
}

export async function tickWorkout(date: string, workoutId: string): Promise<ChecklistResult> {
  return (
    invalid(date, workoutId) ??
    run(() => apiFetch(entryPath(date, workoutId), { method: "PUT", schema: DayViewSchema }))
  );
}

export async function untickWorkout(date: string, workoutId: string): Promise<ChecklistResult> {
  return (
    invalid(date, workoutId) ??
    run(() => apiFetch(entryPath(date, workoutId), { method: "DELETE", schema: DayViewSchema }))
  );
}

export async function setEntryMinutes(date: string, workoutId: string, minutes: number): Promise<ChecklistResult> {
  const bad = invalid(date, workoutId);
  if (bad) return bad;
  const m = MinutesSchema.safeParse(minutes);
  if (!m.success) return { ok: false, error: m.error.issues[0]?.message ?? GENERIC };
  return run(() =>
    apiFetch(entryPath(date, workoutId), { method: "PUT", body: { minutes: m.data }, schema: DayViewSchema }),
  );
}

// ---- custom workouts (forms) ----

const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const num = (fd: FormData, key: string) => {
  const t = str(fd, key).trim();
  return t === "" ? Number.NaN : Number(t);
};

function parseForm(fd: FormData) {
  return CustomWorkoutInputSchema.safeParse({
    name: str(fd, "name"),
    defaultMinutes: num(fd, "defaultMinutes"),
    defaultCalories: num(fd, "defaultCalories"),
  });
}

function fieldErrors(error: z.ZodError): ActionState {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
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
  revalidatePath("/workouts", "layout");
  return { message: okMessage };
}

export async function createCustomWorkout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return fieldErrors(parsed.error);
  return formCall(
    () => apiFetch("/workouts/custom", { method: "POST", body: parsed.data, schema: CustomWorkoutResponseSchema }),
    "Added",
  );
}

export async function updateCustomWorkout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = str(formData, "workoutId");
  if (!/^c-[A-Za-z0-9-]+$/.test(id)) return { error: GENERIC };
  const parsed = parseForm(formData);
  if (!parsed.success) return fieldErrors(parsed.error);
  return formCall(
    () =>
      apiFetch(`/workouts/custom/${id}`, { method: "PUT", body: parsed.data, schema: CustomWorkoutResponseSchema }),
    "Saved",
  );
}

export async function removeCustomWorkout(workoutId: string): Promise<void> {
  if (!/^c-[A-Za-z0-9-]+$/.test(workoutId)) return;
  await formCall(
    () => apiFetch(`/workouts/custom/${workoutId}`, { method: "DELETE", schema: z.object({ ok: z.literal(true) }) }),
    "Removed",
  );
}
