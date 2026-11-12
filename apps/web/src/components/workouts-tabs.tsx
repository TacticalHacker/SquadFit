import Link from "next/link";

/** "Gym | Activities" switch inside Workouts (FR-021, clarification 2). Gym is the default tab. Keeps the viewed day. */
export function WorkoutsTabs({ active, date, today }: { active: "activities" | "gym"; date: string; today: string }) {
  const q = date === today ? "" : `?date=${date}`;
  const tabs = [
    { key: "gym", href: `/workouts/gym${q}`, label: "Gym" },
    { key: "activities", href: `/workouts${q}`, label: "Activities" },
  ] as const;
  return (
    <nav aria-label="Workout type" className="grid grid-cols-2 gap-1 rounded-full bg-[#1E293B] p-1">
      {tabs.map((t) => {
        const current = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            {...(current ? { "aria-current": "page" as const } : {})}
            className={`flex min-h-11 items-center justify-center rounded-full text-sm font-semibold focus-visible:outline-2 focus-visible:outline-lime-400 ${
              current ? "bg-lime-400 text-slate-900" : "text-slate-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
