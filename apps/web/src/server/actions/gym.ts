"use server";

import { redirect } from "next/navigation";
import {
  DateSchema,
  GymEntryPutSchema,
  GymExerciseInputSchema,
  GymExerciseResponseSchema,
  GymSaveResultSchema,
  type GymExerciseView,
  type GymSaveResult,
} from "@calci/shared";
import { z } from "zod";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Gym logger actions (feature 006). Input is re-validated here; the API recomputes every total. */

export type ActionFail = { ok: false; code: string | null; error: string; fields?: Record<string, string> };
export type GymEntryActionResult = { ok: true; result: GymSaveResult } | ActionFail;
export type GymExerciseActionResult = { ok: true; exercise: GymExerciseView } | ActionFail;
export type GymRemoveResult = { ok: true } | ActionFail;

const GENERIC = "Couldn't save. Check your connection and try again.";
const ID_RE = /^g[xc]-[A-Za-z0-9-]+$/;
const OWN_RE = /^gc-[A-Za-z0-9-]+$/;

const fail = (error: string, code: string | null = null, fields?: Record<string, string>): ActionFail => ({
  ok: false,
  code,
  error,
  ...(fields ? { fields } : {}),
});

async function call<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | ActionFail> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      if (err.code === "DAY_LOCKED") return fail("This day can no longer be edited", "DAY_LOCKED");
      const firstField = err.fields ? Object.values(err.fields)[0] : undefined;
      return fail(firstField ?? err.message ?? GENERIC, err.code ?? null, err.fields);
    }
    return fail(GENERIC);
  }
}

const entryPath = (date: string, exerciseId: string) => `/workouts/gym/entries/${date}/${encodeURIComponent(exerciseId)}`;

export async function saveGymEntry(date: string, exerciseId: string, body: unknown): Promise<GymEntryActionResult> {
  if (!DateSchema.safeParse(date).success || !ID_RE.test(exerciseId)) return fail(GENERIC);
  const parsed = GymEntryPutSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC, "VALIDATION_FAILED");
  const r = await call(() => apiFetch(entryPath(date, exerciseId), { method: "PUT", body: parsed.data, schema: GymSaveResultSchema }));
  return r.ok ? { ok: true, result: r.value } : r;
}

export async function removeGymEntry(date: string, exerciseId: string): Promise<GymEntryActionResult> {
  if (!DateSchema.safeParse(date).success || !ID_RE.test(exerciseId)) return fail(GENERIC);
  const r = await call(() => apiFetch(entryPath(date, exerciseId), { method: "DELETE", schema: GymSaveResultSchema }));
  return r.ok ? { ok: true, result: r.value } : r;
}

function parseExercise(input: unknown): z.ZodSafeParseResult<z.infer<typeof GymExerciseInputSchema>> {
  return GymExerciseInputSchema.safeParse(input);
}

function fieldFail(error: z.ZodError): ActionFail {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
  return fail("Check the highlighted fields", "VALIDATION_FAILED", fields);
}

export async function createGymExercise(input: { name: string; group: string }): Promise<GymExerciseActionResult> {
  const parsed = parseExercise(input);
  if (!parsed.success) return fieldFail(parsed.error);
  const r = await call(() => apiFetch("/workouts/gym/exercises", { method: "POST", body: parsed.data, schema: GymExerciseResponseSchema }));
  return r.ok ? { ok: true, exercise: r.value.exercise } : r;
}

export async function updateGymExercise(exerciseId: string, input: { name: string; group: string }): Promise<GymExerciseActionResult> {
  if (!OWN_RE.test(exerciseId)) return fail(GENERIC);
  const parsed = parseExercise(input);
  if (!parsed.success) return fieldFail(parsed.error);
  const r = await call(() =>
    apiFetch(`/workouts/gym/exercises/${exerciseId}`, { method: "PUT", body: parsed.data, schema: GymExerciseResponseSchema }),
  );
  return r.ok ? { ok: true, exercise: r.value.exercise } : r;
}

export async function removeGymExercise(exerciseId: string): Promise<GymRemoveResult> {
  if (!OWN_RE.test(exerciseId)) return fail(GENERIC);
  const r = await call(() =>
    apiFetch(`/workouts/gym/exercises/${exerciseId}`, { method: "DELETE", schema: z.object({ ok: z.literal(true) }) }),
  );
  return r.ok ? { ok: true } : r;
}
