"use client";

import { useState } from "react";
import { CAPTION_MAX, MEALS, completeMacros, type FoodEntry, type Macros, type Meal, type PhotoStatus } from "@calci/shared";
import { parseCaloriesInput, parseGramsInput } from "@/lib/food-input";
import { Camera } from "lucide-react";
import { MEAL_LABEL } from "./food-add-panel";
import { buttonClass, dangerLinkClass, inputClass } from "./form-bits";

export type PhotoPatch = { caption?: string; calories?: number; macros?: Macros | null; meal?: Meal };

export const STATUS_LABEL: Record<PhotoStatus, string> = {
  pending: "Pending analysis",
  ai: "AI-estimated",
  manual: "Entered by you",
  edited: "Edited",
};
const STATUS_TONE: Record<PhotoStatus, string> = {
  pending: "border-warning/50 text-ink",
  ai: "border-accent/30 bg-accent-soft text-accent",
  manual: "border-line text-muted",
  edited: "border-line text-muted",
};

/** A photo meal: thumbnail, caption, status, and (on editable days) caption/meal, fill-in or correction, remove. */
export function PhotoEntryRow({
  entry,
  open,
  editable,
  onToggle,
  onPatch,
  onRemove,
  onInvalid,
}: {
  entry: FoodEntry;
  open: boolean;
  editable: boolean;
  onToggle: () => void;
  onPatch: (patch: PhotoPatch) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
}) {
  const photo = entry.photo!;
  const pending = photo.status === "pending";
  const m = entry.macros;
  const panelId = `entry-${entry.entryId}`;
  const tab = open ? 0 : -1;
  const input = `mt-1 ${inputClass}`;

  const [caption, setCaption] = useState(photo.caption);
  const [cal, setCal] = useState(pending ? "" : String(entry.calories));
  const [p, setP] = useState(m ? String(m.protein) : "");
  const [c, setC] = useState(m ? String(m.carbs) : "");
  const [f, setF] = useState(m ? String(m.fat) : "");

  function saveValues() {
    const calories = parseCaloriesInput(cal);
    if (!calories.ok) return onInvalid(calories.error);
    const grams = [parseGramsInput(p), parseGramsInput(c), parseGramsInput(f)];
    const bad = grams.find((g) => !g.ok);
    if (bad && !bad.ok) return onInvalid(bad.error);
    const [gp, gc, gf] = grams.map((g) => (g.ok ? g.value : undefined));
    onPatch({ calories: calories.value, macros: completeMacros({ protein: gp, carbs: gc, fat: gf }) });
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={!editable}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 enabled:hover:bg-surface-2 enabled:active:bg-surface-2 enabled:active:duration-0"
      >
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL or local preview
          <img src={photo.url} alt={photo.caption || "Meal photo"} className="size-14 shrink-0 rounded-md border border-line bg-surface-2 object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
            <Camera size={20} strokeWidth={1.75} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{photo.caption || "Photo meal"}</span>
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[photo.status]}`}>
            {STATUS_LABEL[photo.status]}
          </span>
          {m && !pending ? <span className="mt-0.5 block text-xs text-muted">P {m.protein} / C {m.carbs} / F {m.fat} g</span> : null}
        </span>
        <span className={`shrink-0 font-mono text-base font-medium ${pending ? "text-muted" : ""}`}>{pending ? "…" : `${entry.calories} kcal`}</span>
      </button>
      <div id={panelId} className={`grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {editable ? (
            <div className="flex flex-col gap-3 border-t border-line bg-paper p-4">
              {pending ? (
                <label className="text-sm text-muted">
                  Caption
                  <input tabIndex={tab} className={input} value={caption} maxLength={CAPTION_MAX} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption.trim() !== photo.caption && onPatch({ caption: caption.trim() })} />
                </label>
              ) : null}
              <p className="text-sm text-muted">{pending ? "Don't want to wait? Fill it in yourself:" : "Correct the numbers:"}</p>
              <label className="text-sm text-muted">
                Calories
                <input tabIndex={tab} className={input} inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([["Protein g", p, setP], ["Carbs g", c, setC], ["Fat g", f, setF]] as const).map(([label, value, set]) => (
                  <label key={label} className="text-sm text-muted">
                    {label}
                    <input tabIndex={tab} className={input} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
                  </label>
                ))}
              </div>
              <button type="button" tabIndex={tab} onClick={saveValues} className={buttonClass}>
                {pending ? "Save my numbers" : "Save changes"}
              </button>
              <label className="flex items-center justify-center gap-2 text-sm text-muted">
                Meal
                <select tabIndex={tab} value={entry.meal} onChange={(e) => onPatch({ meal: e.target.value as Meal })} className={`w-auto ${inputClass}`}>
                  {MEALS.map((meal) => (
                    <option key={meal} value={meal}>
                      {MEAL_LABEL[meal]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" tabIndex={tab} onClick={onRemove} className={`self-center ${dangerLinkClass}`}>
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
