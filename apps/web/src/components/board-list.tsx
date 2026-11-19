import { STEPS_MIN_DAYS, type SquadBoardView } from "@calci/shared";
import { BOARD_COPY } from "@/lib/plain";
import { BoardRow, rankOf, type BoardMode } from "./board-card";
import { cardClass } from "./form-bits";
import { InfoTip } from "./info-tip";
import { SegmentLinks } from "./segment-links";

/** Full ranked list of one board (FR-003). Alternate orders are plain links; ranks always come from the server. */
export function BoardList({ board, mode }: { board: SquadBoardView; mode: BoardMode }) {
  const copy = BOARD_COPY[board.id];
  const rows = [...board.rows].sort((a, b) => {
    const ra = rankOf(board, a, mode);
    const rb = rankOf(board, b, mode);
    return (ra ?? Number.MAX_SAFE_INTEGER) - (rb ?? Number.MAX_SAFE_INTEGER);
  });
  const base = `/squad/boards/${board.id}`;
  const toggle =
    board.id === "prJump"
      ? { label: "Rank by", options: [{ label: "kg", href: base, current: !mode.pct }, { label: "%", href: `${base}?sort=pct`, current: Boolean(mode.pct) }] }
      : board.id === "strength"
        ? { label: "Lifts", options: [{ label: "Big 3", href: base, current: !mode.big4 }, { label: "Big 4", href: `${base}?lifts=4`, current: Boolean(mode.big4) }] }
        : null;
  // Steps: members with fewer than STEPS_MIN_DAYS synced days are listed separately, unranked.
  const needsMore = board.id === "steps" ? rows.filter((r) => "syncedDays" in r && r.syncedDays < STEPS_MIN_DAYS) : [];
  const main = rows.filter((r) => !needsMore.includes(r));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-[-0.02em]">{copy.title}</h1>
        <InfoTip title={copy.title} text={copy.info} />
      </div>
      {toggle ? <SegmentLinks label={toggle.label} options={toggle.options} /> : null}
      {main.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{copy.empty}</p>
      ) : (
        <ol className={`${cardClass} divide-y divide-line px-3`}>
          {main.map((r) => (
            <li key={r.member.userId}>
              <BoardRow board={board} row={r} mode={mode} rank={rankOf(board, r, mode)} />
            </li>
          ))}
        </ol>
      )}
      {needsMore.length > 0 ? (
        <section aria-labelledby="needs-more" className="flex flex-col gap-2">
          <h2 id="needs-more" className="text-base font-semibold">
            Needs more days
          </h2>
          <p className="text-sm text-muted">Ranked once they have {STEPS_MIN_DAYS} days of steps this month.</p>
          <ul className={`${cardClass} divide-y divide-line px-3`}>
            {needsMore.map((r) => (
              <li key={r.member.userId}>
                <BoardRow board={board} row={r} mode={mode} rank={null} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
