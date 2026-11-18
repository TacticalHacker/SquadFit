import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { addDays } from "@calci/shared";
import { linkClass } from "./form-bits";

const arrow =
  "grid min-h-11 min-w-11 place-items-center rounded-md border border-line bg-surface text-ink transition-colors duration-150 hover:bg-surface-2";

export function DayNav({ date, today, basePath, streak }: { date: string; today: string; basePath: string; streak?: number }) {
  const isToday = date === today;
  const label = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  const href = (d: string) => (d === today ? basePath : `${basePath}?date=${d}`);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={href(addDays(date, -1))} className={arrow} aria-label="Previous day">
        <ChevronLeft aria-hidden size={20} strokeWidth={1.75} />
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">{label}</h1>
        {isToday ? null : (
          <Link href={basePath} className={`text-xs ${linkClass}`}>
            Back to today
          </Link>
        )}
      </div>
      {isToday ? null : (
        <Link href={href(addDays(date, 1))} className={arrow} aria-label="Next day">
          <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
        </Link>
      )}
      {streak === undefined ? null : (
        <p
          className={`ml-auto flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium ${
            streak > 0 ? "text-ink" : "text-muted"
          }`}
          title="Consecutive days with at least one workout (provisional rule)"
        >
          <Flame aria-hidden size={18} strokeWidth={1.75} className={streak > 0 ? "text-accent" : "text-muted"} />
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </p>
      )}
    </div>
  );
}
