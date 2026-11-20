"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animateSpring, project, rubberband, type SpringState } from "@/lib/spring";
import { iconButtonClass } from "./form-bits";

const SheetDismiss = createContext<() => void>(() => {});

/** Close button for a sheet header: slides the sheet down the way it came, then calls the sheet's onClose. */
export function SheetClose({ label = "Close" }: { label?: string }) {
  const dismiss = useContext(SheetDismiss);
  return (
    <button type="button" onClick={() => dismiss()} aria-label={label} className={iconButtonClass}>
      <X aria-hidden size={18} strokeWidth={1.75} />
    </button>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Bottom sheet built on the native <dialog> (research R9): focus trap, Escape and an inert page for free.
 *
 * Motion (Apple "fluid interfaces"): one critically damped spring drives every movement, always starting from
 * the on-screen position, so the sheet can be grabbed mid-animation. Dragging tracks the finger 1:1 (with
 * rubber-band resistance upward); on release the flick's momentum is projected to decide close vs. stay, and
 * the release velocity carries into the spring. It enters from and exits to the bottom; the scrim follows.
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
  /** Called once the sheet has finished closing. */
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useRef<SpringState>({ value: 0, velocity: 0 });
  const stop = useRef<(() => SpringState) | null>(null);
  const closing = useRef(false);
  const drag = useRef<{ startY: number; startPos: number; samples: { y: number; t: number }[] } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const height = () => panelRef.current?.offsetHeight ?? 1;

  const paint = useCallback((value: number) => {
    pos.current.value = value;
    const p = panelRef.current;
    const d = dialogRef.current;
    if (p) p.style.transform = value === 0 ? "" : `translateY(${value}px)`;
    if (d) d.style.setProperty("--sheet-dim", String(Math.max(0, Math.min(1, 1 - value / height()))));
  }, []);

  /** Interrupt whatever is running and report the live position. */
  const halt = useCallback(() => {
    if (stop.current) pos.current = stop.current();
    stop.current = null;
  }, []);

  const springTo = useCallback(
    (to: number, velocity: number, onRest?: () => void) => {
      halt();
      if (reducedMotion()) {
        paint(to);
        onRest?.();
        return;
      }
      stop.current = animateSpring({
        from: { value: pos.current.value, velocity },
        to,
        params: { damping: 1, response: 0.32 },
        onUpdate: paint,
        onRest: () => {
          stop.current = null;
          onRest?.();
        },
      });
    },
    [paint, halt],
  );

  const dismiss = useCallback(
    (velocity = 0) => {
      if (closing.current) return;
      closing.current = true;
      springTo(height() + 24, Number.isFinite(velocity) ? Math.max(0, velocity) : 0, () => {
        dialogRef.current?.close();
        onCloseRef.current();
      });
    },
    [springTo],
  );

  // Enter from the bottom, before the first paint.
  useLayoutEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      closing.current = false;
      d.showModal();
      paint(height());
      springTo(0, 0);
    } else if (open && !closing.current && !stop.current && !drag.current && pos.current.value !== 0) {
      // Effects re-ran mid-entrance (Strict Mode, Activity) and the cleanup cancelled the spring:
      // finish the entrance instead of leaving the sheet parked below the screen.
      springTo(0, 0);
    }
    if (!open && d.open) {
      halt();
      d.close();
    }
  }, [open, paint, springTo, halt]);

  useEffect(
    () => () => {
      stop.current?.();
      stop.current = null;
    },
    [],
  );

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

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Let buttons in the header work normally.
    if (closing.current || (e.target as HTMLElement).closest("button, a, input")) return;
    halt(); // grab it wherever it is right now
    drag.current = { startY: e.clientY, startPos: pos.current.value, samples: [{ y: e.clientY, t: e.timeStamp }] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const raw = d.startPos + (e.clientY - d.startY);
    paint(raw < 0 ? -rubberband(-raw, height()) : raw);
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0]!.t > 100) d.samples.shift();
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const first = d.samples[0]!;
    const dt = (e.timeStamp - first.t) / 1000;
    const velocity = dt > 0 ? (e.clientY - first.y) / dt : 0; // px/s, positive = downward
    // Decide from where the flick is heading, not where the finger let go.
    if (pos.current.value + project(velocity) > height() * 0.5) dismiss(velocity);
    else springTo(0, velocity);
  };

  return (
    <SheetDismiss.Provider value={dismiss}>
      <dialog
        ref={dialogRef}
        aria-label={label}
        onCancel={(e) => {
          e.preventDefault();
          dismiss();
        }}
        onClick={(e) => {
          // A click on the <dialog> itself (not the panel) is a click on the backdrop.
          if (e.target === dialogRef.current) dismiss();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 h-auto max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-ink sm:mx-auto sm:max-w-lg"
      >
        <div ref={panelRef} className="flex max-h-[85dvh] flex-col rounded-t-lg border border-b-0 border-line bg-surface">
          <div
            className="shrink-0 cursor-grab touch-none select-none px-4 pt-2 pb-3 active:cursor-grabbing"
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
    </SheetDismiss.Provider>
  );
}
