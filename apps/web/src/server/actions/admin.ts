"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminExerciseInputSchema,
  AdminExercisePatchSchema,
  AdminExerciseResponseSchema,
  AdminMergeResponseSchema,
  AdminUserCreatedSchema,
  AdminUserInputSchema,
  type AdminMergeResponse,
  type AdminUserCreated,
} from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Exercise admin (feature 015). The API checks the admin group on every call; these only forward and refresh. */

export type AdminFail = { ok: false; error: string; fields?: Record<string, string> };
export type AdminResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { value: T })) | AdminFail;

const GENERIC = "Couldn't save. Check your connection and try again.";
const ID_RE = /^gx-[a-z0-9-]+$/;

async function call<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | AdminFail> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      const firstField = err.fields ? Object.values(err.fields)[0] : undefined;
      return { ok: false, error: firstField ?? err.message ?? GENERIC, ...(err.fields ? { fields: err.fields } : {}) };
    }
    return { ok: false, error: GENERIC };
  }
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): AdminFail {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[i.path.join(".") || "_"] ??= i.message;
  return { ok: false, error: Object.values(fields)[0] ?? "Check the highlighted fields", fields };
}

export async function addExercise(input: { name: string; group: string }): Promise<AdminResult> {
  const parsed = AdminExerciseInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() => apiFetch("/admin/exercises", { method: "POST", body: parsed.data, schema: AdminExerciseResponseSchema }));
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

export async function updateExercise(exerciseId: string, patch: unknown): Promise<AdminResult> {
  if (!ID_RE.test(exerciseId)) return { ok: false, error: GENERIC };
  const parsed = AdminExercisePatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() =>
    apiFetch(`/admin/exercises/${encodeURIComponent(exerciseId)}`, { method: "PUT", body: parsed.data, schema: AdminExerciseResponseSchema }),
  );
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

export async function mergeExercise(exerciseId: string): Promise<AdminResult<AdminMergeResponse>> {
  if (!ID_RE.test(exerciseId)) return { ok: false, error: GENERIC };
  const r = await call(() =>
    apiFetch(`/admin/exercises/${encodeURIComponent(exerciseId)}/merge`, { method: "POST", schema: AdminMergeResponseSchema }),
  );
  if (!r.ok) return r;
  refresh();
  return { ok: true, value: r.value };
}

/** Story 5: the temporary password comes back once and is only shown, never kept (FR-022). */
export async function createMember(input: { username: string }): Promise<AdminResult<AdminUserCreated>> {
  const parsed = AdminUserInputSchema.safeParse({ username: input.username.trim() });
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() => apiFetch("/admin/users", { method: "POST", body: parsed.data, schema: AdminUserCreatedSchema }));
  return r.ok ? { ok: true, value: r.value } : r;
}
