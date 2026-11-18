"use client";

import { useActionState, useTransition } from "react";
import { createCustomWorkout, removeCustomWorkout, updateCustomWorkout } from "@/server/actions/workouts";
import type { ActionState } from "@/server/actions/state";
import { Field, FormMessage, buttonClass, cardClass, describedBy, inputClass, secondaryButtonClass } from "./form-bits";

interface Initial {
  workoutId: string;
  name: string;
  defaultMinutes: number;
  defaultCalories: number;
}

const empty: ActionState = {};

/** Add form (no `workout`) or per-row edit form with Save and Remove. */
export function CustomWorkoutForm({ workout }: { workout?: Initial }) {
  const [state, action, pending] = useActionState(workout ? updateCustomWorkout : createCustomWorkout, empty);
  const [removing, startRemove] = useTransition();
  const p = workout ? workout.workoutId : "new";
  const f = state.fields ?? {};
  return (
    <form
      action={action}
      // Reset the add form after a successful add by keying on the message.
      key={workout ? undefined : state.message ? "added" : "idle"}
      className={`flex flex-col gap-4 p-4 sm:p-5 ${cardClass}`}
    >
      {workout ? <input type="hidden" name="workoutId" value={workout.workoutId} /> : null}
      <Field id={`${p}-name`} label="Name" error={f.name}>
        <input
          id={`${p}-name`}
          name="name"
          maxLength={40}
          required
          defaultValue={workout?.name ?? ""}
          className={inputClass}
          aria-invalid={f.name ? true : undefined}
          aria-describedby={describedBy(`${p}-name`, f.name)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${p}-min`} label="Default minutes" error={f.defaultMinutes}>
          <input
            id={`${p}-min`}
            name="defaultMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            step={1}
            required
            defaultValue={workout?.defaultMinutes ?? ""}
            className={inputClass}
            aria-invalid={f.defaultMinutes ? true : undefined}
            aria-describedby={describedBy(`${p}-min`, f.defaultMinutes)}
          />
        </Field>
        <Field id={`${p}-cal`} label="Default calories" error={f.defaultCalories}>
          <input
            id={`${p}-cal`}
            name="defaultCalories"
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            step={1}
            required
            defaultValue={workout?.defaultCalories ?? ""}
            className={inputClass}
            aria-invalid={f.defaultCalories ? true : undefined}
            aria-describedby={describedBy(`${p}-cal`, f.defaultCalories)}
          />
        </Field>
      </div>
      <FormMessage error={state.error && !state.fields ? state.error : undefined} message={state.message} />
      <div className="flex gap-2">
        <button type="submit" className={buttonClass} disabled={pending}>
          {workout ? "Save" : "Add workout"}
        </button>
        {workout ? (
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={removing}
            onClick={() => startRemove(() => removeCustomWorkout(workout.workoutId))}
          >
            Remove
          </button>
        ) : null}
      </div>
    </form>
  );
}
