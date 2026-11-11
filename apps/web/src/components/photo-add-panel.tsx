"use client";

import { useId, useState } from "react";
import { CAPTION_MAX, MEALS, type Meal } from "@calci/shared";
import { reducePhoto, type ReducedPhoto } from "@/lib/photo-reduce";
import { MEAL_LABEL } from "./food-add-panel";

/** Add a meal as a photo plus optional caption; it is saved as pending analysis (feature 005). */
export function PhotoAddPanel({
  initialMeal,
  onClose,
  onAdd,
}: {
  initialMeal: Meal | null;
  onClose: () => void;
  onAdd: (input: { meal: Meal; caption: string; photo: ReducedPhoto }) => void;
}) {
  const id = useId();
  const [meal, setMeal] = useState<Meal | "">(initialMeal ?? "");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<ReducedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "w-full rounded-lg border border-slate-600 bg-[#0F172A] px-3 py-2 text-slate-100 focus-visible:outline-2 focus-visible:outline-lime-400";

  async function pick(file: File | undefined) {
    setError(null);
    setPhoto(null);
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await reducePhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that photo.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!photo) return setError("Choose a photo first.");
    if (!meal) return setError("Choose a meal.");
    onAdd({ meal, caption: caption.trim(), photo });
  }

  return (
    <section aria-label="Add a photo meal" className="flex flex-col gap-3 rounded-2xl bg-[#1E293B] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Add a photo</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-400 underline focus-visible:outline-2 focus-visible:outline-lime-400">
          Cancel
        </button>
      </div>

      <label htmlFor={`${id}-file`} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 p-4 text-center text-sm text-slate-300 focus-within:outline-2 focus-within:outline-lime-400">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview, nothing to optimise
          <img src={photo.previewUrl} alt="Selected meal" className="max-h-56 rounded-lg object-contain" />
        ) : (
          <span>{busy ? "Preparing photo…" : "Take or choose a photo of your meal"}</span>
        )}
        <input id={`${id}-file`} type="file" accept="image/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} className="max-w-full text-xs" />
      </label>

      <label className="text-sm text-slate-300">
        Caption (optional)
        <input
          className={field}
          value={caption}
          maxLength={CAPTION_MAX}
          placeholder="e.g. dal, 2 rotis and a bowl of curd"
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>

      <label className="text-sm text-slate-300">
        Meal
        <select className={field} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          <option value="" disabled>
            Choose…
          </option>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABEL[m]}
            </option>
          ))}
        </select>
      </label>

      <p role="alert" className="min-h-5 text-sm text-red-300">
        {error}
      </p>
      <button
        type="button"
        onClick={save}
        disabled={busy || !photo}
        className="rounded-xl bg-lime-400 py-2.5 font-semibold text-slate-900 transition active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
      >
        Save photo
      </button>
      <p className="text-xs text-slate-400">Calories and macros are filled in later by your AI agent, or by you.</p>
    </section>
  );
}
