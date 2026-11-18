import { HEATMAP_WEEKS } from "@calci/shared";

const SHADE = ["bg-line", "bg-accent/20", "bg-accent/40", "bg-accent/70", "bg-accent"] as const;

/** 12 weeks, Monday-first columns, one square per day; accent shades on paper (feature 011, FR-005). */
export function Heatmap({ cells }: { cells: { date: string; level: number }[] }) {
  const trained = cells.filter((c) => c.level > 0).length;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Training heatmap: ${trained} workout ${trained === 1 ? "day" : "days"} in the last ${HEATMAP_WEEKS} weeks`}
        className="grid grid-flow-col grid-rows-7 gap-1"
        style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` }}
      >
        {cells.map((c) => (
          <span key={c.date} title={`${c.date}: ${c.level > 0 ? "trained" : "rest"}`} className={`aspect-square w-full rounded-sm ${SHADE[c.level] ?? SHADE[0]}`} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
        Less
        {SHADE.map((c) => (
          <span key={c} className={`size-3 rounded-sm ${c}`} />
        ))}
        More
      </div>
    </div>
  );
}
