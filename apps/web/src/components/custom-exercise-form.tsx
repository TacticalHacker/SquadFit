"use client";

import { useState, useTransition } from "react";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type GymExerciseView, type MuscleGroup } from "@calci/shared";
import { createGymExercise, removeGymExercise, updateGymExercise } from "@/server/actions/gym";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { buttonClass, chipClass, dangerLinkClass, inputClass, noticeErrorClass } from "./form-bits";

const OWN_GROUPS = MUSCLE_GROUPS.filter((g) => g !== "cardio");

/** Add, rename/regroup, or remove one of the member's own exercises (US5, FR-005). Own exercises are never Cardio. */
export function CustomExerciseSheet({
  editing,
  defaultGroup,
  onClose,
  onSaved,
  onRemoved,
}: {
  /** null = add a new one */
  editing: GymExerciseView | null;
  defaultGroup: MuscleGroup;
  onClose: () => void;
  onSaved: (exercise: GymExerciseView) => void;
  onRemoved: (exerciseId: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [group, setGroup] = useState<MuscleGroup>(editing?.group ?? (defaultGroup === "cardio" ? "chest" : defaultGroup));
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setFields({});
    startTransition(async () => {
      const r = editing ? await updateGymExercise(editing.exerciseId, { name, group }) : await createGymExercise({ name, group });
      if (r.ok) {
        onSaved(r.exercise);
        onClose();
      } else {
        setError(r.error);
        setFields(r.fields ?? {});
      }
    });
  };

  const remove = () => {
    if (!editing) return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    startTransition(async () => {
      const r = await removeGymExercise(editing.exerciseId);
      if (r.ok) {
        onRemoved(editing.exerciseId);
        onClose();
      } else setError(r.error);
    });
  };

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 text-lg font-semibold">{editing ? "Edit exercise" : "Custom exercise"}</h2>
      <SheetClose />
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        form="custom-exercise"
        disabled={pending}
        className={`min-h-12 w-full touch-manipulation text-base ${buttonClass}`}
      >
        {pending ? "Saving…" : editing ? "Save" : "Add exercise"}
      </button>
      {editing ? (
        <button type="button" onClick={remove} disabled={pending} className={dangerLinkClass}>
          {confirm ? "Tap again to remove (past logs stay)" : "Remove exercise"}
        </button>
      ) : null}
    </div>
  );

  return (
    <BottomSheet open onClose={onClose} label={editing ? "Edit exercise" : "Add a custom exercise"} header={header} footer={footer}>
      <form
        id="custom-exercise"
        className="flex flex-col gap-4 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            autoComplete="off"
            aria-invalid={fields.name ? true : undefined}
            className={`font-normal ${inputClass}`}
          />
          {fields.name ? <span className="text-xs font-normal text-danger">{fields.name}</span> : null}
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Muscle group</legend>
          <div className="flex flex-wrap gap-2">
            {OWN_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={g === group}
                onClick={() => setGroup(g)}
                className={chipClass(g === group)}
              >
                {MUSCLE_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          {fields.group ? <span className="text-xs text-danger">{fields.group}</span> : null}
        </fieldset>
      </form>
    </BottomSheet>
  );
}
