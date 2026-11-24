"use client";

import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { useState } from "react";
import type { WeightView } from "@calci/shared";
import { WEIGHT_COPY, weightKg, weightSpan } from "@/lib/plain";
import { cardClass, secondaryButtonClass } from "./form-bits";
import { WeightSheet } from "./weight-sheet";

/**
 * Feature 017: compact Bodyweight card on /squad. Your own latest weight (only you see it), a 30-day sparkline,
 * Log weight, and a link to /squad/weight (your chart and the squad's trend).
 */
export function BodyweightSquadCard({ initialView, timezone }: { initialView: WeightView; timezone: string }) {
  const [view, setView] = useState(initialView);
  const [open, setOpen] = useState(false);

  const pts = view.slots.flatMap((s, i) => (s.average === null ? [] : [{ i, v: s.average }]));
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const W = 96;
  const H = 28;
  const spark = pts.map((p) => `${(p.i / Math.max(1, view.slots.length - 1)) * W},${hi === lo ? H / 2 : 2 + ((hi - p.v) / (hi - lo)) * (H - 4)}`).join(" ");

  return (
    <section aria-labelledby="bodyweight-heading" className={`${cardClass} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
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
        {pts.length > 1 ? (
          <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="hidden shrink-0 min-[380px]:block">
            <polyline points={spark} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" className="stroke-accent" />
          </svg>
        ) : null}
        <button type="button" onClick={() => setOpen(true)} className={`${secondaryButtonClass} shrink-0`}>
          {WEIGHT_COPY.log}
        </button>
      </div>
      <Link href="/squad/weight" className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 text-sm font-medium text-accent active:bg-surface-2">
        {WEIGHT_COPY.squadTrend}
        <ChevronRight aria-hidden size={16} strokeWidth={1.75} />
      </Link>
      {open ? <WeightSheet view={view} timezone={timezone} onView={setView} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
