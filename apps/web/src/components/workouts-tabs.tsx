import Link from "next/link";
import { segmentClass, segmentGroupClass } from "./form-bits";

/** "Gym | Activities" switch inside Workouts (FR-021, clarification 2). Gym is the default tab. Keeps the viewed day. */
export function WorkoutsTabs({ active, date, today }: { active: "activities" | "gym"; date: string; today: string }) {
  const q = date === today ? "" : `?date=${date}`;
  const tabs = [
    { key: "gym", href: `/workouts/gym${q}`, label: "Gym" },
    { key: "activities", href: `/workouts${q}`, label: "Activities" },
  ] as const;
  return (
    <nav aria-label="Workout type" className={`grid-cols-2 ${segmentGroupClass}`}>
      {tabs.map((t) => {
        const current = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            {...(current ? { "aria-current": "page" as const } : {})}
            className={`min-h-11 ${segmentClass(current)}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
