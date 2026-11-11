import Link from "next/link";
import { addDays } from "@calci/shared";

const link =
  "rounded px-2 py-1 text-lg hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800";

export function DayNav({ date, today }: { date: string; today: string }) {
  const isToday = date === today;
  const label = new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  const href = (d: string) => (d === today ? "/workouts" : `/workouts?date=${d}`);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(addDays(date, -1))} className={link} aria-label="Previous day">
        ◀
      </Link>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {label}
        {isToday ? (
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
            Today
          </span>
        ) : null}
      </h1>
      {isToday ? null : (
        <>
          <Link href={href(addDays(date, 1))} className={link} aria-label="Next day">
            ▶
          </Link>
          <Link href="/workouts" className="text-sm text-emerald-700 underline dark:text-emerald-400">
            Back to today
          </Link>
        </>
      )}
    </div>
  );
}
