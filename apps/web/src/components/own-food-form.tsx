"use client";

import { useActionState, useTransition } from "react";
import { createOwnFood, removeOwnFood, updateOwnFood } from "@/server/actions/food";
import type { ActionState } from "@/server/actions/state";
import { Field, FormMessage, buttonClass, describedBy, inputClass, secondaryButtonClass } from "./form-bits";

interface Initial {
  foodId: string;
  name: string;
  serving: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number } | null;
}

const empty: ActionState = {};

/** Add form (no `food`) or per-row edit form with Save and Remove. */
export function OwnFoodForm({ food }: { food?: Initial }) {
  const [state, action, pending] = useActionState(food ? updateOwnFood : createOwnFood, empty);
  const [removing, startRemove] = useTransition();
  const p = food ? food.foodId : "new";
  const f = state.fields ?? {};
  const num = (id: string, label: string, key: "protein" | "carbs" | "fat") => (
    <Field id={`${p}-${id}`} label={label} error={f[key]}>
      <input
        id={`${p}-${id}`}
        name={key}
        type="text"
        inputMode="decimal"
        placeholder="optional"
        defaultValue={food?.macros ? String(food.macros[key]) : ""}
        className={inputClass}
        aria-invalid={f[key] ? true : undefined}
        aria-describedby={describedBy(`${p}-${id}`, f[key])}
      />
    </Field>
  );
  return (
    <form
      action={action}
      key={food ? undefined : state.message ? "added" : "idle"}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      {food ? <input type="hidden" name="foodId" value={food.foodId} /> : null}
      <Field id={`${p}-name`} label="Name" error={f.name}>
        <input id={`${p}-name`} name="name" maxLength={60} required defaultValue={food?.name ?? ""} className={inputClass} aria-invalid={f.name ? true : undefined} aria-describedby={describedBy(`${p}-name`, f.name)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${p}-serving`} label="Serving" error={f.serving} hint="e.g. 1 piece">
          <input id={`${p}-serving`} name="serving" maxLength={40} required defaultValue={food?.serving ?? ""} className={inputClass} aria-invalid={f.serving ? true : undefined} aria-describedby={describedBy(`${p}-serving`, f.serving, "e.g. 1 piece")} />
        </Field>
        <Field id={`${p}-cal`} label="Calories per serving" error={f.calories}>
          <input id={`${p}-cal`} name="calories" type="text" inputMode="numeric" required defaultValue={food?.calories ?? ""} className={inputClass} aria-invalid={f.calories ? true : undefined} aria-describedby={describedBy(`${p}-cal`, f.calories)} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {num("protein", "Protein g", "protein")}
        {num("carbs", "Carbs g", "carbs")}
        {num("fat", "Fat g", "fat")}
      </div>
      <FormMessage error={state.error && !state.fields ? state.error : undefined} message={state.message} />
      <div className="flex gap-2">
        <button type="submit" className={buttonClass} disabled={pending}>
          {food ? "Save" : "Add food"}
        </button>
        {food ? (
          <button type="button" className={secondaryButtonClass} disabled={removing} onClick={() => startRemove(() => removeOwnFood(food.foodId))}>
            Remove
          </button>
        ) : null}
      </div>
    </form>
  );
}
