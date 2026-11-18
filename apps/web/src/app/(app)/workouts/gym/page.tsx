import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CoachPulseResponseSchema, DateSchema, GymViewSchema, SummaryRangeResponseSchema, addDays } from "@calci/shared";
import { DayNav } from "@/components/day-nav";
import { DayStrip } from "@/components/day-strip";
import { PulseBar } from "@/components/pulse-bar";
import { GymScreen } from "@/components/gym-screen";
import { WorkoutsTabs } from "@/components/workouts-tabs";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Gym · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function GymContent({ searchParams }: { searchParams: PageProps<"/workouts/gym">["searchParams"] }) {
  const { username, profile } = await requireProfile();
  const params = await searchParams;
  const raw = first(params.date);
  const open = first(params.open) ?? null;
  if (raw !== undefined && !DateSchema.safeParse(raw).success) redirect("/workouts/gym");

  // A future date is rejected by the API (400, from the server's own "today"); fall back to today.
  const view = await apiFetch(`/workouts/gym${raw ? `?date=${raw}` : ""}`, { schema: GymViewSchema }).catch((err: unknown) => {
    if (raw && err instanceof ApiRequestError && err.status === 400) redirect("/workouts/gym");
    throw err;
  });
  // Same strip and weekly streak as the Activities tab (FR-021).
  const stripFrom = addDays(view.date, -6);
  const [strip, pulse] = await Promise.all([
    apiFetch(`/workouts/summary?from=${stripFrom}&to=${view.date}`, { schema: SummaryRangeResponseSchema }),
    // The coach note is decoration: a failed fetch must never break the screen (feature 007).
    apiFetch(`/coach-note?date=${view.date}`, { schema: CoachPulseResponseSchema }).catch(() => null),
  ]);
  const streak = strip.weeklyStreak;

  return (
    <div className="flex flex-col gap-5">
      <DayNav date={view.date} today={view.today} basePath="/workouts/gym" streak={streak} />
      <DayStrip days={strip.days} current={view.date} today={view.today} basePath="/workouts/gym" />
      {pulse?.note && pulse.metrics ? (
        <PulseBar key={pulse.note.updatedAt} note={pulse.note} metrics={pulse.metrics} proteinTarget={profile.dailyProteinTarget} />
      ) : null}
      <WorkoutsTabs active="gym" date={view.date} today={view.today} />
      <GymScreen initialView={view} username={username} openId={open} />
    </div>
  );
}

export default function GymPage(props: PageProps<"/workouts/gym">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <GymContent searchParams={props.searchParams} />
    </Suspense>
  );
}
