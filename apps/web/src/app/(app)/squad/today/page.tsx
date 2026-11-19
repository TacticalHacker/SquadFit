import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { DateSchema, TodaySchema, addDays, localDate } from "@calci/shared";
import { linkClass } from "@/components/form-bits";
import { TodayWorkouts } from "@/components/today-workouts";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Today's workouts · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dayName = (d: string) => new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const navClass = "grid min-h-11 min-w-11 place-items-center rounded-md bg-surface-2 text-ink active:bg-line";

/** Feature 013: Today's workouts moved off the Squad page, with its own day picker (last 30 days). */
async function TodayContent({ searchParams }: { searchParams: PageProps<"/squad/today">["searchParams"] }) {
  const { profile } = await requireProfile();
  const raw = DateSchema.safeParse(first((await searchParams).date));
  const data = await apiFetch(`/squad/today${raw.success ? `?date=${raw.data}` : ""}`, { schema: TodaySchema });
  // Navigation only, on the server, in the member's own timezone (constitution V); the API still validates the date.
  const today = localDate(new Date(), profile.timezone);
  const selected = data.date;
  const link = (d: string) => (d === today ? "/squad/today" : `/squad/today?date=${d}`);
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Day" className="flex items-center justify-between gap-2">
        {selected > addDays(today, -30) ? (
          <Link href={link(addDays(selected, -1))} aria-label="Previous day" className={navClass}>
            <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
        <p className="text-sm font-medium tabular-nums text-ink">{selected === today ? `Today · ${dayName(selected)}` : dayName(selected)}</p>
        {selected < today ? (
          <Link href={link(addDays(selected, 1))} aria-label="Next day" className={navClass}>
            <ChevronRight aria-hidden size={18} strokeWidth={1.75} />
          </Link>
        ) : (
          <span className="min-w-11" />
        )}
      </nav>
      <TodayWorkouts data={data} />
    </div>
  );
}

export default function TodayPage(props: PageProps<"/squad/today">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 self-start text-sm`}>
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Today&apos;s workouts</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <TodayContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
