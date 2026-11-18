import { CircleCheck, Footprints } from "lucide-react";

/** Feature 012: steps shown to squad members. Active calories and distance appear only in `StepsChart` (profile). */

const nf = new Intl.NumberFormat("en");
const nf1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const dayLabel = (d: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** "8,423 steps ✓" (or "Rest day · 11,240 steps"). */
export function StepsLine({ steps, goalHit, rest = false }: { steps: number; goalHit: boolean; rest?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-sm tabular-nums text-muted">
      <Footprints aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
      <span>
        {rest ? "Rest day · " : ""}
        <span className="font-medium text-ink">{nf.format(steps)}</span> steps
      </span>
      {goalHit ? (
        <span className="inline-flex items-center gap-1 text-success">
          <CircleCheck aria-hidden size={16} strokeWidth={1.75} />
          <span className="sr-only">step goal hit</span>
        </span>
      ) : null}
    </p>
  );
}

export interface StepsChartDay {
  date: string;
  steps: number | null;
  activeKcal: number | null;
  distanceKm: number | null;
}

/**
 * Last 30 days of steps against the goal (FR-022): one bar per day, unsynced days empty (not zero), a goal line,
 * and averages of the synced days. Plain CSS bars on theme tokens; no chart library.
 */
export function StepsChart({ days, goal }: { days: readonly StepsChartDay[]; goal: number }) {
  const synced = days.filter((d): d is StepsChartDay & { steps: number } => d.steps !== null);
  if (synced.length === 0) return <p className="text-sm text-muted">No steps synced in the last 30 days.</p>;
  const max = Math.max(goal, ...synced.map((d) => d.steps)) * 1.08;
  const hits = synced.filter((d) => d.steps >= goal).length;
  const avg = Math.round(synced.reduce((t, d) => t + d.steps, 0) / synced.length);
  const latest = synced[synced.length - 1]!;
  const kcal = synced.filter((d) => d.activeKcal !== null);
  const dist = synced.filter((d) => d.distanceKm !== null);

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted">Daily average</dt>
          <dd className="text-xl font-semibold tabular-nums text-ink">{nf.format(avg)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Goal days</dt>
          <dd className="text-xl font-semibold tabular-nums text-ink">
            {hits}/{synced.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Goal</dt>
          <dd className="text-xl font-semibold tabular-nums text-ink">{nf.format(goal)}</dd>
        </div>
      </dl>

      <div className="relative h-28" role="img" aria-label={`Steps for the last 30 days: average ${nf.format(avg)}, goal hit on ${hits} of ${synced.length} synced days`}>
        <div className="absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(goal / max) * 100}%` }} aria-hidden />
        <ol className="absolute inset-0 flex items-end gap-px">
          {days.map((d) => (
            <li key={d.date} className="flex h-full flex-1 items-end" title={d.steps === null ? `${dayLabel(d.date)}: not synced` : `${dayLabel(d.date)}: ${nf.format(d.steps)} steps`}>
              {d.steps === null ? (
                <span className="block h-0.5 w-full rounded-sm bg-line" />
              ) : (
                <span
                  className={`block w-full rounded-t-sm ${d.steps >= goal ? "bg-accent" : "bg-accent/35"}`}
                  style={{ height: `${Math.max(2, (d.steps / max) * 100)}%` }}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex justify-between text-xs tabular-nums text-faint" aria-hidden>
        <span>{dayLabel(days[0]!.date)}</span>
        <span>Goal {nf.format(goal)}</span>
        <span>{dayLabel(days[days.length - 1]!.date)}</span>
      </div>

      {kcal.length || dist.length ? (
        <p className="text-xs text-muted">
          From Apple Health, {dayLabel(latest.date)}:{" "}
          {latest.activeKcal !== null ? <span className="tabular-nums">{nf.format(latest.activeKcal)} active kcal</span> : null}
          {latest.activeKcal !== null && latest.distanceKm !== null ? " · " : null}
          {latest.distanceKm !== null ? <span className="tabular-nums">{nf1.format(latest.distanceKm)} km</span> : null}
          {latest.activeKcal === null && latest.distanceKm === null ? "steps only" : null}
        </p>
      ) : null}
    </div>
  );
}
