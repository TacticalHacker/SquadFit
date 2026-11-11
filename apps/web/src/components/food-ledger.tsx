import type { FoodLedger } from "@calci/shared";

const fmt = (n: number) => n.toLocaleString("en");

/** Remaining against the (net) target, plus eaten, burned, net and macro totals. */
export function FoodLedgerCard({ ledger }: { ledger: FoodLedger }) {
  const over = ledger.remaining < 0;
  const used = ledger.target > 0 ? Math.min(1, Math.max(0, ledger.net / ledger.target)) : 0;
  const m = ledger.macros;
  return (
    <section aria-label="Day summary" aria-live="polite" className="flex flex-col gap-4 rounded-2xl bg-[#1E293B] p-5">
      <div>
        <p className="text-sm text-slate-400">{over ? "Over your target by" : "Remaining today"}</p>
        <p className={`text-4xl font-bold tabular-nums ${over ? "text-amber-300" : "text-lime-300"}`}>
          {fmt(Math.abs(ledger.remaining))}
          <span className="ml-1 text-base font-medium text-slate-400">kcal</span>
        </p>
        <div
          role="img"
          aria-label={`${fmt(Math.max(0, ledger.net))} of ${fmt(ledger.target)} calories used`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-700/70"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${over ? "bg-amber-400" : "bg-lime-400"}`}
            style={{ width: `${over ? 100 : used * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">Target {fmt(ledger.target)} kcal, counted as eaten minus burned</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Eaten" value={ledger.eaten} tone="text-orange-300" />
        <Stat label="Burned" value={ledger.burned} tone="text-cyan-300" />
        <Stat label="Net" value={ledger.net} tone="text-slate-100" />
      </dl>

      <div>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <Macro label="Protein" grams={m.protein} tone="bg-purple-400" />
          <Macro label="Carbs" grams={m.carbs} tone="bg-cyan-400" />
          <Macro label="Fat" grams={m.fat} tone="bg-amber-400" />
        </dl>
        {m.entriesWithoutMacros > 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            {m.entriesWithoutMacros === 1 ? "1 item has" : `${m.entriesWithoutMacros} items have`} no macros, so these totals are partial.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`text-xl font-bold tabular-nums ${tone}`}>{fmt(value)}</dd>
    </div>
  );
}

function Macro({ label, grams, tone }: { label: string; grams: number; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dt className="flex items-center gap-1.5 text-slate-400">
        <span aria-hidden="true" className={`size-2 rounded-full ${tone}`} />
        {label}
      </dt>
      <dd className="font-semibold tabular-nums">{grams} g</dd>
    </div>
  );
}
