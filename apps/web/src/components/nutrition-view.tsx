import { MEAL_LABEL, type NutritionMeals, type NutritionTotals } from "@calci/shared";
import { INFO, ate, burned, carbsFat, protein } from "@/lib/plain";
import { InfoTip } from "./info-tip";

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

type Shown = NutritionTotals | NutritionMeals;

/** Calories burned in workouts: always an estimate; the (i) explains an AI adjustment when there was one (feature 013). */
export function Burned({ n }: { n: Shown }) {
  return (
    <span className="inline-flex items-center tabular-nums">
      {burned(n.burned)}
      {n.burnedAdjusted ? <InfoTip title="Calories burned" text={INFO.burnedAdjusted} /> : null}
    </span>
  );
}

/** Protein against the member's own goal (with a bar when there is one), calories eaten, burned. No net, ever. */
export function NutritionLine({ n }: { n: Shown }) {
  const pct = n.proteinTarget ? Math.min(100, Math.round((n.protein / n.proteinTarget) * 100)) : null;
  return (
    <div className="mt-1.5 flex flex-col gap-1 text-sm text-muted">
      <p className="tabular-nums text-ink">{protein(n.protein, n.proteinTarget)}</p>
      {pct !== null ? (
        <div role="img" aria-label={`${pct}% of the protein goal`} className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <p className="tabular-nums">{ate(n.caloriesIn, n.calorieTarget)}</p>
      <Burned n={n} />
    </div>
  );
}

/** Daily totals and, when the member shares meals, the meal list with per-meal macros and photos. */
export function NutritionDay({ n }: { n: Shown }) {
  const meals = "meals" in n ? n.meals : null;
  return (
    <section aria-label="Nutrition" className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
      <NutritionLine n={n} />
      <p className="text-sm tabular-nums text-muted">{carbsFat(n.carbs, n.fat)}</p>
      {meals && meals.length > 0 ? (
        <details className="group">
          <summary className="min-h-11 cursor-pointer list-none py-2.5 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">Meals</summary>
          <ul className="flex flex-col gap-3">
            {meals.map((m) => (
              <li key={m.meal}>
                <p className="flex justify-between text-sm font-medium text-ink">
                  <span>{MEAL_LABEL[m.meal]}</span>
                  <span className="tabular-nums text-muted">
                    {nf.format(m.subtotalCalories)} calories{m.macros ? ` · protein ${nf.format(m.macros.protein)} g` : ""}
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
                      <span className="tabular-nums">{nf.format(it.calories)} calories</span>
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
