"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminExerciseInputSchema,
  AdminExercisePatchSchema,
  AdminMergeInputSchema,
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

/**
 * Story 6: make a member-made exercise global: add it to the library under the same name, then merge every member's
 * copy into it (the merge matches by name). Two calls; if the merge fails the exercise is still added.
 */
export async function promoteExercise(input: { name: string; group: string }): Promise<AdminResult<AdminMergeResponse>> {
  const parsed = AdminExerciseInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const created = await call(() => apiFetch("/admin/exercises", { method: "POST", body: parsed.data, schema: AdminExerciseResponseSchema }));
  if (!created.ok) return created;
  const id = created.value.exercise.exerciseId;
  const merged = await call(() => apiFetch(`/admin/exercises/${encodeURIComponent(id)}/merge`, { method: "POST", schema: AdminMergeResponseSchema }));
  refresh();
  if (!merged.ok) return { ok: false, error: `Added to the library, but moving members' days failed: ${merged.error} Use Merge in the library to retry.` };
  return { ok: true, value: merged.value };
}

/** Story 6: fold the member-made exercises named `sourceName` (any spelling) into a library exercise. */
export async function mergeMemberExercise(targetId: string, sourceName: string): Promise<AdminResult<AdminMergeResponse>> {
  if (!ID_RE.test(targetId)) return { ok: false, error: GENERIC };
  const parsed = AdminMergeInputSchema.safeParse({ sourceName });
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() =>
    apiFetch(`/admin/exercises/${encodeURIComponent(targetId)}/merge`, { method: "POST", body: parsed.data, schema: AdminMergeResponseSchema }),
  );
  if (!r.ok) return r;
  refresh();
  return { ok: true, value: r.value };
}
