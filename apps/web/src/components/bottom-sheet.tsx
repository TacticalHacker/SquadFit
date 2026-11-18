"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

/**
 * Slide-up bottom sheet built on the native <dialog> (research R9): focus trap, Escape and an inert page for free.
 * Close by tapping the backdrop, pressing Escape, the close button in `header`, or dragging the handle/header down.
 * Height is capped at 85% of the *visible* viewport (dvh) so the footer stays above Safari's toolbar and the keyboard.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  header,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number; dy: number } | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Stop the page behind from scrolling while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  const setOffset = (dy: number, animate: boolean) => {
    const p = panelRef.current;
    if (!p) return;
    p.style.transition = animate ? "" : "none";
    p.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Let buttons in the header work normally.
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    drag.current = { startY: e.clientY, startT: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    setOffset(drag.current.dy, false);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const height = panelRef.current?.offsetHeight ?? 1;
    const velocity = d.dy / Math.max(1, e.timeStamp - d.startT);
    setOffset(0, true);
    if (d.dy > height * 0.25 || (d.dy > 24 && velocity > 0.5)) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the <dialog> itself (not the panel) is a click on the backdrop.
        if (e.target === dialogRef.current) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 h-auto max-h-none w-full max-w-none bg-transparent p-0 text-ink sm:mx-auto sm:max-w-lg"
    >
      <div
        ref={panelRef}
        className="flex max-h-[85dvh] flex-col rounded-t-lg border border-b-0 border-line bg-surface transition-transform duration-200 ease-out starting:translate-y-full motion-reduce:transition-none"
      >
        <div
          className="shrink-0 touch-none select-none px-4 pt-2 pb-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-4 py-3">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
