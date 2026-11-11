import { CALORIES_MESSAGE, CaloriesSchema, GRAMS_MESSAGE, MacrosSchema } from "@calci/shared";

export type CaloriesParse = { ok: true; value: number } | { ok: false; error: string };
export type GramsParse = { ok: true; value: number | undefined } | { ok: false; error: string };

const NUMBER = /^-?\d+(\.\d+)?$/;

/** Validates typed calories with the same rule the API enforces (FR-002). */
export function parseCaloriesInput(raw: string): CaloriesParse {
  const text = raw.trim();
  const r = CaloriesSchema.safeParse(NUMBER.test(text) ? Number(text) : Number.NaN);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: CALORIES_MESSAGE };
}

/** Blank grams mean "not entered"; anything else must be 0-500 with at most one decimal. */
export function parseGramsInput(raw: string): GramsParse {
  const text = raw.trim();
  if (text === "") return { ok: true, value: undefined };
  const n = NUMBER.test(text) ? Number(text) : Number.NaN;
  const r = MacrosSchema.shape.protein.safeParse(n);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: GRAMS_MESSAGE };
}
