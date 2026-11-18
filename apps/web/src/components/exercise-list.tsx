"use client";

import { MUSCLE_GROUP_LABELS, type GymExerciseView } from "@calci/shared";
import { Check, ChevronRight, Plus } from "lucide-react";
import { AiBadge } from "./ai-badge";
import { cardClass } from "./form-bits";

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
    <ul className={`divide-y divide-line overflow-hidden ${cardClass}`}>
      {exercises.length === 0 ? (
        <li className="px-4 py-6 text-center text-sm text-muted">No exercises match.</li>
      ) : null}
      {exercises.map((e) => {
        const logged = e.entry;
        const draft = drafts.has(e.exerciseId);
        return (
          <li key={e.exerciseId}>
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => onOpen(e.exerciseId)}
                className="flex min-h-14 min-w-0 flex-1 touch-manipulation items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {showGroup ? <span>{MUSCLE_GROUP_LABELS[e.group]}</span> : null}
                    {!e.isBuiltIn ? <span>Yours</span> : null}
                    {logged ? (
                      <span className="inline-flex items-center gap-1 font-medium text-success">
                        <Check aria-hidden size={14} strokeWidth={2} />
                        {gymEntrySummary(logged)} · {logged.calories} kcal
                      </span>
                    ) : null}
                    {draft ? <span className="rounded-full border border-line-strong bg-surface-2 px-2 font-medium text-ink">Draft</span> : null}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
              </button>
              {!e.isBuiltIn && canAdd ? (
                <button
                  type="button"
                  onClick={() => onEdit(e.exerciseId)}
                  aria-label={`Edit ${e.name}`}
                  className="min-h-14 min-w-11 touch-manipulation border-l border-line px-4 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                >
                  Edit
                </button>
              ) : null}
            </div>
            {logged?.aiNote ? <AiBadge reason={logged.aiNote} subject={e.name} /> : null}
          </li>
        );
      })}
      {canAdd ? (
        <li>
          <button
            type="button"
            onClick={onAddCustom}
            className="flex min-h-14 w-full touch-manipulation items-center gap-2 px-4 text-left font-medium text-accent transition-colors duration-150 hover:bg-surface-2"
          >
            <Plus aria-hidden size={18} strokeWidth={1.75} />
            Custom Exercise
          </button>
        </li>
      ) : null}
    </ul>
  );
}
