import type { ReactNode } from "react";

/*
 * Shared "Training Log" class strings. Colours come only from the theme tokens in globals.css;
 * the focus ring is global (:focus-visible), so nothing here sets one.
 */

const motion = "transition-colors duration-150";

export const inputClass = `w-full min-h-11 rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-faint ${motion} focus:border-accent aria-[invalid=true]:border-danger disabled:text-faint`;

/** Solid turmeric: the only solid accent fill, at most one per screen section. */
export const buttonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-fill px-4 py-2 font-semibold text-on-accent-fill ${motion} hover:bg-accent-fill-hover active:bg-accent-fill-hover active:duration-0 disabled:opacity-50`;

export const secondaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 font-medium text-ink ${motion} hover:bg-surface-2 active:bg-line active:duration-0 disabled:opacity-50`;

/** Text-only action, e.g. "Remove" under a form. */
export const dangerLinkClass = `inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-sm text-danger underline-offset-4 hover:underline disabled:opacity-50`;

export const cardClass = "rounded-lg border border-line bg-surface shadow-card";

/** Square stepper / icon button: surface-2 fill, ink icon, 44 px. */
export const iconButtonClass = `grid min-h-11 min-w-11 shrink-0 touch-manipulation select-none place-items-center rounded-md bg-surface-2 text-ink ${motion} hover:bg-line active:bg-line-strong active:duration-0 disabled:text-faint disabled:hover:bg-surface-2`;

/** Chip / toggle. Selected uses accent-soft + accent border/text. */
export const chipClass = (selected: boolean) =>
  `inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center rounded-full border px-4 text-sm font-medium ${motion} ${
    selected ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-line active:duration-0"
  }`;

/** Two-option segmented control (e.g. Gym | Activities). */
export const segmentGroupClass = "grid gap-1 rounded-lg border border-line bg-surface-2 p-1";
export const segmentClass = (current: boolean) =>
  `flex min-h-10 items-center justify-center rounded-md text-sm font-medium ${motion} ${
    current ? "border border-line bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
  }`;

export const noticeWarnClass = "rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-ink";
export const noticeErrorClass = "rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger";
export const noticeOkClass = "rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success";

/** Small outlined label (pills only for tiny badges). */
export const badgeClass = "inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted";

/** Text link: neutral ink, never the accent (the accent is kept for selection and rank #1). */
export const linkClass = `text-ink-2 underline underline-offset-4 decoration-line-strong ${motion} hover:text-ink hover:decoration-ink-2`;

/** Label + control + linked error/hint text. Pair the control with `describedBy(id, error, hint)`. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function FormMessage({ error, message }: { error?: string | undefined; message?: string | undefined }) {
  if (error)
    return (
      <p role="alert" className={noticeErrorClass}>
        {error}
      </p>
    );
  if (message)
    return (
      <p role="status" className={noticeOkClass}>
        {message}
      </p>
    );
  return null;
}
