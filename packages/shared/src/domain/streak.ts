import { addDays } from "./day";

/**
 * Provisional daily goal and streak rule for the workout screen. Feature 005 owns the real
 * streak/scoring rules (PRD §5); until then a day counts when it has at least one workout.
 */
export const DAILY_GOAL_MINUTES = 30;

export function goalProgress(totalMinutes: number): { fraction: number; met: boolean } {
  return { fraction: Math.min(1, totalMinutes / DAILY_GOAL_MINUTES), met: totalMinutes >= DAILY_GOAL_MINUTES };
}

/**
 * Consecutive active days ending today. An empty today does not break the streak (the day isn't
 * over), so counting then starts from yesterday.
 */
export function currentStreak(days: readonly { date: string; totalMinutes: number }[], today: string): number {
  const active = new Set(days.filter((d) => d.totalMinutes > 0).map((d) => d.date));
  let cursor = active.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (active.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
