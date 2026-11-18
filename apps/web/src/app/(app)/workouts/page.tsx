import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CoachPulseResponseSchema, DateSchema, DayViewSchema, SummaryRangeResponseSchema, addDays } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { DayStrip } from "@/components/day-strip";
import { PulseBar } from "@/components/pulse-bar";
import { WorkoutChecklist } from "@/components/workout-checklist";
import { WorkoutsTabs } from "@/components/workouts-tabs";
import { linkClass } from "@/components/form-bits";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Workouts · SquadFit" };

async function WorkoutsContent({ searchParams }: { searchParams: PageProps<"/workouts">["searchParams"] }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/workouts");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today (FR-016).
  const query = raw ? `?date=${raw}` : "";
  const view = await apiFetch(`/workouts${query}`, { schema: DayViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/workouts");
    throw err;
  });
  // The strip needs the 7 days ending on the viewed date; the same response carries the weekly streak.
  const stripFrom = addDays(view.date, -6);
  const [strip, pulse] = await Promise.all([
    apiFetch(`/workouts/summary?from=${stripFrom}&to=${view.date}`, { schema: SummaryRangeResponseSchema }),
    // The coach note is decoration: a failed fetch must never break the screen (feature 007).
    apiFetch(`/coach-note?date=${view.date}`, { schema: CoachPulseResponseSchema }).catch(() => null),
  ]);
  const streak = strip.weeklyStreak;

  return (
    <div className="flex flex-col gap-6">
      <DayNav date={view.date} today={view.today} basePath="/workouts" streak={streak} />
      <DayStrip days={strip.days} current={view.date} today={view.today} />
      {pulse?.note && pulse.metrics ? (
        <PulseBar key={pulse.note.updatedAt} note={pulse.note} metrics={pulse.metrics} proteinTarget={profile.dailyProteinTarget} />
      ) : null}
      <WorkoutsTabs active="activities" date={view.date} today={view.today} />
      <WorkoutChecklist initialView={view} />
      <p className="text-sm">
        <Link href="/workouts/mine" className={linkClass}>
          My workouts
        </Link>
      </p>
    </div>
  );
}

export default function WorkoutsPage(props: PageProps<"/workouts">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <WorkoutsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
