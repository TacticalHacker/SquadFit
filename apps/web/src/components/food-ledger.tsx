import type { FoodLedger } from "@calci/shared";
import { cardClass, noticeWarnClass } from "./form-bits";

const fmt = (n: number) => n.toLocaleString("en");

/** Remaining against the (net) target, plus eaten, burned, net and macro totals. */
export function FoodLedgerCard({ ledger }: { ledger: FoodLedger }) {
  const over = ledger.remaining < 0;
  const used = ledger.target > 0 ? Math.min(1, Math.max(0, ledger.net / ledger.target)) : 0;
  const m = ledger.macros;
  return (
    <section aria-label="Day summary" aria-live="polite" className={`flex flex-col gap-5 p-5 ${cardClass}`}>
      <div>
        <p className="eyebrow">{over ? "Over your target by" : "Remaining today"}</p>
        <p className={`mt-1 font-mono text-4xl font-medium ${over ? "text-warning" : "text-accent"}`}>
          {fmt(Math.abs(ledger.remaining))}
          <span className="ml-1 font-sans text-base font-normal text-muted">kcal</span>
        </p>
        <div
          role="img"
          aria-label={`${fmt(Math.max(0, ledger.net))} of ${fmt(ledger.target)} calories used`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className={`h-full rounded-full ${over ? "bg-warning" : "bg-accent"}`} style={{ width: `${over ? 100 : used * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">Target {fmt(ledger.target)} kcal, counted as eaten minus burned</p>
      </div>

      {ledger.pending > 0 ? (
        <p className={noticeWarnClass}>
          {ledger.pending === 1 ? "1 meal" : `${ledger.pending} meals`} pending analysis, not counted yet
        </p>
      ) : null}

      <dl className="grid grid-cols-3 divide-x divide-line border-y border-line text-center">
        <Stat label="Eaten" value={ledger.eaten} />
        <Stat label="Burned" value={ledger.burned} />
        <Stat label="Net" value={ledger.net} />
      </dl>

      <div>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <Macro label="Protein" grams={m.protein} />
          <Macro label="Carbs" grams={m.carbs} />
          <Macro label="Fat" grams={m.fat} />
        </dl>
        {ledger.proteinTarget ? <ProteinProgress grams={m.protein} target={ledger.proteinTarget} /> : null}
        {m.entriesWithoutMacros > 0 ? (
          <p className="mt-2 text-xs text-muted">
            {m.entriesWithoutMacros === 1 ? "1 item has" : `${m.entriesWithoutMacros} items have`} no macros, so these totals are partial.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-xl font-medium">{fmt(value)}</dd>
    </div>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{grams} g</dd>
    </div>
  );
}

function ProteinProgress({ grams, target }: { grams: number; target: number }) {
  const pct = Math.min(100, Math.max(0, (grams / target) * 100));
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">
        Protein <span className="font-semibold text-ink">{grams}</span> / {target} g
      </p>
      <div role="img" aria-label={`${grams} of ${target} grams of protein`} className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-muted" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
