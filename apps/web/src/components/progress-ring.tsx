import { DAILY_GOAL_MINUTES, goalProgress, type Summary } from "@calci/shared";

const R = 52;
const C = 2 * Math.PI * R;

/** Daily-goal ring: minutes against the (provisional) goal, plus calories burned. */
export function ProgressRing({ summary }: { summary: Summary }) {
  const { fraction, met } = goalProgress(summary.totalMinutes);
  return (
    <div className="flex items-center gap-5 rounded-2xl bg-[#1E293B] p-5">
      <div
        role="img"
        aria-label={`${summary.totalMinutes} of ${DAILY_GOAL_MINUTES} goal minutes`}
        className="relative size-32 shrink-0"
      >
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="11" className="stroke-slate-700/70" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            className={`transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
              met ? "stroke-lime-400 drop-shadow-[0_0_6px_rgba(163,230,53,0.7)]" : "stroke-emerald-400"
            }`}
          />
        </svg>
        <div aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tabular-nums leading-none">{summary.totalMinutes}</span>
          <span className="mt-1 text-xs text-slate-400">/ {DAILY_GOAL_MINUTES} min</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-400">Calories burned</p>
        <p className="text-3xl font-bold tabular-nums text-orange-300">
          {summary.totalCalories}
          <span className="ml-1 text-base font-medium text-slate-400">kcal</span>
        </p>
        <p className={`mt-2 text-sm font-medium ${met ? "text-lime-300" : "text-slate-400"}`}>
          {met ? "🎯 Daily goal met!" : `${Math.max(0, DAILY_GOAL_MINUTES - summary.totalMinutes)} min to your goal`}
        </p>
      </div>
    </div>
  );
}
