import { DateSchema } from "./day";

/**
 * Opaque id the AI agent uses to point at one logged entry: `<YYYY-MM-DD>#<id>` (feature 007, research R2).
 * The id is a workout entry's `workoutId` or a food entry's `entryId`; carrying the date lets a tool find the
 * item with one read and check the edit window before reading anything.
 */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function formatLogId(date: string, id: string): string {
  return `${date}#${id}`;
}

export function parseLogId(logId: string): { date: string; id: string } | null {
  const parts = logId.split("#");
  if (parts.length !== 2) return null;
  const [date, id] = parts as [string, string];
  if (!DateSchema.safeParse(date).success || !ID.test(id)) return null;
  return { date, id };
}
