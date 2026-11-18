"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Circle, Flame, Minus, NotebookPen, Plus } from "lucide-react";
import { segmentClass, segmentGroupClass } from "@/components/form-bits";

/** Static mockups only: nothing here reads member data (spec FR-007). */
const TABS = [
  { id: "gym", label: "Gym" },
  { id: "pulse", label: "AI Pulse" },
  { id: "squad", label: "Squad" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function ProductPreview() {
  const [active, setActive] = useState<TabId>("gym");
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ gym: null, pulse: null, squad: null });
  const base = useId();

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + step + TABS.length) % TABS.length;
    if (step === 0 && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = TABS[to]!.id;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div role="tablist" aria-label="Product preview" className={`mb-4 grid-cols-3 ${segmentGroupClass}`}>
        {TABS.map((t, i) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-11 ${segmentClass(selected)}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${active}`}
        tabIndex={0}
        className="min-h-[21rem] rounded-lg border border-line bg-surface p-5 shadow-card"
      >
        {active === "gym" ? <GymMock /> : active === "pulse" ? <PulseMock /> : <SquadMock />}
      </div>
    </div>
  );
}

function GymMock() {
  // 80 + 80 + 82.5 kg, 8 reps each = 1,940 kg (volume = Σ weight × reps, as in gymTotals).
  const sets = [80, 80, 82.5];
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="eyebrow">Chest · Today</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Bench Press</h3>
          <span className="text-xs text-muted">Last: 77.5 kg × 8</span>
        </div>
      </div>
      <ol className="divide-y divide-line border-y border-line">
        {sets.map((kg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="w-10 text-muted">#{i + 1}</span>
            <span className="flex items-center gap-1.5 font-mono font-medium">
              <Step icon="minus" />
              <span className="w-12 text-center">{kg}</span>
              <Step icon="plus" />
            </span>
            <span className="flex items-center gap-1.5 font-mono font-medium">
              <Step icon="minus" />
              <span className="w-5 text-center">8</span>
              <Step icon="plus" />
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        3 sets × 8 · <span className="font-semibold text-accent">top set 82.5 kg</span> · 1,940 kg volume
      </p>
      <div className="mt-auto rounded-md bg-accent py-3 text-center text-sm font-medium text-on-accent">Save</div>
    </div>
  );
}

function Step({ icon }: { icon: "minus" | "plus" }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <span aria-hidden className="grid size-7 place-items-center rounded-md bg-surface-2 text-ink">
      <Icon size={14} strokeWidth={1.75} />
    </span>
  );
}

function PulseMock() {
  return (
    <div className="flex flex-col gap-4">
      <p className="eyebrow">Workouts · Today</p>
      <div className="flex gap-1.5" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className={`grid h-10 flex-1 place-items-center rounded-md border text-xs ${
              i === 4
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : i < 4
                  ? "border-line bg-surface-2 text-ink"
                  : "border-line text-muted"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="rounded-md border border-line p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen aria-hidden size={18} strokeWidth={1.75} className="text-accent" />
          AI Coach
        </p>
        <p className="mt-1 text-sm text-muted">4,200 kg lifted · Protein on track (155 g / 160 g)</p>
      </div>
      <ul className="divide-y divide-line border-y border-line text-sm">
        <li className="flex items-center gap-2.5 py-2.5">
          <Check aria-hidden size={18} strokeWidth={1.75} className="text-success" />
          <span className="text-muted line-through">Add one more set to incline press</span>
        </li>
        <li className="flex items-center gap-2.5 py-2.5">
          <Circle aria-hidden size={18} strokeWidth={1.75} className="text-faint" />
          40 g protein at dinner
        </li>
      </ul>
    </div>
  );
}

function SquadMock() {
  const rows = [
    { name: "Ari", streak: 12, done: true },
    { name: "Dev", streak: 9, done: true },
    { name: "Sam", streak: 4, done: false },
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="eyebrow">Squad · This week</p>
      <ol className="divide-y divide-line border-y border-line">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-4 text-muted">{i + 1}</span>
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{r.name[0]}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="flex items-center gap-1 text-muted">
              <Flame aria-hidden size={16} strokeWidth={1.75} />
              {r.streak}d
            </span>
            {r.done ? (
              <span className="w-16 text-right text-xs text-success">Logged</span>
            ) : (
              <button
                type="button"
                disabled
                className="w-16 rounded-md border border-line-strong py-1 text-xs font-medium text-muted disabled:cursor-not-allowed"
              >
                Nudge
              </button>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Streaks, the leaderboard and nudges are on the way.</p>
    </div>
  );
}
