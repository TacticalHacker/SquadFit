import Link from "next/link";
import { addDays } from "@calci/shared";

const link =
  "rounded-lg px-2.5 py-1 text-lg text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime-400";

export function DayNav({ date, today, basePath, streak }: { date: string; today: string; basePath: string; streak?: number }) {
  const isToday = date === today;
  const label = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  const href = (d: string) => (d === today ? basePath : `${basePath}?date=${d}`);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(addDays(date, -1))} className={link} aria-label="Previous day">
        ◀
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{label}</h1>
        {isToday ? null : (
          <Link href={basePath} className="text-xs text-lime-300 underline">
            Back to today
          </Link>
        )}
      </div>
      {isToday ? null : (
        <Link href={href(addDays(date, 1))} className={link} aria-label="Next day">
          ▶
        </Link>
      )}
      {streak === undefined ? null : (
        <p
          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            streak > 0 ? "bg-orange-400/15 text-orange-300 shadow-[0_0_16px_-4px] shadow-orange-400/60" : "bg-white/5 text-slate-400"
          }`}
          title="Consecutive days with at least one workout (provisional rule)"
        >
          <span aria-hidden="true">🔥</span>
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </p>
      )}
    </div>
  );
}
