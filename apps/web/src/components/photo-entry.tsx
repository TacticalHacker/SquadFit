"use client";

import { useState } from "react";
import { CAPTION_MAX, MEALS, completeMacros, type FoodEntry, type Macros, type Meal, type PhotoStatus } from "@calci/shared";
import { parseCaloriesInput, parseGramsInput } from "@/lib/food-input";
import { MEAL_LABEL } from "./food-add-panel";

export type PhotoPatch = { caption?: string; calories?: number; macros?: Macros | null; meal?: Meal };

export const STATUS_LABEL: Record<PhotoStatus, string> = {
  pending: "Pending analysis",
  ai: "AI-estimated",
  manual: "Entered by you",
  edited: "Edited",
};
const STATUS_TONE: Record<PhotoStatus, string> = {
  pending: "bg-amber-400/20 text-amber-200",
  ai: "bg-purple-400/20 text-purple-200",
  manual: "bg-cyan-400/20 text-cyan-200",
  edited: "bg-slate-400/20 text-slate-200",
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
  const input = "w-full rounded-lg border border-slate-600 bg-[#0F172A] px-2 py-1.5 text-slate-100 focus-visible:outline-2 focus-visible:outline-lime-400";

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
    <li className="overflow-hidden rounded-2xl bg-[#1E293B]">
      <button
        type="button"
        onClick={onToggle}
        disabled={!editable}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-lime-400"
      >
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL or local preview
          <img src={photo.url} alt={photo.caption || "Meal photo"} className="size-14 shrink-0 rounded-lg bg-slate-700 object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-lg bg-slate-700 text-xl">📷</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{photo.caption || "Photo meal"}</span>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[photo.status]}`}>
            {STATUS_LABEL[photo.status]}
          </span>
          {m && !pending ? <span className="mt-0.5 block text-xs text-slate-400">P {m.protein} / C {m.carbs} / F {m.fat} g</span> : null}
        </span>
        <span className={`text-lg font-bold tabular-nums ${pending ? "text-slate-500" : "text-orange-300"}`}>{pending ? "…" : `${entry.calories} kcal`}</span>
      </button>
      <div id={panelId} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {editable ? (
            <div className="flex flex-col gap-3 border-t border-white/5 p-3">
              {pending ? (
                <label className="text-sm text-slate-300">
                  Caption
                  <input tabIndex={tab} className={input} value={caption} maxLength={CAPTION_MAX} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption.trim() !== photo.caption && onPatch({ caption: caption.trim() })} />
                </label>
              ) : null}
              <p className="text-sm text-slate-300">{pending ? "Don't want to wait? Fill it in yourself:" : "Correct the numbers:"}</p>
              <label className="text-sm text-slate-300">
                Calories
                <input tabIndex={tab} className={input} inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([["Protein g", p, setP], ["Carbs g", c, setC], ["Fat g", f, setF]] as const).map(([label, value, set]) => (
                  <label key={label} className="text-sm text-slate-300">
                    {label}
                    <input tabIndex={tab} className={input} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
                  </label>
                ))}
              </div>
              <button type="button" tabIndex={tab} onClick={saveValues} className="rounded-xl bg-lime-400 py-2 font-semibold text-slate-900 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white">
                {pending ? "Save my numbers" : "Save changes"}
              </button>
              <label className="flex items-center justify-center gap-2 text-sm text-slate-300">
                Meal
                <select tabIndex={tab} value={entry.meal} onChange={(e) => onPatch({ meal: e.target.value as Meal })} className="rounded-lg border border-slate-600 bg-[#0F172A] px-2 py-1 text-slate-100 focus-visible:outline-2 focus-visible:outline-lime-400">
                  {MEALS.map((meal) => (
                    <option key={meal} value={meal}>
                      {MEAL_LABEL[meal]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" tabIndex={tab} onClick={onRemove} className="self-center text-sm text-red-300 underline focus-visible:outline-2 focus-visible:outline-lime-400">
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
