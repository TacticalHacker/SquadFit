"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { BottomSheet, SheetClose } from "./bottom-sheet";

/** Feature 013: a small (i) that opens one plain sentence. Replaces explanation paragraphs. */
export function InfoTip({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Tips sit inside tappable cards; opening one must not follow the card's link.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`About ${title}`}
        className="grid min-h-11 min-w-11 shrink-0 touch-manipulation place-items-center rounded-md text-muted transition-colors duration-150 hover:text-ink active:bg-surface-2 active:duration-0"
      >
        <Info aria-hidden size={16} strokeWidth={1.75} />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        label={title}
        header={
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <SheetClose />
          </div>
        }
      >
        <p className="pb-4 text-base text-ink">{text}</p>
      </BottomSheet>
    </>
  );
}
