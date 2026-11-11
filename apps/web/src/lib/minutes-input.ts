import { MinutesSchema } from "@calci/shared";

export type MinutesParse = { ok: true; minutes: number } | { ok: false; error: string };

/** Validates what the user typed in the minutes field with the same rule the API enforces (FR-007). */
export function parseMinutesInput(raw: string): MinutesParse {
  const text = raw.trim();
  const n = text === "" || !/^-?\d+(\.\d+)?$/.test(text) ? Number.NaN : Number(text);
  const r = MinutesSchema.safeParse(n);
  return r.success ? { ok: true, minutes: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "Invalid minutes" };
}
