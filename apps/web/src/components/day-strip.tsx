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
                className={`flex flex-col items-center gap-1 rounded-md border py-2 transition-colors duration-150 ${
                  isCurrent ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                <span className={`text-[0.6875rem] uppercase tracking-[0.06em] ${isCurrent ? "" : "text-muted"}`}>
                  {weekday.format(new Date(`${d.date}T00:00:00Z`))}
                </span>
                <span className="text-base font-semibold leading-none">{dayNum.format(new Date(`${d.date}T00:00:00Z`))}</span>
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${goal ? "bg-accent" : active ? "bg-muted" : "border border-line-strong"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
