import Link from "next/link";
import type { SummaryRangeResponse } from "@calci/shared";

export function DayStrip({ days, current, today }: { days: SummaryRangeResponse["days"]; current: string; today: string }) {
  const fmt = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", timeZone: "UTC" });
  return (
    <nav aria-label="Last 7 days">
      <ul className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((d) => (
          <li key={d.date}>
            <Link
              href={d.date === today ? "/workouts" : `/workouts?date=${d.date}`}
              {...(d.date === current ? { "aria-current": "date" as const } : {})}
              className={`block rounded-md border px-1 py-2 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800 ${
                d.date === current ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span className="block text-zinc-500">{fmt.format(new Date(`${d.date}T00:00:00Z`))}</span>
              <span className="block font-medium tabular-nums">{d.totalMinutes}m</span>
              <span className="block tabular-nums text-zinc-500">{d.totalCalories}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
