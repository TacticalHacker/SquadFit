"use client";

import { useId, useState } from "react";
import { CAPTION_MAX, MEALS, MEAL_LABEL, type Meal } from "@calci/shared";
import { reducePhoto, type ReducedPhoto } from "@/lib/photo-reduce";
import { buttonClass, cardClass, inputClass } from "./form-bits";

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
  const field = `mt-1 ${inputClass}`;

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
    <section aria-label="Add a photo meal" className={`flex flex-col gap-4 p-4 sm:p-5 ${cardClass}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add a photo</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-2 text-sm text-muted transition-colors duration-150 hover:text-ink">
          Cancel
        </button>
      </div>

      <label htmlFor={`${id}-file`} className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-paper p-4 text-center text-sm text-muted focus-within:shadow-[var(--focus-ring)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview, nothing to optimise
          <img src={photo.previewUrl} alt="Selected meal" className="max-h-56 rounded-md object-contain" />
        ) : (
          <span>{busy ? "Preparing photo…" : "Take or choose a photo of your meal"}</span>
        )}
        <input id={`${id}-file`} type="file" accept="image/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} className="max-w-full text-xs text-muted file:mr-3 file:min-h-9 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink" />
      </label>

      <label className="text-sm text-muted">
        Caption (optional)
        <input
          className={field}
          value={caption}
          maxLength={CAPTION_MAX}
          placeholder="e.g. dal, 2 rotis and a bowl of curd"
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>

      <label className="text-sm text-muted">
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

      <p role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
      <button
        type="button"
        onClick={save}
        disabled={busy || !photo}
        className={buttonClass}
      >
        Save photo
      </button>
      <p className="text-xs text-muted">Calories and macros are filled in later by your AI agent, or by you.</p>
    </section>
  );
}
