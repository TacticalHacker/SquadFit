"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  MEALS,
  applyFoodChange,
  completeMacros,
  defaultMealForHour,
  entryFromFood,
  localHour,
  scaleCalories,
  type FoodChange,
  type FoodDayView,
  type FoodEntry,
  type Macros,
  type Meal,
  type OwnFood,
  type RecentFood,
} from "@calci/shared";
import { parseCaloriesInput, parseGramsInput } from "@/lib/food-input";
import type { FoodResult as SearchResult } from "@/lib/food-search";
import { hasDayChanged } from "@/lib/rollover";
import type { ReducedPhoto } from "@/lib/photo-reduce";
import { addEntry, addPhotoEntry, removeEntry, updateEntry, type FoodResult } from "@/server/actions/food";
import { FoodAddPanel, MEAL_LABEL } from "./food-add-panel";
import { FoodLedgerCard } from "./food-ledger";
import { PhotoAddPanel } from "./photo-add-panel";
import { PhotoEntryRow } from "./photo-entry";

const CHECK_EVERY_MS = 60_000;
const COMMIT_DELAY_MS = 600;
const isTemp = (id: string) => id.startsWith("tmp-");

export function FoodScreen({
  initialView,
  own,
  recent,
}: {
  initialView: FoodDayView;
  own: readonly OwnFood[];
  recent: readonly RecentFood[];
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [seen, setSeen] = useState(initialView);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ meal: Meal | null; key: number; kind: "food" | "photo" } | null>(null);
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(view, applyFoodChange);
  const counter = useRef(0);

  // A refresh or navigation delivered a new server view: adopt it.
  if (seen !== initialView) {
    setSeen(initialView);
    setView(initialView);
  }

  // Follow local midnight (FR-018): re-check on focus, visibility and every minute.
  const { today, timezone } = view;
  useEffect(() => {
    const check = () => {
      if (hasDayChanged(new Date(), timezone, today)) router.replace("/food");
    };
    const id = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, timezone, today]);

  function submit(change: FoodChange, call: () => Promise<FoodResult>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      const result = await call();
      if (result.ok) {
        setView(result.view);
        router.refresh(); // keep the recent foods list current
      } else {
        setError(result.error);
        if (result.error === "This day can no longer be edited" || result.error === "That entry was already removed" || result.error.includes("already analysed")) {
          router.refresh();
        }
      }
    });
  }

  const date = view.date;
  const readOnly = !optimistic.editable;

  function openPanel(meal: Meal | null, kind: "food" | "photo" = "food") {
    const preselect = meal ?? (date === today ? defaultMealForHour(localHour(new Date(), timezone)) : null);
    setPanel({ meal: preselect, key: ++counter.current, kind });
  }

  function addPhoto({ meal, caption, photo }: { meal: Meal; caption: string; photo: ReducedPhoto }) {
    // Optimistic pending card with the local preview; replaced by the server view (signed URL) on success.
    const entry: FoodEntry = {
      entryId: `tmp-${++counter.current}`,
      source: "photo",
      name: caption || "Photo meal",
      servings: 1,
      calories: 0,
      macros: null,
      rate: { calories: 0, macros: null },
      meal,
      photo: { status: "pending", caption, url: photo.previewUrl },
    };
    setPanel(null);
    submit({ type: "add", entry }, () =>
      addPhotoEntry(date, { meal, ...(caption ? { caption } : {}), contentType: photo.contentType, dataBase64: photo.dataBase64 }),
    );
  }

  function addTyped(input: { meal: Meal; name: string; calories: number; macros: Macros | null }) {
    const entry: FoodEntry = {
      entryId: `tmp-${++counter.current}`,
      source: "typed",
      name: input.name,
      servings: 1,
      calories: input.calories,
      macros: input.macros,
      rate: { calories: input.calories, macros: input.macros },
      meal: input.meal,
    };
    setPanel(null);
    submit({ type: "add", entry }, () =>
      addEntry(date, { kind: "typed", meal: input.meal, name: input.name, calories: input.calories, ...(input.macros ? { macros: input.macros } : {}) }),
    );
  }

  function addList({ meal, result, servings }: { meal: Meal; result: SearchResult; servings: number }) {
    if (result.kind === "recent" || !result.foodId) return;
    const entry: FoodEntry = {
      entryId: `tmp-${++counter.current}`,
      source: result.kind,
      foodId: result.foodId,
      name: result.name,
      ...(result.serving ? { serving: result.serving } : {}),
      meal,
      ...entryFromFood({ calories: result.calories, macros: result.macros }, servings),
    };
    setPanel(null);
    submit({ type: "add", entry }, () => addEntry(date, { kind: result.kind as "standard" | "own", meal, foodId: result.foodId!, servings }));
  }

  return (
    <div className="flex flex-col gap-5">
      {readOnly ? (
        <p role="status" className="rounded-xl bg-amber-400/15 px-4 py-2 text-sm text-amber-200">
          This day can no longer be edited
        </p>
      ) : null}

      <FoodLedgerCard ledger={optimistic.ledger} />

      <div role="alert">
        {error ? <p className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200">{error}</p> : null}
      </div>

      {!readOnly ? (
        panel?.kind === "photo" ? (
          <PhotoAddPanel key={panel.key} initialMeal={panel.meal} onClose={() => setPanel(null)} onAdd={addPhoto} />
        ) : panel ? (
          <FoodAddPanel
            key={panel.key}
            initialMeal={panel.meal}
            own={own}
            recent={recent}
            onClose={() => setPanel(null)}
            onAddTyped={addTyped}
            onAddList={addList}
          />
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => openPanel(null)}
              className="rounded-2xl bg-lime-400 py-3 text-base font-semibold text-slate-900 transition hover:bg-lime-300 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-white"
            >
              + Add food
            </button>
            <button
              type="button"
              onClick={() => openPanel(null, "photo")}
              className="rounded-2xl bg-white/10 px-5 py-3 text-base font-semibold text-lime-300 transition hover:bg-white/20 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400"
            >
              📷 Add photo
            </button>
          </div>
        )
      ) : null}

      {optimistic.meals.map((group) => (
        <section key={group.meal} aria-labelledby={`meal-${group.meal}`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id={`meal-${group.meal}`} className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {MEAL_LABEL[group.meal]}
            </h2>
            <span className="flex items-center gap-3 text-sm tabular-nums text-slate-400">
              {group.subtotal} kcal
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => openPanel(group.meal)}
                  aria-label={`Add to ${MEAL_LABEL[group.meal]}`}
                  className="grid size-7 place-items-center rounded-full bg-white/10 text-base text-lime-300 transition hover:bg-white/20 active:scale-90 focus-visible:outline-2 focus-visible:outline-lime-400"
                >
                  +
                </button>
              ) : null}
            </span>
          </div>
          {group.entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-4 text-center text-sm text-slate-500">Nothing logged</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {group.entries.map((entry) =>
                entry.photo ? (
                  <PhotoEntryRow
                    key={entry.entryId}
                    entry={entry}
                    open={openId === entry.entryId}
                    editable={!readOnly && !isTemp(entry.entryId)}
                    onToggle={() => setOpenId(openId === entry.entryId ? null : entry.entryId)}
                    onPatch={(patch) => submit({ type: "update", entryId: entry.entryId, patch }, () => updateEntry(date, entry.entryId, patch))}
                    onRemove={() => {
                      setOpenId(null);
                      submit({ type: "remove", entryId: entry.entryId }, () => removeEntry(date, entry.entryId));
                    }}
                    onInvalid={setError}
                  />
                ) : (
                <EntryRow
                  key={entry.entryId}
                  entry={entry}
                  open={openId === entry.entryId}
                  editable={!readOnly && !isTemp(entry.entryId)}
                  onToggle={() => setOpenId(openId === entry.entryId ? null : entry.entryId)}
                  onPatch={(patch) =>
                    submit({ type: "update", entryId: entry.entryId, patch }, () => updateEntry(date, entry.entryId, patch))
                  }
                  onRemove={() => {
                    setOpenId(null);
                    submit({ type: "remove", entryId: entry.entryId }, () => removeEntry(date, entry.entryId));
                  }}
                  onInvalid={setError}
                />
                ),
              )}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

type Patch = { name?: string; calories?: number; macros?: Macros | null; meal?: Meal; servings?: number };

function EntryRow({
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
  onPatch: (patch: Patch) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
}) {
  const isList = entry.source !== "typed";
  const [draftServings, setDraftServings] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const servings = draftServings ?? entry.servings;
  const calories = draftServings === null ? entry.calories : scaleCalories(entry.rate.calories, servings);

  function changeServings(next: number) {
    const s = Math.min(20, Math.max(0.5, next));
    if (scaleCalories(entry.rate.calories, s) > 5000) return onInvalid("That comes to more than 5,000 calories. Use fewer servings.");
    setDraftServings(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDraftServings(null);
      if (s !== entry.servings) onPatch({ servings: s });
    }, COMMIT_DELAY_MS);
  }

  const panelId = `entry-${entry.entryId}`;
  const m = entry.macros;
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
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.name}</span>
          <span className="block text-xs text-slate-400">
            {isList ? `${servings} × ${entry.serving ?? "serving"}` : "Typed"}
            {m ? ` · P ${m.protein} / C ${m.carbs} / F ${m.fat} g` : ""}
          </span>
        </span>
        <span className="text-lg font-bold tabular-nums text-orange-300">{calories} kcal</span>
      </button>
      <div id={panelId} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {editable ? (
            <div className="flex flex-col gap-3 border-t border-white/5 p-3">
              {isList ? (
                <div className="flex items-center justify-center gap-3">
                  <button type="button" tabIndex={open ? 0 : -1} disabled={servings <= 0.5} onClick={() => changeServings(servings - 0.5)} aria-label={`Fewer servings of ${entry.name}`} className="grid size-11 place-items-center rounded-full bg-white/10 text-xl transition active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-lime-400">
                    −
                  </button>
                  <p className="w-32 text-center" aria-live="polite">
                    <span className="text-3xl font-bold tabular-nums">{servings}</span>
                    <span className="ml-1 text-sm text-slate-400">{servings === 1 ? "serving" : "servings"}</span>
                  </p>
                  <button type="button" tabIndex={open ? 0 : -1} disabled={servings >= 20} onClick={() => changeServings(servings + 0.5)} aria-label={`More servings of ${entry.name}`} className="grid size-11 place-items-center rounded-full bg-white/10 text-xl transition active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-lime-400">
                    +
                  </button>
                </div>
              ) : (
                <TypedEditor entry={entry} open={open} onSave={onPatch} onInvalid={onInvalid} />
              )}
              <label className="flex items-center justify-center gap-2 text-sm text-slate-300">
                Meal
                <select
                  tabIndex={open ? 0 : -1}
                  value={entry.meal}
                  onChange={(e) => onPatch({ meal: e.target.value as Meal })}
                  className="rounded-lg border border-slate-600 bg-[#0F172A] px-2 py-1 text-slate-100 focus-visible:outline-2 focus-visible:outline-lime-400"
                >
                  {MEALS.map((meal) => (
                    <option key={meal} value={meal}>
                      {MEAL_LABEL[meal]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" tabIndex={open ? 0 : -1} onClick={onRemove} className="self-center text-sm text-red-300 underline focus-visible:outline-2 focus-visible:outline-lime-400">
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TypedEditor({
  entry,
  open,
  onSave,
  onInvalid,
}: {
  entry: FoodEntry;
  open: boolean;
  onSave: (patch: Patch) => void;
  onInvalid: (message: string) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [cal, setCal] = useState(String(entry.calories));
  const [p, setP] = useState(entry.macros ? String(entry.macros.protein) : "");
  const [c, setC] = useState(entry.macros ? String(entry.macros.carbs) : "");
  const [f, setF] = useState(entry.macros ? String(entry.macros.fat) : "");
  const input = "w-full rounded-lg border border-slate-600 bg-[#0F172A] px-2 py-1.5 text-slate-100 focus-visible:outline-2 focus-visible:outline-lime-400";
  const tab = open ? 0 : -1;

  function save() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed === "" || trimmed.length > 60) return onInvalid("Name must be 1 to 60 characters");
    const calories = parseCaloriesInput(cal);
    if (!calories.ok) return onInvalid(calories.error);
    const grams = [parseGramsInput(p), parseGramsInput(c), parseGramsInput(f)];
    const badGrams = grams.find((g) => !g.ok);
    if (badGrams && !badGrams.ok) return onInvalid(badGrams.error);
    const [gp, gc, gf] = grams.map((g) => (g.ok ? g.value : undefined));
    onSave({ name: trimmed, calories: calories.value, macros: completeMacros({ protein: gp, carbs: gc, fat: gf }) });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-slate-300">
        Name
        <input tabIndex={tab} className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="text-sm text-slate-300">
        Calories
        <input tabIndex={tab} className={input} inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm text-slate-300">
          Protein g
          <input tabIndex={tab} className={input} inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        </label>
        <label className="text-sm text-slate-300">
          Carbs g
          <input tabIndex={tab} className={input} inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        </label>
        <label className="text-sm text-slate-300">
          Fat g
          <input tabIndex={tab} className={input} inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
        </label>
      </div>
      <button type="button" tabIndex={tab} onClick={save} className="rounded-xl bg-lime-400 py-2 font-semibold text-slate-900 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white">
        Save changes
      </button>
    </div>
  );
}
