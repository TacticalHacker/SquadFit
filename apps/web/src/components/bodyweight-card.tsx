"use client";

import { Scale } from "lucide-react";
import { useState, useTransition } from "react";
import type { WeightRange, WeightView } from "@calci/shared";
import { loadWeightView } from "@/server/actions/weight";
import { WEIGHT_COPY, weightKg, weightSpan } from "@/lib/plain";
import { cardClass, noticeErrorClass, secondaryButtonClass } from "./form-bits";
import { WeightChart } from "./weight-chart";
import { WeightSheet } from "./weight-sheet";

/** Feature 014: the member's own Bodyweight card (owner-only), on /squad/weight "Me" since feature 017. */
export function BodyweightCard({ initialView, timezone }: { initialView: WeightView; timezone: string }) {
  const [view, setView] = useState(initialView);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onRange = (range: WeightRange) =>
    start(async () => {
      const r = await loadWeightView(range);
      if (r.ok) {
        setError(null);
        setView(r.view);
      } else setError(r.error);
    });

  return (
    <section aria-labelledby="bodyweight-heading" className={`${cardClass} flex flex-col gap-4 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="bodyweight-heading" className="flex items-center gap-2 font-semibold">
            <Scale aria-hidden size={18} strokeWidth={1.75} className="text-muted" />
            {WEIGHT_COPY.title}
          </h2>
          <p className="text-sm text-muted">
            {view.latest ? (
              <>
                <span className="font-medium text-ink tabular-nums">{weightKg(view.latest.weightKg)}</span> · {weightSpan(view.latest.date, view.latest.date)}
              </>
            ) : (
              WEIGHT_COPY.none
            )}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
          {WEIGHT_COPY.log}
        </button>
      </div>

      {error ? <p className={noticeErrorClass}>{error}</p> : null}

      <WeightChart view={view} pending={pending} onRange={onRange} />

      {open ? <WeightSheet view={view} timezone={timezone} onView={setView} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
