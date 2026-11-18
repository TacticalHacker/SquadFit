"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * "AI adjusted" badge for a workout whose calories the AI coach changed (feature 007, FR-021).
 * Activating it reveals the one-line reason; Escape or a click elsewhere hides it. Rendered as a sibling of the
 * row's own button/link (interactive elements can't nest).
 */
export function AiBadge({ reason, subject }: { reason: string; subject: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="px-4 pb-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`AI adjusted calories for ${subject}${open ? "" : ", show reason"}`}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex min-h-11 items-center rounded-md"
      >
        <span className="inline-flex items-center rounded-full border border-warning/50 px-2 py-0.5 text-xs font-medium text-ink transition-colors duration-150 group-hover:bg-warning/10">
          AI adjusted
        </span>
      </button>
      {open ? (
        <p id={id} role="note" className="-mt-1 mb-1 truncate text-xs text-muted" title={reason}>
          {reason}
        </p>
      ) : null}
    </div>
  );
}
