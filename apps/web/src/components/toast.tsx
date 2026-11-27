"use client";

import { useEffect } from "react";

const TOAST_MS = 3000;

/** Feature 019: a small status toast. Closes after 3 s or on tap; only the toast itself takes taps. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
    >
      {message ? (
        <button
          type="button"
          onClick={onDone}
          className="fade-in pointer-events-auto rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink"
        >
          {message}
        </button>
      ) : null}
    </div>
  );
}
