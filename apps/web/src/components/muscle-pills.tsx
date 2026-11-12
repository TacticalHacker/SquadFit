"use client";

import { useEffect, useRef } from "react";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from "@calci/shared";

/** Sticky, sideways-scrolling muscle-group pills (FR-003). Only this bar scrolls sideways, never the page. */
export function MusclePills({ value, onChange, dimmed }: { value: MuscleGroup; onChange: (g: MuscleGroup) => void; dimmed: boolean }) {
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <div role="group" aria-label="Muscle group" className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-2">
      {MUSCLE_GROUPS.map((g) => {
        const active = g === value && !dimmed;
        return (
          <button
            key={g}
            ref={g === value ? selected : undefined}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(g)}
            className={`min-h-11 shrink-0 snap-start touch-manipulation rounded-full px-4 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400 ${
              active ? "bg-lime-400 text-slate-900" : "bg-[#1E293B] text-slate-300 active:bg-slate-700"
            }`}
          >
            {MUSCLE_GROUP_LABELS[g]}
          </button>
        );
      })}
    </div>
  );
}
