"use client";

import { useEffect, useRef, useState } from "react";
import { MUSCLE_REGION_LABELS, workedRegions, type DayMuscleLoad, type MuscleRegion } from "@calci/shared";
import { cardClass, linkClass } from "./form-bits";
import { MuscleFigure, regionSummary } from "./muscle-figure";

/** Feature 018: front + back figure for the day's completed sets, with a one-line detail for the chosen muscle. */
export function MuscleHeatmap({ load, onShowExercises }: { load: DayMuscleLoad; onShowExercises: (region: MuscleRegion) => void }) {
  const [picked, setPicked] = useState<MuscleRegion | null>(null);
  const card = useRef<HTMLDivElement>(null);
  // A region that stopped being worked (sets removed) can't stay selected.
  const selected = picked && load[picked].step > 0 ? picked : null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    const onDown = (e: PointerEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) setPicked(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [selected]);

  const worked = workedRegions(load).map((r) => MUSCLE_REGION_LABELS[r].toLowerCase());
  const toggle = (r: MuscleRegion) => setPicked((cur) => (cur === r ? null : r));

  return (
    <section ref={card} aria-label={`Muscles worked: ${worked.join(", ")}`} className={`${cardClass} flex flex-col gap-2 px-4 py-3`}>
      <div className="flex justify-center gap-6">
        <MuscleFigure side="front" load={load} selected={selected} onSelect={setPicked} onToggle={toggle} />
        <MuscleFigure side="back" load={load} selected={selected} onSelect={setPicked} onToggle={toggle} />
      </div>
      {selected ? (
        <p aria-live="polite" className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-t border-line pt-2 text-sm text-ink">
          <span>{regionSummary(MUSCLE_REGION_LABELS[selected], load[selected])}</span>
          <button type="button" className={`${linkClass} min-h-11`} onClick={() => onShowExercises(selected)}>
            Show exercises
          </button>
        </p>
      ) : (
        <p className="text-center text-xs text-muted">Tap a muscle for its sets</p>
      )}
    </section>
  );
}
