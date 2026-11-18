"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Timeline as TimelineData } from "@calci/shared";
import { loadTimeline } from "@/server/actions/squad";
import { DayCard } from "./day-card";
import { cardClass, secondaryButtonClass } from "./form-bits";
import { HighFiveButton } from "./high-five-button";

const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

type Item = TimelineData["items"][number];

function milestoneText(i: Extract<Item, { type: "milestone" }>) {
  if (i.kind === "streak_week") return `Week ${i.week} of the streak`;
  if (i.kind === "protein_streak") return "Hit the protein target 7 days in a row";
  if (i.kind === "step_streak") return "Hit the step goal 7 days in a row";
  return "First workout";
}

/** Newest-first workout days and milestones, older pages loaded on demand (feature 011, FR-006). */
export function Timeline({ memberId, initial }: { memberId: string; initial: TimelineData }) {
  const [items, setItems] = useState<Item[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const more = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    const r = await loadTimeline(memberId, cursor);
    if (r.ok) {
      setItems((prev) => [...prev, ...r.data.items]);
      setCursor(r.data.nextCursor);
    } else setError(true);
    setLoading(false);
    busy.current = false;
  }, [cursor, memberId]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void more(), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, error, more]);

  if (items.length === 0) return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No workouts yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Activity timeline" className="flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.type === "day" ? i.card.date : i.id}>
            {i.type === "day" ? (
              <DayCard card={i.card} memberId={memberId} />
            ) : (
              <div className={`${cardClass} flex items-center justify-between gap-3 px-3 py-2`}>
                <div>
                  <p className="text-sm text-ink">{milestoneText(i)}</p>
                  <p className="text-xs text-muted">{shortDate(i.date)}</p>
                </div>
                <HighFiveButton id={i.id} count={i.highFives} mine={i.highFivedByMe} canHighFive={i.canHighFive} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {cursor ? (
        <div ref={sentinel} className="flex flex-col items-center gap-2">
          {error ? <p className="text-sm text-danger">Couldn&apos;t load older days.</p> : null}
          <button type="button" onClick={() => void more()} disabled={loading} className={secondaryButtonClass}>
            {loading ? "Loading…" : "Load older days"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
