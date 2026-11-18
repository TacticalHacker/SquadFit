"use client";

import { useState, useTransition } from "react";
import type { NutritionSharing } from "@calci/shared";
import { saveNutritionSharing } from "@/server/actions/squad";
import { buttonClass, cardClass, secondaryButtonClass } from "./form-bits";

const OPTIONS: { id: NutritionSharing; title: string; text: string }[] = [
  { id: "off", title: "Off", text: "Nothing about your food is shown to the squad." },
  { id: "totals", title: "Daily totals", text: "Calories in, protein, carbs, fat and calories burned in workouts." },
  { id: "meals", title: "Totals + meals", text: "Totals plus your meals, their macros and food photos." },
];

/** One-time card on the first visit to the leaderboard after launch (feature 011, FR-026). */
export function NutritionCard() {
  const [choice, setChoice] = useState<NutritionSharing>("off");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  const send = (value: string) =>
    startTransition(async () => {
      const r = await saveNutritionSharing(value);
      if (r.ok) setHidden(true);
      else setError(true);
    });

  return (
    <section aria-labelledby="nutrition-card-heading" className={`${cardClass} flex flex-col gap-3 p-4`}>
      <h2 id="nutrition-card-heading" className="text-lg font-semibold">
        You can now share your nutrition with your squad
      </h2>
      <p className="text-sm text-muted">It&apos;s your choice and you can change it any time in Settings. Off is the default.</p>
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Share my nutrition with the squad</legend>
        {OPTIONS.map((o) => (
          <label key={o.id} className="flex min-h-11 items-start gap-3 py-1">
            <input type="radio" name="nutritionSharing" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} className="mt-1 size-5 shrink-0 accent-accent" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">{o.title}</span>
              <span className="text-sm text-muted">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t save. Try again.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => send(choice)} className={buttonClass}>
          Save
        </button>
        <button type="button" disabled={pending} onClick={() => send("dismiss")} className={secondaryButtonClass}>
          Not now
        </button>
      </div>
    </section>
  );
}
