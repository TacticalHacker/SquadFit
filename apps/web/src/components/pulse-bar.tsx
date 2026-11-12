"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CoachStatus, OverallNote, PulseMetrics } from "@calci/shared";
import { setCoachAction } from "@/server/actions/coach";
import { BottomSheet } from "./bottom-sheet";

/** Accent per status; the `label` is also read out, so colour is never the only signal (research R10). */
const STATUS: Record<CoachStatus, { label: string; border: string; dot: string }> = {
  on_track: { label: "On track", border: "border-emerald-400/50", dot: "bg-emerald-400" },
  needs_attention: { label: "Needs attention", border: "border-amber-400/60", dot: "bg-amber-400" },
  pr_alert: { label: "PR alert", border: "border-fuchsia-400/60", dot: "bg-fuchsia-400" },
};

const WIDE = "(min-width: 640px)";
const kg = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/**
 * AI Pulse Bar (feature 007): one 56 px line under the date strip with the coach's headline. Tapping it expands
 * an inline card on wide screens or a bottom sheet on phones (research R9). Render with `key={note.updatedAt}`
 * so a new note resets the local tick state.
 */
export function PulseBar({
  note,
  metrics,
  proteinTarget,
}: {
  note: OverallNote;
  metrics: PulseMetrics;
  proteinTarget: number | null;
}) {
  const [open, setOpen] = useState<"inline" | "sheet" | null>(null);
  const panelId = useId();
  const s = STATUS[note.status];

  const toggle = () => {
    if (open) return setOpen(null);
    setOpen(window.matchMedia(WIDE).matches ? "inline" : "sheet");
  };

  const body = <PulseCard note={note} metrics={metrics} proteinTarget={proteinTarget} />;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open !== null}
        aria-controls={panelId}
        className={`flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border bg-slate-900/60 px-4 text-left backdrop-blur-md transition-colors hover:bg-slate-900/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 ${s.border}`}
      >
        <span aria-hidden="true" className="text-lg">
          ✨
        </span>
        <span className="sr-only">AI coach, {s.label}:</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{note.headline}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
          <span aria-hidden="true" className={`size-2 rounded-full ${s.dot}`} />
          View
          <span
            aria-hidden="true"
            className={`inline-block transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </span>
      </button>

      {/* Wide screens: the card slides open below the bar (grid-rows 0fr → 1fr). */}
      <div
        id={open === "sheet" ? undefined : panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open === "inline" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={open !== "inline"}
        aria-hidden={open !== "inline"}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">{body}</div>
        </div>
      </div>

      <BottomSheet
        open={open === "sheet"}
        onClose={() => setOpen(null)}
        label="AI coach"
        header={
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">✨ AI coach</h2>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="min-h-11 min-w-11 rounded-lg text-sm text-slate-400 hover:text-slate-100"
            >
              Close
            </button>
          </div>
        }
      >
        <div id={open === "sheet" ? panelId : undefined} className="px-1 pb-2">
          {open === "sheet" ? body : null}
        </div>
      </BottomSheet>
    </div>
  );
}

function PulseCard({ note, metrics, proteinTarget }: { note: OverallNote; metrics: PulseMetrics; proteinTarget: number | null }) {
  const s = STATUS[note.status];
  const net = Math.round(metrics.netCalories);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          <span aria-hidden="true" className={`mr-1.5 inline-block size-2 rounded-full ${s.dot}`} />
          {s.label}
        </p>
        <p className="mt-1 text-base font-semibold text-slate-100">{note.headline}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Net calories" value={`${net > 0 ? "+" : ""}${net.toLocaleString("en")}`} unit="kcal" />
        <Metric
          label="Protein"
          value={kg.format(metrics.proteinG)}
          unit={proteinTarget ? `/ ${proteinTarget} g` : "g"}
        />
        <Metric label="Gym volume" value={Math.round(metrics.gymVolumeKg).toLocaleString("en")} unit="kg" />
      </dl>

      <section aria-label="The verdict">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">The verdict</h3>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-200">
          {note.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </section>

      {note.actions.length > 0 ? <ActionList note={note} /> : null}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/5 px-2 py-2">
      <dt className="truncate text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-slate-100">
        {value} <span className="text-xs font-normal text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

function ActionList({ note }: { note: OverallNote }) {
  const router = useRouter();
  const [actions, setActions] = useState(note.actions);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (index: number, done: boolean) => {
    const before = actions;
    setActions(actions.map((a, i) => (i === index ? { ...a, done } : a)));
    setMessage(null);
    startTransition(async () => {
      const r = await setCoachAction(note.date, index, done, note.updatedAt);
      if (r.ok) {
        setActions(r.actions);
        return;
      }
      setActions(before);
      setMessage(r.error);
      if (r.conflict) router.refresh();
    });
  };

  return (
    <section aria-label="Action items">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Today&apos;s actions</h3>
      <ul className="mt-1 flex flex-col">
        {actions.map((a, i) => (
          <li key={i}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm hover:bg-white/5">
              <input
                type="checkbox"
                checked={a.done}
                onChange={(e) => toggle(i, e.target.checked)}
                className="size-5 shrink-0 accent-lime-400"
              />
              <span className={a.done ? "text-slate-500 line-through" : "text-slate-200"}>{a.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {message ? (
        <p role="alert" className="mt-1 text-xs text-amber-300">
          {message}
        </p>
      ) : null}
    </section>
  );
}
