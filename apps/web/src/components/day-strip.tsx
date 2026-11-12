import Link from "next/link";
import { goalProgress, type SummaryRangeResponse } from "@calci/shared";

export function DayStrip({
  days,
  current,
  today,
  basePath = "/workouts",
}: {
  days: SummaryRangeResponse["days"];
  current: string;
  today: string;
  basePath?: string;
}) {
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
  const dayNum = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" });
  return (
    <nav aria-label="Last 7 days">
      <ul className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((d) => {
          const goal = goalProgress(d.totalMinutes).met;
          const active = d.totalMinutes > 0;
          const isCurrent = d.date === current;
          return (
            <li key={d.date}>
              <Link
                href={d.date === today ? basePath : `${basePath}?date=${d.date}`}
                {...(isCurrent ? { "aria-current": "date" as const } : {})}
                aria-label={`${weekday.format(new Date(`${d.date}T00:00:00Z`))} ${dayNum.format(new Date(`${d.date}T00:00:00Z`))}: ${d.totalMinutes} minutes${goal ? ", goal met" : ""}`}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 transition active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400 ${
                  isCurrent ? "bg-lime-400 text-slate-900" : "bg-[#1E293B] text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span className="text-[11px] uppercase tracking-wide opacity-80">{weekday.format(new Date(`${d.date}T00:00:00Z`))}</span>
                <span className="text-base font-bold leading-none">{dayNum.format(new Date(`${d.date}T00:00:00Z`))}</span>
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${
                    goal ? (isCurrent ? "bg-slate-900" : "bg-lime-400 shadow-[0_0_6px] shadow-lime-400") : active ? (isCurrent ? "bg-slate-900/50" : "bg-slate-500") : "bg-transparent ring-1 ring-inset ring-current opacity-30"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
