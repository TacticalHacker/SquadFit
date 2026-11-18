/**
 * Daily goal ring on the day strip. Streaks are weekly since feature 010 (see `streakFigures` in `squad.ts`).
 */
export const DAILY_GOAL_MINUTES = 30;

export function goalProgress(totalMinutes: number): { fraction: number; met: boolean } {
  return { fraction: Math.min(1, totalMinutes / DAILY_GOAL_MINUTES), met: totalMinutes >= DAILY_GOAL_MINUTES };
}
