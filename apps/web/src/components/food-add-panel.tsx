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
import { Minus, Plus } from "lucide-react";
import { buttonClass, cardClass, chipClass, iconButtonClass, inputClass, secondaryButtonClass, segmentClass, segmentGroupClass } from "./form-bits";

export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

const field = inputClass;

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
    <section aria-label="Add food" className={`flex flex-col gap-4 p-4 sm:p-5 ${cardClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Add food</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-2 text-sm text-muted transition-colors duration-150 hover:text-ink">
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
            className={chipClass(meal === m)}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>
      {meal === null ? <p className="text-sm text-muted">Choose a meal to add to.</p> : null}

      <div role="group" aria-label="How to add" className={`grid-cols-2 ${segmentGroupClass}`}>
        {(["find", "quick"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 ${segmentClass(tab === t)}`}
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
          {picked.name} <span className="text-sm font-normal text-muted">{picked.serving}</span>
        </p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={servings <= 0.5} onClick={() => setServings((s) => s - 0.5)} aria-label="Fewer servings" className={iconButtonClass}>
            <Minus aria-hidden size={18} strokeWidth={1.75} />
          </button>
          <p className="w-32 text-center" aria-live="polite">
            <span className="font-mono text-3xl font-medium">{servings}</span>
            <span className="ml-1 text-sm text-muted">{servings === 1 ? "serving" : "servings"}</span>
          </p>
          <button type="button" disabled={servings >= 20} onClick={() => setServings((s) => s + 0.5)} aria-label="More servings" className={iconButtonClass}>
            <Plus aria-hidden size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="text-center text-sm text-muted" aria-live="polite">
          ≈ {e.calories} kcal
          {e.macros ? ` · P ${e.macros.protein} / C ${e.macros.carbs} / F ${e.macros.fat} g` : ""}
        </p>
        {tooMany ? <p role="alert" className="text-center text-sm text-danger">That comes to more than 5,000 calories. Use fewer servings.</p> : null}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setPicked(null); setServings(1); }} className={`flex-1 ${secondaryButtonClass}`}>
            Back
          </button>
          <button
            type="button"
            disabled={meal === null || tooMany}
            onClick={() => meal && onAddList({ meal, result: picked, servings })}
            className={`flex-1 ${buttonClass}`}
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
      <ul className="max-h-72 divide-y divide-line overflow-y-auto border-y border-line">
        {results.length === 0 ? <li className="px-1 py-3 text-sm text-muted">No matches. Try Quick entry.</li> : null}
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
              className="flex min-h-12 w-full items-center gap-3 px-2 py-2 text-left transition-colors duration-150 enabled:hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block text-xs text-muted">
                  {r.serving ? `${r.serving} · ` : ""}
                  {r.calories} kcal
                </span>
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${r.label === "Mine" ? "border-accent/30 bg-accent-soft text-accent" : "border-line text-muted"}`}>
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
      <label htmlFor={`q-${id}`} className="text-sm text-muted">
        {label}
      </label>
      <input id={`q-${id}`} name={id} className={field} aria-invalid={errors[id] ? true : undefined} aria-describedby={errors[id] ? `q-${id}-e` : undefined} {...props} />
      {errors[id] ? (
        <p id={`q-${id}-e`} role="alert" className="text-xs text-danger">
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
      <button type="submit" disabled={meal === null} className={buttonClass}>
        Add
      </button>
    </form>
  );
}
