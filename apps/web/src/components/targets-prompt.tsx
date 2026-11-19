"use client";

import { useActionState, useState, useTransition } from "react";
import { dismissTargetsPrompt, saveTargets } from "@/server/actions/profile";
import type { ActionState } from "@/server/actions/state";
import { Field, buttonClass, cardClass, describedBy, inputClass, secondaryButtonClass } from "./form-bits";

const initialState: ActionState = {};

/**
 * Feature 013: shown to members whose calorie and protein goals were never confirmed. Until they save, the squad
 * never sees their goals and they are not on the Protein days board.
 */
export function TargetsPrompt({ calories, protein }: { calories: number; protein: number | null }) {
  const [state, action, pending] = useActionState(saveTargets, initialState);
  const [hidden, setHidden] = useState(false);
  const [dismissing, startDismiss] = useTransition();
  if (hidden || state.message) return null;
  const err = state.fields ?? {};
  return (
    <section aria-labelledby="targets-heading" className={`${cardClass} flex flex-col gap-3 p-4`}>
      <h2 id="targets-heading" className="text-lg font-semibold">
        Set your daily goals
      </h2>
      <p className="text-sm text-muted">Check these are right. Your squad only sees goals you have saved here.</p>
      <form action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field id="tp-cal" label="Calories a day" error={err.dailyCalorieTarget}>
            <input id="tp-cal" name="dailyCalorieTarget" inputMode="numeric" defaultValue={calories} aria-invalid={err.dailyCalorieTarget ? true : undefined} aria-describedby={describedBy("tp-cal", err.dailyCalorieTarget)} className={inputClass} />
          </Field>
          <Field id="tp-pro" label="Protein a day (g)" error={err.dailyProteinTarget} hint="Leave blank for none">
            <input id="tp-pro" name="dailyProteinTarget" inputMode="numeric" defaultValue={protein ?? undefined} aria-invalid={err.dailyProteinTarget ? true : undefined} aria-describedby={describedBy("tp-pro", err.dailyProteinTarget, "hint")} className={inputClass} />
          </Field>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            Save goals
          </button>
          <button
            type="button"
            disabled={dismissing}
            onClick={() =>
              startDismiss(async () => {
                await dismissTargetsPrompt();
                setHidden(true);
              })
            }
            className={secondaryButtonClass}
          >
            Not now
          </button>
        </div>
      </form>
    </section>
  );
}
