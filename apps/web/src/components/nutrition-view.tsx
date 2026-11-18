import type { NutritionMeals, NutritionTotals } from "@calci/shared";

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

type Shown = NutritionTotals | NutritionMeals;

/** Calories burned in workouts: always an estimate ("~"), and "adj." when any of it was AI-adjusted (feature 011, FR-029). */
export function Burned({ n }: { n: Shown }) {
  return (
    <span className="tabular-nums">
      ~{nf.format(n.burned)} kcal
      {n.burnedAdjusted ? <span className="ml-1 rounded-full border border-warning/50 px-1.5 py-0.5 text-xs font-medium text-ink">adj.</span> : null}
    </span>
  );
}

/** Compact line: protein against the member's own target, calories in, burned. No net, ever. */
export function NutritionLine({ n }: { n: Shown }) {
  const pct = n.proteinTarget ? Math.min(100, Math.round((n.protein / n.proteinTarget) * 100)) : null;
  return (
    <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
      <div className="flex items-baseline justify-between gap-3">
        <span>Protein</span>
        <span className="tabular-nums text-ink">
          {nf.format(n.protein)}
          {n.proteinTarget ? ` / ${nf.format(n.proteinTarget)}` : ""} g
        </span>
      </div>
      {pct !== null ? (
        <div role="img" aria-label={`${pct}% of protein target`} className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap justify-between gap-x-3">
        <span className="tabular-nums">
          In {nf.format(n.caloriesIn)}
          {n.calorieTarget ? ` / ${nf.format(n.calorieTarget)}` : ""} kcal
        </span>
        <span>
          Burned <Burned n={n} />
        </span>
      </div>
    </div>
  );
}

/** Daily totals and, when the member shares meals, the meal list with per-meal macros and photos. */
export function NutritionDay({ n }: { n: Shown }) {
  const meals = "meals" in n ? n.meals : null;
  return (
    <section aria-label="Nutrition" className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
      <p className="text-sm tabular-nums text-ink">
        {nf.format(n.caloriesIn)} kcal in · P {nf.format(n.protein)} · C {nf.format(n.carbs)} · F {nf.format(n.fat)} g
      </p>
      <NutritionLine n={n} />
      {meals && meals.length > 0 ? (
        <details className="group">
          <summary className="min-h-11 cursor-pointer list-none py-2.5 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">Meals</summary>
          <ul className="flex flex-col gap-3">
            {meals.map((m) => (
              <li key={m.meal}>
                <p className="flex justify-between text-sm font-medium capitalize text-ink">
                  <span>{m.meal}</span>
                  <span className="tabular-nums text-muted">
                    {nf.format(m.subtotalCalories)} kcal{m.macros ? ` · P ${nf.format(m.macros.protein)} C ${nf.format(m.macros.carbs)} F ${nf.format(m.macros.fat)}` : ""}
                  </span>
                </p>
                <ul className="mt-1 flex flex-col gap-1.5 text-sm text-muted">
                  {m.items.map((it, i) => (
                    <li key={`${it.name}-${i}`} className="flex items-start gap-2">
                      {it.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
                        <img src={it.photoUrl} alt={it.caption || it.name} width={48} height={48} className="size-12 shrink-0 rounded-md object-cover" />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="text-ink">{it.name}</span>
                        {it.servings !== 1 ? <span> × {nf.format(it.servings)}</span> : null}
                        {it.caption && it.caption !== it.name ? <span className="block truncate">{it.caption}</span> : null}
                      </span>
                      <span className="tabular-nums">{nf.format(it.calories)} kcal</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
