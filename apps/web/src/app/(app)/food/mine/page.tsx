import Link from "next/link";
import { Suspense } from "react";
import { OwnFoodsResponseSchema } from "@calci/shared";
import { OwnFoodForm } from "@/components/own-food-form";
import { ChevronLeft } from "lucide-react";
import { linkClass } from "@/components/form-bits";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "My foods · SquadFit" };

async function Mine() {
  await requireProfile();
  const { foods } = await apiFetch("/food/foods", { schema: OwnFoodsResponseSchema });
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="mb-3 text-lg font-semibold">
          Add a food
        </h2>
        <OwnFoodForm />
      </section>
      <section aria-labelledby="list-h">
        <h2 id="list-h" className="mb-3 text-lg font-semibold">
          Your foods
        </h2>
        {foods.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t saved any yet. The built-in foods can&apos;t be changed.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {foods.map((f) => (
              <li key={f.foodId}>
                <OwnFoodForm food={f} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MyFoodsPage() {
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/food" className={`inline-flex items-center gap-1 ${linkClass}`}>
          <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
          Back to food
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-[-0.02em]">My foods</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Mine />
      </Suspense>
    </>
  );
}
