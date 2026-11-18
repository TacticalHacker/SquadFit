import { Check } from "lucide-react";
import { DAILY_GOAL_MINUTES, goalProgress, type Summary } from "@calci/shared";
import { cardClass } from "./form-bits";

const R = 52;
const C = 2 * Math.PI * R;

/** Daily-goal ring: minutes against the (provisional) goal, plus calories burned. */
export function ProgressRing({ summary }: { summary: Summary }) {
  const { fraction, met } = goalProgress(summary.totalMinutes);
  return (
    <div className={`flex items-center gap-6 p-5 ${cardClass}`}>
      <div
        role="img"
        aria-label={`${summary.totalMinutes} of ${DAILY_GOAL_MINUTES} goal minutes`}
        className="relative size-32 shrink-0"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-surface-2" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            className="stroke-accent"
          />
        </svg>
        <div aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-3xl font-medium leading-none">{summary.totalMinutes}</span>
          <span className="mt-1 text-xs text-muted">/ {DAILY_GOAL_MINUTES} min</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="eyebrow">Calories burned</p>
        <p className="mt-1 font-mono text-3xl font-medium">
          {summary.totalCalories}
          <span className="ml-1 font-sans text-base font-normal text-muted">kcal</span>
        </p>
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${met ? "font-medium text-success" : "text-muted"}`}>
          {met ? (
            <>
              <Check aria-hidden size={18} strokeWidth={1.75} />
              Daily goal met
            </>
          ) : (
            `${Math.max(0, DAILY_GOAL_MINUTES - summary.totalMinutes)} min to your goal`
          )}
        </p>
      </div>
    </div>
  );
}
