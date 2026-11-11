"use client";

import { useMemo, useState } from "react";
import {
  MEALS,
  STANDARD_FOODS,
  completeMacros,
  entryFromFood,
  type Macros,
  type Meal,
  type OwnFood,
  type RecentFood,
} from "@calci/shared";
import { parseCaloriesInput, parseGramsInput } from "@/lib/food-input";
import { searchFoods, type FoodResult } from "@/lib/food-search";

export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

const field =
  "w-full rounded-xl border border-slate-600 bg-[#0F172A] px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-lime-400 aria-[invalid=true]:border-red-400";
const chip = "rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400";

export interface AddPanelProps {
  initialMeal: Meal | null;
  own: readonly OwnFood[];
  recent: readonly RecentFood[];
  onClose: () => void;
  onAddTyped: (input: { meal: Meal; name: string; calories: number; macros: Macros | null }) => void;
  onAddList: (input: { meal: Meal; result: FoodResult; servings: number }) => void;
}

export function FoodAddPanel({ initialMeal, own, recent, onClose, onAddTyped, onAddList }: AddPanelProps) {
  const [meal, setMeal] = useState<Meal | null>(initialMeal);
  const [tab, setTab] = useState<"find" | "quick">("find");

  return (
    <section aria-label="Add food" className="flex flex-col gap-3 rounded-2xl bg-[#1E293B] p-4 ring-1 ring-lime-400/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Add food</h2>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime-400">
          Close
        </button>
      </div>

      <div role="group" aria-label="Meal" className="flex flex-wrap gap-2">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={meal === m}
            onClick={() => setMeal(m)}
            className={`${chip} ${meal === m ? "bg-lime-400 text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>
      {meal === null ? <p className="text-sm text-slate-400">Choose a meal to add to.</p> : null}

      <div role="group" aria-label="How to add" className="flex gap-2">
        {(["find", "quick"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`${chip} ${tab === t ? "bg-white text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}
          >
            {t === "find" ? "Find" : "Quick entry"}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <FindTab meal={meal} own={own} recent={recent} onAddTyped={onAddTyped} onAddList={onAddList} />
      ) : (
        <QuickTab meal={meal} onAddTyped={onAddTyped} />
      )}
    </section>
  );
}

function FindTab({
  meal,
  own,
  recent,
  onAddTyped,
  onAddList,
}: Pick<AddPanelProps, "own" | "recent" | "onAddTyped" | "onAddList"> & { meal: Meal | null }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FoodResult | null>(null);
  const [servings, setServings] = useState(1);
  const results = useMemo(() => searchFoods(query, { builtIn: STANDARD_FOODS, own, recent }), [query, own, recent]);

  if (picked) {
    const e = entryFromFood({ calories: picked.calories, macros: picked.macros }, servings);
    const tooMany = e.calories > 5000;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium">
          {picked.name} <span className="text-sm font-normal text-slate-400">{picked.serving}</span>
        </p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={servings <= 0.5} onClick={() => setServings((s) => s - 0.5)} aria-label="Fewer servings" className="grid size-11 place-items-center rounded-full bg-white/10 text-xl transition active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-lime-400">
            −
          </button>
          <p className="w-32 text-center" aria-live="polite">
            <span className="text-3xl font-bold tabular-nums">{servings}</span>
            <span className="ml-1 text-sm text-slate-400">{servings === 1 ? "serving" : "servings"}</span>
          </p>
          <button type="button" disabled={servings >= 20} onClick={() => setServings((s) => s + 0.5)} aria-label="More servings" className="grid size-11 place-items-center rounded-full bg-white/10 text-xl transition active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-lime-400">
            +
          </button>
        </div>
        <p className="text-center text-sm text-orange-300" aria-live="polite">
          ≈ {e.calories} kcal
          {e.macros ? ` · P ${e.macros.protein} / C ${e.macros.carbs} / F ${e.macros.fat} g` : ""}
        </p>
        {tooMany ? <p role="alert" className="text-center text-sm text-red-300">That comes to more than 5,000 calories. Use fewer servings.</p> : null}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setPicked(null); setServings(1); }} className="flex-1 rounded-xl bg-white/10 py-2 font-medium hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-lime-400">
            Back
          </button>
          <button
            type="button"
            disabled={meal === null || tooMany}
            onClick={() => meal && onAddList({ meal, result: picked, servings })}
            className="flex-1 rounded-xl bg-lime-400 py-2 font-semibold text-slate-900 transition active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="food-search" className="sr-only">
        Search foods
      </label>
      <input id="food-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods, e.g. dal" className={field} autoComplete="off" />
      <ul className="max-h-72 overflow-y-auto">
        {results.length === 0 ? <li className="px-1 py-3 text-sm text-slate-400">No matches. Try Quick entry.</li> : null}
        {results.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              disabled={meal === null}
              onClick={() => {
                if (r.kind === "recent") onAddTyped({ meal: meal!, name: r.name, calories: r.calories, macros: r.macros });
                else {
                  setPicked(r);
                  setServings(1);
                }
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-lime-400"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block text-xs text-slate-400">
                  {r.serving ? `${r.serving} · ` : ""}
                  {r.calories} kcal
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.label === "Mine" ? "bg-purple-400/20 text-purple-200" : r.label === "Recent" ? "bg-cyan-400/20 text-cyan-200" : "bg-white/10 text-slate-300"}`}>
                {r.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickTab({ meal, onAddTyped }: { meal: Meal | null; onAddTyped: AddPanelProps["onAddTyped"] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(fd: FormData) {
    const get = (k: string) => String(fd.get(k) ?? "");
    const name = get("name").trim().replace(/\s+/g, " ");
    const errs: Record<string, string> = {};
    if (name === "") errs.name = "Name is required";
    else if (name.length > 60) errs.name = "Name must be at most 60 characters";
    const cal = parseCaloriesInput(get("calories"));
    if (!cal.ok) errs.calories = cal.error;
    const grams = (["protein", "carbs", "fat"] as const).map((k) => [k, parseGramsInput(get(k))] as const);
    for (const [k, g] of grams) if (!g.ok) errs[k] = g.error;
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !cal.ok || meal === null) return;
    const v = Object.fromEntries(grams.map(([k, g]) => [k, g.ok ? g.value : undefined]));
    onAddTyped({ meal, name, calories: cal.value, macros: completeMacros(v) });
  }

  const f = (id: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`q-${id}`} className="text-sm text-slate-300">
        {label}
      </label>
      <input id={`q-${id}`} name={id} className={field} aria-invalid={errors[id] ? true : undefined} aria-describedby={errors[id] ? `q-${id}-e` : undefined} {...props} />
      {errors[id] ? (
        <p id={`q-${id}-e`} role="alert" className="text-xs text-red-300">
          {errors[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={submit} className="flex flex-col gap-3" noValidate>
      {f("name", "Food", { type: "text", maxLength: 60, placeholder: "e.g. Chicken biryani", autoComplete: "off" })}
      {f("calories", "Calories", { type: "text", inputMode: "numeric", placeholder: "650" })}
      <div className="grid grid-cols-3 gap-2">
        {f("protein", "Protein g", { type: "text", inputMode: "decimal", placeholder: "optional" })}
        {f("carbs", "Carbs g", { type: "text", inputMode: "decimal", placeholder: "optional" })}
        {f("fat", "Fat g", { type: "text", inputMode: "decimal", placeholder: "optional" })}
      </div>
      <button type="submit" disabled={meal === null} className="rounded-xl bg-lime-400 py-2 font-semibold text-slate-900 transition active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white">
        Add
      </button>
    </form>
  );
}
