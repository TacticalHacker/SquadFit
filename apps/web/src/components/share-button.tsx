"use client";

import { Share } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

// The sheet (canvas drawing, photo handling) loads only when someone taps Share.
const ShareSheet = dynamic(() => import("./share-sheet").then((m) => m.ShareSheet), { ssr: false });

/** Feature 016: opens the share sheet for one of the member's own workout days. */
export function ShareButton({ date, className }: { date: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-accent hover:bg-surface-2 active:bg-line active:duration-0 ${className ?? ""}`}
      >
        <Share aria-hidden size={18} strokeWidth={1.75} />
        Share
      </button>
      {open ? <ShareSheet date={date} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
