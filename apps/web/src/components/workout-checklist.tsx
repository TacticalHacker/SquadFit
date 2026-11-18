"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { MAX_MINUTES, MIN_MINUTES, applyChange, type DayChange, type DayRow, type DayView } from "@calci/shared";
import { hasDayChanged } from "@/lib/rollover";
import { Activity, ChevronRight, Dumbbell, Flame, Minus, Plus } from "lucide-react";
import { MINUTE_CHIPS } from "@/lib/workout-style";
import { setEntryMinutes, tickWorkout, untickWorkout, type ChecklistResult } from "@/server/actions/workouts";
import { AiBadge } from "./ai-badge";
import { cardClass, chipClass, dangerLinkClass, iconButtonClass, linkClass, noticeErrorClass, noticeWarnClass } from "./form-bits";
import { gymEntrySummary } from "./exercise-list";
import { ProgressRing } from "./progress-ring";

const CHECK_EVERY_MS = 60_000;
const COMMIT_DELAY_MS = 600;
const STEP = 5;
const clamp = (m: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m)));

export function WorkoutChecklist({ initialView }: { initialView: DayView }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [seen, setSeen] = useState(initialView);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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
        router.refresh(); // streak and week strip come from the server
      } else {
        setError(result.error);
        if (result.error === "This day can no longer be edited") router.refresh();
      }
    });
  }

  const date = view.date;
  const readOnly = !optimistic.editable;
  const logged = optimistic.rows.filter((r) => r.entry !== null);
  const available = optimistic.rows.filter((r) => r.entry === null && !r.removed);
  const gym = optimistic.gym;
  const gymHref = (id: string) =>
    `/workouts/gym?${date === optimistic.today ? "" : `date=${date}&`}open=${encodeURIComponent(id)}`;

  const add = (row: DayRow) => {
    setOpenId(row.workoutId);
    submit({ type: "tick", workoutId: row.workoutId }, () => tickWorkout(date, row.workoutId));
  };

  return (
    <div className="flex flex-col gap-5">
      {readOnly ? (
        <p role="status" className={noticeWarnClass}>
          This day can no longer be edited
        </p>
      ) : null}

      <ProgressRing summary={optimistic.summary} />

      <div role="alert">
        {error ? <p className={noticeErrorClass}>{error}</p> : null}
      </div>

      <section aria-labelledby="logged-h">
        <h2 id="logged-h" className="eyebrow mb-2">
          Logged {optimistic.date === optimistic.today ? "today" : "this day"}
        </h2>
        {logged.length === 0 && gym.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
            Nothing yet. Add an activity below.
          </p>
        ) : (
          <ul className={`divide-y divide-line overflow-hidden ${cardClass}`}>
            {logged.map((row) => (
              <LoggedCard
                key={row.workoutId}
                row={row}
                open={openId === row.workoutId}
                readOnly={readOnly}
                onToggle={() => setOpenId(openId === row.workoutId ? null : row.workoutId)}
                onMinutes={(minutes) =>
                  submit({ type: "setMinutes", workoutId: row.workoutId, minutes }, () =>
                    setEntryMinutes(date, row.workoutId, minutes),
                  )
                }
                onRemove={() => {
                  setOpenId(null);
                  submit({ type: "untick", workoutId: row.workoutId }, () => untickWorkout(date, row.workoutId));
                }}
              />
            ))}
            {gym.map((g) => (
              <li key={g.exerciseId}>
                <Link
                  href={gymHref(g.exerciseId)}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 active:duration-0"
                >
                  <RowIcon icon={Dumbbell} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.name}</span>
                    <span className="block text-xs text-muted">Gym · {gymEntrySummary(g)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-base font-medium">{g.minutes} min</span>
                    <span className={`block text-xs ${g.aiNote ? "font-medium text-warning" : "text-muted"}`}>{g.calories} kcal</span>
                  </span>
                  <ChevronRight aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                </Link>
                {g.aiNote ? <AiBadge reason={g.aiNote} subject={g.name} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!readOnly ? (
        <section aria-labelledby="add-h">
          <h2 id="add-h" className="eyebrow mb-2">
            Add activity
          </h2>
          {available.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
              No activities yet. Add the ones you do, like padel or a morning run.{" "}
              <Link href="/workouts/mine" className={`font-medium ${linkClass}`}>
                Add an activity
              </Link>
            </p>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {available.map((row) => {
              return (
                <li key={row.workoutId}>
                  <button
                    type="button"
                    onClick={() => add(row)}
                    aria-label={`Add ${row.name}, ${row.defaultMinutes} minutes, ${row.defaultCalories} calories`}
                    className={`flex min-h-14 w-full items-center gap-3 p-3 text-left transition-colors duration-150 hover:bg-surface-2 ${cardClass}`}
                  >
                    <RowIcon icon={Activity} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.name}</span>
                      <span className="block text-xs text-muted">
                        {row.defaultMinutes} min · {row.defaultCalories} kcal
                      </span>
                    </span>
                    <Plus aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-accent" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RowIcon({ icon: Icon }: { icon: typeof Activity }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

function LoggedCard({
  row,
  open,
  readOnly,
  onToggle,
  onMinutes,
  onRemove,
}: {
  row: DayRow;
  open: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onMinutes: (minutes: number) => void;
  onRemove: () => void;
}) {
  const entry = row.entry!;
  // Local draft so rapid taps feel instant and only the last value is sent.
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const minutes = draft ?? entry.minutes;
  // Stored calories are authoritative (they may be the AI's adjustment); a pending minutes change previews the app math.
  const calories = draft === null ? entry.calories : Math.round((entry.rateCalories * minutes) / entry.rateMinutes);

  function change(next: number) {
    const m = clamp(next);
    setDraft(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDraft(null);
      if (m !== entry.minutes) onMinutes(m);
    }, COMMIT_DELAY_MS);
  }

  const panelId = `panel-${row.workoutId}`;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 active:duration-0"
      >
        <RowIcon icon={Activity} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {row.name}
            {row.removed ? <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">removed</span> : null}
          </span>
          <span className="block text-xs text-muted">Tap to adjust</span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-base font-medium">{minutes} min</span>
          <span className={`block text-xs ${entry.aiNote && draft === null ? "font-medium text-warning" : "text-muted"}`}>{calories} kcal</span>
        </span>
      </button>
      {entry.aiNote && draft === null ? <AiBadge reason={entry.aiNote} subject={row.name} /> : null}

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-line bg-paper p-4">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={readOnly || minutes <= MIN_MINUTES}
                onClick={() => change(minutes - STEP)}
                aria-label={`Decrease minutes for ${row.name} by ${STEP}`}
                tabIndex={open ? 0 : -1}
                className={iconButtonClass}
              >
                <Minus aria-hidden size={18} strokeWidth={1.75} />
              </button>
              <p className="w-28 text-center" aria-live="polite">
                <span className="font-mono text-3xl font-medium">{minutes}</span>
                <span className="ml-1 text-sm text-muted">min</span>
              </p>
              <button
                type="button"
                disabled={readOnly || minutes >= MAX_MINUTES}
                onClick={() => change(minutes + STEP)}
                aria-label={`Increase minutes for ${row.name} by ${STEP}`}
                tabIndex={open ? 0 : -1}
                className={iconButtonClass}
              >
                <Plus aria-hidden size={18} strokeWidth={1.75} />
              </button>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted">
              <Flame aria-hidden size={16} strokeWidth={1.75} />≈ {calories} kcal burned
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {MINUTE_CHIPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={readOnly || minutes + m > MAX_MINUTES}
                  onClick={() => change(minutes + m)}
                  aria-label={`Add ${m} minutes to ${row.name}`}
                  tabIndex={open ? 0 : -1}
                  className={`${chipClass(false)} disabled:text-faint`}
                >
                  +{m}m
                </button>
              ))}
            </div>
            {readOnly ? null : (
              <button
                type="button"
                onClick={onRemove}
                tabIndex={open ? 0 : -1}
                className={`self-center ${dangerLinkClass}`}
              >
                Remove from {row.removed ? "this day" : "today's log"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
