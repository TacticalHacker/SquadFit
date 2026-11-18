import { TodaySchema } from "@calci/shared";
import type { z } from "zod";
import Link from "next/link";
import { Avatar } from "./avatar";
import { DayCard } from "./day-card";
import { cardClass } from "./form-bits";
import { StepsLine } from "./steps-chart";

/**
 * Everyone's full workout for the selected day as cards (feature 011, FR-016), then members who only synced steps
 * that day as "Rest day · N steps" (feature 012, FR-023).
 */
export function TodayWorkouts({ data }: { data: z.infer<typeof TodaySchema> }) {
  if (data.cards.length === 0 && data.restDays.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">Nobody has logged a workout for this day yet.</p>;
  }
  return (
    <ul aria-label="Today's workouts" className="flex flex-col gap-3">
      {data.cards.map((c) => (
        <li key={c.member.userId}>
          <DayCard card={c} memberId={c.member.userId} member={c.member} />
        </li>
      ))}
      {data.restDays.map((r) => (
        <li key={r.member.userId} className={`${cardClass} flex flex-col gap-1 p-3`}>
          <Link href={`/squad/${r.member.userId}`} className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
            <Avatar displayName={r.member.displayName} avatarUrl={r.member.avatarUrl} size={28} />
            {r.member.displayName}
          </Link>
          <StepsLine steps={r.steps.steps} goalHit={r.steps.goalHit} rest />
        </li>
      ))}
    </ul>
  );
}
