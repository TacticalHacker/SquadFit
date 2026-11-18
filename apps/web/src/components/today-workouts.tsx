import { TodaySchema } from "@calci/shared";
import type { z } from "zod";
import { DayCard } from "./day-card";

/** Everyone's full workout for the selected day as cards (feature 011, FR-016). */
export function TodayWorkouts({ data }: { data: z.infer<typeof TodaySchema> }) {
  if (data.cards.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">Nobody has logged a workout for this day yet.</p>;
  }
  return (
    <ul aria-label="Today's workouts" className="flex flex-col gap-3">
      {data.cards.map((c) => (
        <li key={c.member.userId}>
          <DayCard card={c} memberId={c.member.userId} member={c.member} />
        </li>
      ))}
    </ul>
  );
}
