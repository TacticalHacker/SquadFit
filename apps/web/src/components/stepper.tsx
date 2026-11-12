"use client";

import { useState, type ReactNode } from "react";
import { commitTyped } from "@calci/shared";

/** 44 × 44 px thumb targets with no double-tap zoom delay (FR-007). */
export const stepButtonClass =
  "grid min-h-11 min-w-11 touch-manipulation select-none place-items-center rounded-full bg-white/10 text-xl font-semibold transition active:scale-90 active:bg-white/20 disabled:opacity-30 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400";

/** `[−] value [+]`. The value slot is usually a NumberField so it can be typed (FR-011). */
export function Stepper({
  label,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  children,
}: {
  /** e.g. "set 2 weight": used in the buttons' accessible names. */
  label: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={stepButtonClass} onClick={onDec} disabled={decDisabled} aria-label={`Decrease ${label}`}>
        −
      </button>
      {children}
      <button type="button" className={stepButtonClass} onClick={onInc} disabled={incDisabled} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

/**
 * Shows a number; tap it to type a new one (FR-008, FR-011). 16 px text so iOS Safari never zooms on focus;
 * a decimal keypad for weight and a whole-number keypad for reps and minutes. Invalid input is reported
 * through `onError` and the previous value is kept (US2-6).
 */
export function NumberField({
  value,
  display,
  field,
  label,
  disabled,
  widthClass = "w-12",
  onCommit,
  onError,
}: {
  value: number;
  display: string;
  field: "weight" | "reps" | "minutes";
  label: string;
  disabled?: boolean;
  widthClass?: string;
  onCommit: (value: number) => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const commit = () => {
    setEditing(false);
    if (text.trim() === "" || text.trim() === String(value)) return;
    const r = commitTyped(field, text);
    if (r.ok) {
      onError(null);
      onCommit(r.value);
    } else {
      onError(r.message);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        type="text"
        inputMode={field === "weight" ? "decimal" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          e.currentTarget.select();
          // Keep the field visible above the on-screen keyboard.
          const el = e.currentTarget;
          setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className={`${widthClass} min-h-11 rounded-lg bg-white/10 px-1 text-center text-base font-bold tabular-nums ring-2 ring-lime-400 outline-none`}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setText(String(value));
        setEditing(true);
      }}
      aria-label={`${label}: ${display}. Tap to type`}
      className={`${widthClass} min-h-11 touch-manipulation rounded-lg text-center text-base font-bold tabular-nums disabled:opacity-100 focus-visible:outline-2 focus-visible:outline-lime-400`}
    >
      {display}
    </button>
  );
}
