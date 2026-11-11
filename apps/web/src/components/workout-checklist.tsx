"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { applyChange, type DayChange, type DayRow, type DayView } from "@calci/shared";
import { parseMinutesInput } from "@/lib/minutes-input";
import { hasDayChanged } from "@/lib/rollover";
import { setEntryMinutes, tickWorkout, untickWorkout, type ChecklistResult } from "@/server/actions/workouts";
import { DaySummary } from "./day-summary";
import { inputClass } from "./form-bits";

const CHECK_EVERY_MS = 60_000;

export function WorkoutChecklist({ initialView }: { initialView: DayView }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [seen, setSeen] = useState(initialView);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(view, applyChange);

  // A refresh or navigation delivered a new server view: adopt it.
  if (seen !== initialView) {
    setSeen(initialView);
    setView(initialView);
  }

  // Follow local midnight (FR-018): re-check on focus, visibility and every minute.
  const { today, timezone } = view;
  useEffect(() => {
    const check = () => {
      if (hasDayChanged(new Date(), timezone, today)) router.replace("/workouts");
    };
    const id = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, timezone, today]);

  function submit(change: DayChange, call: () => Promise<ChecklistResult>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      const result = await call();
      if (result.ok) {
        setView(result.view);
      } else {
        setError(result.error);
        if (result.error === "This day can no longer be edited") router.refresh();
      }
    });
  }

  const date = view.date;
  const disabled = !optimistic.editable;

  return (
    <div className="flex flex-col gap-4">
      {disabled ? (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          This day can no longer be edited
        </p>
      ) : null}
      <DaySummary summary={optimistic.summary} />
      <div role="alert" className="min-h-0">
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>
        ) : null}
      </div>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {optimistic.rows.map((row) => (
          <Row
            key={row.workoutId}
            row={row}
            disabled={disabled}
            onToggle={(checked) =>
              submit(
                { type: checked ? "tick" : "untick", workoutId: row.workoutId },
                () => (checked ? tickWorkout(date, row.workoutId) : untickWorkout(date, row.workoutId)),
              )
            }
            onMinutes={(minutes) =>
              submit({ type: "setMinutes", workoutId: row.workoutId, minutes }, () =>
                setEntryMinutes(date, row.workoutId, minutes),
              )
            }
            onInvalid={setError}
          />
        ))}
      </ul>
    </div>
  );
}

function Row({
  row,
  disabled,
  onToggle,
  onMinutes,
  onInvalid,
}: {
  row: DayRow;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onMinutes: (minutes: number) => void;
  onInvalid: (message: string) => void;
}) {
  const ticked = row.entry !== null;
  const minutes = row.entry?.minutes ?? row.defaultMinutes;
  const calories = row.entry?.calories ?? row.defaultCalories;
  const [draft, setDraft] = useState<string | null>(null);
  const checkId = `w-${row.workoutId}`;
  // A removed custom workout can't be newly ticked, only edited/unticked while it has an entry.
  const cannotTick = !ticked && row.removed;

  function commit() {
    if (draft === null) return;
    const parsed = parseMinutesInput(draft);
    setDraft(null);
    if (!parsed.ok) return onInvalid(parsed.error);
    if (parsed.minutes !== minutes) onMinutes(parsed.minutes);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <input
        id={checkId}
        type="checkbox"
        className="size-5 accent-emerald-600"
        checked={ticked}
        disabled={disabled || cannotTick}
        aria-label={`${row.name}, ${row.defaultMinutes} minutes, ${row.defaultCalories} calories`}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <label htmlFor={checkId} className="min-w-0 flex-1 font-medium">
        {row.name}
        {row.removed ? (
          <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal dark:bg-zinc-800">removed</span>
        ) : null}
      </label>
      {ticked ? (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          step={1}
          aria-label={`Minutes for ${row.name}`}
          disabled={disabled}
          className={`${inputClass} w-20 py-1`}
          value={draft ?? String(minutes)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      ) : (
        <span className="text-sm text-zinc-500 tabular-nums">{minutes} min</span>
      )}
      <span className={`w-20 text-right text-sm tabular-nums ${ticked ? "font-medium" : "text-zinc-500"}`}>
        {calories} kcal
      </span>
    </li>
  );
}
