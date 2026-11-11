import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { DateSchema, isEditableDay, localDate } from "@calci/shared";
import type { Caller } from "./auth";
import type { Deps } from "./deps";
import { apiError } from "./http";

export interface DayContext {
  timezone: string;
  /** The caller's local date from the server clock and profile timezone (constitution V). */
  today: string;
  /** The profile's daily calorie target as it is now (feature 003 ledger). */
  target: number;
  /** The profile's optional daily protein target in grams (feature 004). */
  proteinTarget: number | null;
}

export type Result<T> = ({ ok: true } & T) | { ok: false; response: APIGatewayProxyResultV2 };

export async function loadDayContext(caller: Caller, deps: Deps): Promise<Result<{ ctx: DayContext }>> {
  const profile = await deps.profiles.get(caller.userId);
  if (!profile) {
    return { ok: false, response: apiError(409, "PROFILE_REQUIRED", "Complete your profile first") };
  }
  return { ok: true, ctx: { timezone: profile.timezone, today: localDate(deps.now(), profile.timezone), target: profile.dailyCalorieTarget, proteinTarget: profile.dailyProteinTarget ?? null } };
}

const badDate = (field: string) =>
  ({ ok: false, response: apiError(400, "VALIDATION_FAILED", "Invalid date", { [field]: "Use a real date as YYYY-MM-DD" }) }) as const;

const futureDate = (field: string) =>
  ({ ok: false, response: apiError(400, "VALIDATION_FAILED", "Date is in the future", { [field]: "Date cannot be after today" }) }) as const;

/** Reading: any day up to and including today. Missing means today. */
export function resolveReadDate(raw: string | undefined, today: string, field = "date"): Result<{ date: string }> {
  if (raw === undefined) return { ok: true, date: today };
  if (!DateSchema.safeParse(raw).success) return badDate(field);
  if (raw > today) return futureDate(field);
  return { ok: true, date: raw };
}

/** Writing: today and the two days before it only (FR-017). */
export function resolveWriteDate(raw: string | undefined, today: string): Result<{ date: string }> {
  const read = resolveReadDate(raw ?? "", today);
  if (!read.ok) return read;
  if (!isEditableDay(read.date, today)) {
    return { ok: false, response: apiError(409, "DAY_LOCKED", "This day can no longer be edited") };
  }
  return read;
}
