"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { DEFAULT_BODY_WEIGHT_KG, stepWeightKg, type WeightView } from "@calci/shared";
import { deleteWeight, logWeight } from "@/server/actions/weight";
import { WEIGHT_COPY, weightDayLabel, weightKg } from "@/lib/plain";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { buttonClass, chipClass, iconButtonClass, inputClass, noticeErrorClass } from "./form-bits";

/**
 * Feature 014 quick-log sheet: day chips for the edit window, ±0.1 steppers, decimal input and one primary Save.
 * Below the form it lists the selected day's weigh-ins, each with a delete button (clarification 1).
 */
export function WeightSheet({
  view,
  timezone,
  onView,
  onClose,
}: {
  view: WeightView;
  timezone: string;
  onView: (view: WeightView) => void;
  onClose: () => void;
}) {
  const days = view.editableDays;
  const today = days[0]!.date;
  const [date, setDate] = useState(today);
  const [value, setValue] = useState(() => (view.latest?.weightKg ?? view.profileWeightKg ?? DEFAULT_BODY_WEIGHT_KG).toFixed(1));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const entries = days.find((d) => d.date === date)?.entries ?? [];

  const step = (dir: 1 | -1) => {
    const n = Number(value.replace(",", "."));
    setValue(stepWeightKg(Number.isFinite(n) ? n : DEFAULT_BODY_WEIGHT_KG, dir).toFixed(1));
  };

  const save = () =>
    start(async () => {
      setError(null);
      const r = await logWeight(view.range, { weightKg: value, date });
      if (!r.ok) return setError(r.error);
      onView(r.view);
      onClose();
    });

  const remove = (entryId: string) => {
    setDeleting(entryId);
    start(async () => {
      setError(null);
      const r = await deleteWeight(view.range, date, entryId);
      setDeleting(null);
      if (!r.ok) return setError(r.error);
      onView(r.view);
    });
  };

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{WEIGHT_COPY.log}</h2>
      <SheetClose />
    </div>
  );
  const footer = (
    <button type="button" onClick={save} disabled={pending} className={`w-full ${buttonClass}`}>
      {WEIGHT_COPY.save}
    </button>
  );

  return (
    <BottomSheet open onClose={onClose} label={WEIGHT_COPY.log} header={header} footer={footer}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Day">
          {days.map((d) => (
            <button key={d.date} type="button" aria-pressed={d.date === date} onClick={() => setDate(d.date)} className={chipClass(d.date === date)}>
              {weightDayLabel(d.date, today, days[1]!.date)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label="Decrease by 0.1 kg" className={iconButtonClass}>
            <Minus aria-hidden size={18} strokeWidth={1.75} />
          </button>
          <label htmlFor="weight-kg" className="sr-only">
            Weight in kg
          </label>
          <div className="relative flex-1">
            <input
              id="weight-kg"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={error ? true : undefined}
              className={`${inputClass} pr-10 text-center text-2xl font-semibold tabular-nums`}
            />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">
              kg
            </span>
          </div>
          <button type="button" onClick={() => step(1)} aria-label="Increase by 0.1 kg" className={iconButtonClass}>
            <Plus aria-hidden size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>

        <section aria-labelledby="weight-day-entries" className="flex flex-col gap-1">
          <h3 id="weight-day-entries" className="text-sm font-medium text-muted">
            {WEIGHT_COPY.dayEntries}
          </h3>
          {entries.length === 0 ? (
            <p className="text-sm text-faint">{WEIGHT_COPY.dayEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((e) => {
                const at = time.format(new Date(e.recordedAt));
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-1">
                    <span className="tabular-nums">
                      <span className="text-muted">{at}</span>
                      <span className="ml-3 font-medium text-ink">{weightKg(e.weightKg)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      disabled={pending}
                      aria-label={`Delete ${weightKg(e.weightKg)} at ${at}`}
                      className={iconButtonClass}
                    >
                      <Trash2 aria-hidden size={16} strokeWidth={1.75} className={deleting === e.id ? "text-faint" : "text-danger"} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </BottomSheet>
  );
}
