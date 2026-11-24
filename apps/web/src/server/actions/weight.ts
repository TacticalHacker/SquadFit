"use server";

import { redirect } from "next/navigation";
import { BodyWeightSchema, SquadWeightSchema, WeightRangeSchema, WeightViewSchema, DateSchema, type SquadWeight, type WeightView } from "@calci/shared";
import { ApiRequestError, apiFetch, UnauthorizedError } from "../api";

/** Feature 014 actions. The browser never calls the API; every view is validated against WeightViewSchema. */

export type WeightActionResult = { ok: true; view: WeightView } | { ok: false; error: string };

const GENERIC = "Couldn't save. Check your connection and try again.";

async function call(fn: () => Promise<WeightView>): Promise<WeightActionResult> {
  try {
    return { ok: true, view: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    if (err instanceof ApiRequestError) {
      if (err.code === "PROFILE_REQUIRED") redirect("/setup");
      return { ok: false, error: err.fields?.weightKg ?? (err.message || GENERIC) };
    }
    return { ok: false, error: GENERIC };
  }
}

const rangeOf = (raw: unknown) => WeightRangeSchema.catch("M").parse(raw);

export async function loadWeightView(range: string): Promise<WeightActionResult> {
  return call(() => apiFetch(`/me/weight?range=${rangeOf(range)}`, { schema: WeightViewSchema }));
}

/** Accepts "78,6" as well as "78.6". */
export async function logWeight(range: string, input: { weightKg: string; date: string }): Promise<WeightActionResult> {
  const weight = BodyWeightSchema.safeParse(Number(input.weightKg.trim().replace(",", ".")));
  if (!weight.success || input.weightKg.trim() === "") return { ok: false, error: "Enter a weight between 20 and 400 kg, at most one decimal" };
  const date = DateSchema.safeParse(input.date);
  return call(() =>
    apiFetch(`/me/weight?range=${rangeOf(range)}`, {
      method: "POST",
      body: { weightKg: weight.data, ...(date.success ? { date: date.data } : {}) },
      schema: WeightViewSchema,
    }),
  );
}

export async function deleteWeight(range: string, date: string, entryId: string): Promise<WeightActionResult> {
  if (!DateSchema.safeParse(date).success) return { ok: false, error: GENERIC };
  return call(() =>
    apiFetch(`/me/weight/${date}/${encodeURIComponent(entryId)}?range=${rangeOf(range)}`, { method: "DELETE", schema: WeightViewSchema }),
  );
}

/** Feature 017: the squad chart (kg change of members who share). */
export async function loadSquadWeight(range: string): Promise<{ ok: true; data: SquadWeight } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await apiFetch(`/squad/weight?range=${rangeOf(range)}`, { schema: SquadWeightSchema }) };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    return { ok: false, error: "Couldn't load the squad chart. Check your connection and try again." };
  }
}
