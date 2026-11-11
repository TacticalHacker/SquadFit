import type { Summary } from "@calci/shared";

export function DaySummary({ summary }: { summary: Summary }) {
  return (
    <div
      aria-live="polite"
      className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <p>
        <span className="block text-sm text-zinc-500">Total minutes</span>
        <span className="text-2xl font-semibold tabular-nums">{summary.totalMinutes}</span>
      </p>
      <p>
        <span className="block text-sm text-zinc-500">Total calories burned</span>
        <span className="text-2xl font-semibold tabular-nums">{summary.totalCalories}</span>
      </p>
    </div>
  );
}
