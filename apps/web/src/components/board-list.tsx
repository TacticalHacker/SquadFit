import Link from "next/link";
import type { SquadBoardView } from "@calci/shared";
import { BOARD_COPY } from "@/lib/plain";
import { BoardRow, rankOf, type BoardMode } from "./board-card";
import { cardClass, segmentClass, segmentGroupClass } from "./form-bits";
import { InfoTip } from "./info-tip";

/** Full ranked list of one board (FR-003). Alternate orders are plain links; ranks always come from the server. */
export function BoardList({ board, mode }: { board: SquadBoardView; mode: BoardMode }) {
  const copy = BOARD_COPY[board.id];
  const rows = [...board.rows].sort((a, b) => {
    const ra = rankOf(board, a, mode);
    const rb = rankOf(board, b, mode);
    return (ra ?? Number.MAX_SAFE_INTEGER) - (rb ?? Number.MAX_SAFE_INTEGER);
  });
  const toggle =
    board.id === "prJump"
      ? { label: "Rank by", options: [["kg", "", !mode.pct], ["%", "?sort=pct", Boolean(mode.pct)]] as const }
      : board.id === "strength"
        ? { label: "Lifts", options: [["Big 3", "", !mode.big4], ["Big 4", "?lifts=4", Boolean(mode.big4)]] as const }
        : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-[-0.02em]">{copy.title}</h1>
        <InfoTip title={copy.title} text={copy.info} />
      </div>
      {toggle ? (
        <nav aria-label={toggle.label} className={`${segmentGroupClass} grid-cols-2`}>
          {toggle.options.map(([label, q, current]) => (
            <Link key={label} href={`/squad/boards/${board.id}${q}`} aria-current={current ? "true" : undefined} className={segmentClass(current)}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{copy.empty}</p>
      ) : (
        <ol className={`${cardClass} divide-y divide-line px-3`}>
          {rows.map((r) => (
            <li key={r.member.userId}>
              <BoardRow board={board} row={r} mode={mode} rank={rankOf(board, r, mode)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
