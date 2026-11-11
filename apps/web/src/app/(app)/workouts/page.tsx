import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DateSchema, DayViewSchema, SummaryRangeResponseSchema, addDays, currentStreak } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { DayStrip } from "@/components/day-strip";
import { WorkoutChecklist } from "@/components/workout-checklist";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Workouts · SquadFit" };

async function WorkoutsContent({ searchParams }: { searchParams: PageProps<"/workouts">["searchParams"] }) {
  await requireProfile();
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/workouts");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today (FR-016).
  const query = raw ? `?date=${raw}` : "";
  const view = await apiFetch(`/workouts${query}`, { schema: DayViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/workouts");
    throw err;
  });
  // The streak needs up to two months ending today; the strip needs the 7 days ending on the viewed date.
  const range = (from: string, to: string) =>
    apiFetch(`/workouts/summary?from=${from}&to=${to}`, { schema: SummaryRangeResponseSchema });
  const streakFrom = addDays(view.today, -61);
  const stripFrom = addDays(view.date, -6);
  const [history, stripOnly] = await Promise.all([
    range(streakFrom, view.today),
    stripFrom < streakFrom ? range(stripFrom, view.date) : Promise.resolve(null),
  ]);
  const strip = stripOnly ?? { days: history.days.filter((d) => d.date >= stripFrom && d.date <= view.date) };
  const streak = currentStreak(history.days, view.today);

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-[#0F172A] p-4 text-slate-100 sm:p-6">
      <DayNav date={view.date} today={view.today} streak={streak} />
      <DayStrip days={strip.days} current={view.date} today={view.today} />
      <WorkoutChecklist initialView={view} />
      <p className="text-sm">
        <Link href="/workouts/mine" className="text-lime-300 underline">
          My workouts
        </Link>
      </p>
    </div>
  );
}

export default function WorkoutsPage(props: PageProps<"/workouts">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <WorkoutsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
