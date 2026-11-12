"use client";

import { MUSCLE_GROUP_LABELS, type GymExerciseView } from "@calci/shared";

const nf = new Intl.NumberFormat("en");

/** "3 sets · 1,920 kg" or "25 min" (US3-5). */
export function gymEntrySummary(entry: NonNullable<GymExerciseView["entry"]>): string {
  if (entry.sets) return `${entry.sets.length} ${entry.sets.length === 1 ? "set" : "sets"} · ${nf.format(entry.volumeKg ?? 0)} kg`;
  return `${entry.minutes} min`;
}

export function ExerciseList({
  exercises,
  drafts,
  showGroup,
  canAdd,
  onOpen,
  onEdit,
  onAddCustom,
}: {
  exercises: GymExerciseView[];
  drafts: ReadonlySet<string>;
  showGroup: boolean;
  canAdd: boolean;
  onOpen: (exerciseId: string) => void;
  onEdit: (exerciseId: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {exercises.length === 0 ? (
        <li className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">No exercises match.</li>
      ) : null}
      {exercises.map((e) => {
        const logged = e.entry;
        const draft = drafts.has(e.exerciseId);
        return (
          <li key={e.exerciseId} className="flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => onOpen(e.exerciseId)}
              className={`flex min-h-14 flex-1 touch-manipulation items-center gap-3 rounded-2xl px-4 py-2 text-left transition active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400 ${
                logged ? "bg-lime-400/10 ring-1 ring-lime-400/30" : "bg-[#1E293B]"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  {showGroup ? <span>{MUSCLE_GROUP_LABELS[e.group]}</span> : null}
                  {!e.isBuiltIn ? <span>Yours</span> : null}
                  {logged ? <span className="font-semibold text-lime-300">✓ {gymEntrySummary(logged)}</span> : null}
                  {draft ? <span className="rounded-full bg-sky-400/15 px-2 font-semibold text-sky-200">Draft</span> : null}
                </span>
              </span>
              <span aria-hidden="true" className="text-xl text-slate-500">
                ›
              </span>
            </button>
            {!e.isBuiltIn && canAdd ? (
              <button
                type="button"
                onClick={() => onEdit(e.exerciseId)}
                aria-label={`Edit ${e.name}`}
                className="min-h-14 min-w-11 touch-manipulation rounded-2xl bg-[#1E293B] px-3 text-sm text-slate-300 focus-visible:outline-2 focus-visible:outline-lime-400"
              >
                Edit
              </button>
            ) : null}
          </li>
        );
      })}
      {canAdd ? (
        <li>
          <button
            type="button"
            onClick={onAddCustom}
            className="min-h-14 w-full touch-manipulation rounded-2xl border border-dashed border-slate-600 px-4 text-left font-semibold text-lime-300 focus-visible:outline-2 focus-visible:outline-lime-400"
          >
            + Custom Exercise
          </button>
        </li>
      ) : null}
    </ul>
  );
}
