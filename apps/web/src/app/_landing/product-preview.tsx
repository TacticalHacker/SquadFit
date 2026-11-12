"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

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
      <div role="tablist" aria-label="Product preview" className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/5 p-1">
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
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                selected ? "bg-emerald-500 text-[#0D0F12]" : "text-zinc-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Phone frame */}
      <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] p-2 shadow-2xl shadow-purple-950/40">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0D0F12] px-4 pb-6 pt-8">
          <div aria-hidden className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
          <div
            role="tabpanel"
            id={`${base}-panel`}
            aria-labelledby={`${base}-tab-${active}`}
            tabIndex={0}
            className="min-h-[19rem] focus-visible:outline-none"
          >
            {active === "gym" ? <GymMock /> : active === "pulse" ? <PulseMock /> : <SquadMock />}
          </div>
        </div>
      </div>
    </div>
  );
}

function GymMock() {
  // 80 + 80 + 82.5 kg, 8 reps each = 1,940 kg (volume = Σ weight × reps, as in gymTotals).
  const sets = [80, 80, 82.5];
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs uppercase tracking-wider text-zinc-400">Chest · Today</p>
      <div className="rounded-2xl border border-white/10 bg-[#161920] p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">Bench Press</h3>
          <span className="text-xs text-zinc-400">Last: 77.5 kg × 8</span>
        </div>
        <ul className="mt-3 space-y-2">
          {sets.map((kg, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span className="text-zinc-400">Set {i + 1}</span>
              <span className="flex items-center gap-2 font-medium text-white">
                <Chip>−</Chip>{kg} kg<Chip>+</Chip>
              </span>
              <span className="flex items-center gap-2 font-medium text-white">
                <Chip>−</Chip>8<Chip>+</Chip>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-zinc-300">
          3 sets × 8 · top set 82.5 kg · <span className="font-semibold text-emerald-400">1,940 kg volume</span>
        </p>
      </div>
      <div className="mt-auto rounded-xl bg-emerald-500 py-3 text-center text-sm font-semibold text-[#0D0F12]">Save</div>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span aria-hidden className="grid size-6 place-items-center rounded-full bg-white/10 text-xs text-zinc-200">
      {children}
    </span>
  );
}

function PulseMock() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wider text-zinc-400">Workouts · Today</p>
      <div className="flex gap-1.5" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className={`grid h-10 flex-1 place-items-center rounded-lg text-xs ${i === 4 ? "bg-emerald-500 font-semibold text-[#0D0F12]" : i < 4 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-zinc-500"}`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border border-purple-400/40 bg-purple-500/10 p-4">
        <p className="text-sm font-semibold text-purple-200">✨ AI Coach</p>
        <p className="mt-1 text-sm text-white">4,200 kg lifted · Protein on track (155 g / 160 g)</p>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="rounded-xl bg-[#161920] px-3 py-2 text-zinc-300">
          <span className="text-emerald-400">✓</span> Add one more set to incline press
        </li>
        <li className="rounded-xl bg-[#161920] px-3 py-2 text-zinc-300">
          <span className="text-zinc-500">○</span> 40 g protein at dinner
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-zinc-400">Squad · This week</p>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-200">
          Coming soon
        </span>
      </div>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 rounded-xl bg-[#161920] px-3 py-3 text-sm">
            <span className="w-4 text-zinc-500">{i + 1}</span>
            <span className="grid size-8 place-items-center rounded-full bg-white/10 font-semibold text-white">{r.name[0]}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-white">{r.name}</span>
            <span className="text-orange-300">🔥 {r.streak}d</span>
            {r.done ? (
              <span className="w-16 text-right text-xs text-emerald-400">Logged</span>
            ) : (
              <button
                type="button"
                disabled
                className="w-16 rounded-full border border-emerald-400/50 py-1 text-xs font-medium text-emerald-300 disabled:cursor-not-allowed"
              >
                Nudge
              </button>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-zinc-400">Streaks, the leaderboard and nudges are on the way.</p>
    </div>
  );
}
