"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminRaidResponseSchema, RaidCancelSchema, RaidInputSchema, RaidSuggestResponseSchema, RaidUpdateSchema } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Squad volume raid admin (feature 021). The API checks the admin group on every call; these only forward. */

export type RaidResult = { ok: true; raidId?: string } | { ok: false; error: string; fields?: Record<string, string> };

const GENERIC = "Couldn't save. Check your connection and try again.";
const ID_RE = /^rd-\d{8}-[a-z0-9]{6}$/;

async function call<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) return { ok: false, error: err.message || GENERIC, ...(err.fields ? { fields: err.fields } : {}) };
    return { ok: false, error: GENERIC };
  }
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): RaidResult {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return { ok: false, error: Object.values(fields)[0] ?? "Check the highlighted fields", fields };
}

export async function createRaid(input: unknown): Promise<RaidResult> {
  const parsed = RaidInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() => apiFetch("/admin/raids", { method: "POST", body: parsed.data, schema: AdminRaidResponseSchema }));
  if (!r.ok) return r;
  refresh();
  return { ok: true, raidId: r.value.raid.raidId };
}

export async function updateRaid(raidId: string, input: unknown): Promise<RaidResult> {
  if (!ID_RE.test(raidId)) return { ok: false, error: GENERIC };
  const parsed = RaidUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() => apiFetch(`/admin/raids/${raidId}`, { method: "PUT", body: parsed.data, schema: AdminRaidResponseSchema }));
  if (!r.ok) return r;
  refresh();
  return { ok: true, raidId };
}

export async function cancelRaid(raidId: string, input: unknown): Promise<RaidResult> {
  if (!ID_RE.test(raidId)) return { ok: false, error: GENERIC };
  const parsed = RaidCancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const r = await call(() => apiFetch(`/admin/raids/${raidId}/cancel`, { method: "POST", body: parsed.data, schema: AdminRaidResponseSchema }));
  if (!r.ok) return r;
  refresh();
  return { ok: true, raidId };
}

export async function deleteRaid(raidId: string): Promise<RaidResult> {
  if (!ID_RE.test(raidId)) return { ok: false, error: GENERIC };
  const r = await call(() => apiFetch(`/admin/raids/${raidId}`, { method: "DELETE", schema: z.unknown() }));
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

const SuggestInput = z.strictObject({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  groups: z.array(z.string().regex(/^[a-z]+$/)).max(6),
  exercises: z.array(z.string().regex(/^g[xc]-[a-z0-9-]+$/)).max(100),
});

export async function suggestRaidTarget(input: unknown): Promise<number | null> {
  const parsed = SuggestInput.safeParse(input);
  if (!parsed.success) return null;
  const q = new URLSearchParams({ start: parsed.data.start, end: parsed.data.end, groups: parsed.data.groups.join(","), exercises: parsed.data.exercises.join(",") });
  const r = await call(() => apiFetch(`/admin/raids/suggest?${q}`, { schema: RaidSuggestResponseSchema }));
  return r.ok ? r.value.suggestedKg : null;
}
