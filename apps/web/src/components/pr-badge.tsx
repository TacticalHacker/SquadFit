"use client";

import type { ReactNode } from "react";
import type { PrPreview } from "@calci/shared";
import { BIG_JUMP_HINT, baselineLine, prBadgeText } from "@/lib/plain";

/**
 * Feature 019: the line above Save. A PR turns it into a turmeric pill; a first-ever log reads "Baseline set";
 * otherwise the normal totals line. Fixed height, so Save never moves.
 */
export function PrSummaryLine({
  preview,
  baseline,
  volumeKg,
  children,
}: {
  preview: PrPreview | null;
  baseline: boolean;
  volumeKg: number | null;
  /** The normal totals line. */
  children: ReactNode;
}) {
  const key = preview ? `${preview.setIndex}:${preview.type}:${preview.value}` : baseline ? "baseline" : "normal";
  return (
    <div className="flex h-12 flex-col items-center justify-center text-center text-sm">
      <div key={key} className="fade-in flex flex-col items-center">
        {preview ? (
          <>
            <span className="rounded-full bg-accent-fill px-3 py-0.5 font-semibold text-on-accent-fill">{prBadgeText(preview)}</span>
            {preview.bigJump ? <span className="mt-0.5 text-xs text-warning">{BIG_JUMP_HINT}</span> : null}
          </>
        ) : baseline && volumeKg !== null ? (
          <span className="text-muted">{baselineLine(volumeKg)}</span>
        ) : (
          <span className="text-muted">{children}</span>
        )}
      </div>
    </div>
  );
}
