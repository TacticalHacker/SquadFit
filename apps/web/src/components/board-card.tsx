import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SquadBoardView } from "@calci/shared";
import { BOARD_COPY, prJumpPct, strengthBig4, unrankedYou } from "@/lib/plain";
import { Avatar } from "./avatar";
import { ClubBadge } from "./club-badge";
import { cardClass } from "./form-bits";
import { InfoTip } from "./info-tip";

type Row = SquadBoardView["rows"][number];
export type BoardMode = { pct?: boolean; big4?: boolean };

/** The one big number and the optional muted line for a row, from the shared phrases (FR-027). */
export function rowText(board: SquadBoardView, row: Row, mode: BoardMode = {}): { value: string; sub: string } {
  if (board.id === "prJump" && mode.pct) return prJumpPct(row as Extract<SquadBoardView, { id: "prJump" }>["rows"][number]);
  if (board.id === "strength" && mode.big4) return strengthBig4(row as Extract<SquadBoardView, { id: "strength" }>["rows"][number]);
  const copy = BOARD_COPY[board.id] as { value: (r: Row) => string; sub: (r: Row) => string };
  return { value: copy.value(row), sub: copy.sub(row) };
}

/** The rank shown for a row in the chosen mode (alternate orders carry their own server-side rank). */
export function rankOf(board: SquadBoardView, row: Row, mode: BoardMode = {}): number | null {
  if (board.id === "prJump" && mode.pct) return (row as Extract<SquadBoardView, { id: "prJump" }>["rows"][number]).pctRank;
  if (board.id === "strength" && mode.big4) return (row as Extract<SquadBoardView, { id: "strength" }>["rows"][number]).big4Rank;
  return row.rank;
}

/** One ranked person: rank, avatar, name (+ highest badge), one big number, at most one muted line. */
export function BoardRow({ board, row, mode, rank }: { board: SquadBoardView; row: Row; mode?: BoardMode; rank: number | null }) {
  const { value, sub } = rowText(board, row, mode);
  const muted = rank === null;
  return (
    <div className={`flex min-h-12 items-center gap-3 py-2 ${muted ? "opacity-60" : ""}`}>
      <span className={`w-6 shrink-0 text-center text-sm font-semibold tabular-nums ${rank === 1 ? "text-accent" : "text-muted"}`}>{rank ?? "–"}</span>
      <Link href={`/squad/${row.member.userId}`} className="relative z-10 flex min-h-11 min-w-0 flex-1 items-center gap-2">
        <Avatar displayName={row.member.displayName} avatarUrl={row.member.avatarUrl} size={32} />
        <span className="flex min-w-0 flex-col">
          {/* Names stay on one line: values are kept short so they fit; the ellipsis is only a last resort. */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`min-w-0 truncate whitespace-nowrap text-sm ${row.member.isYou ? "font-semibold text-ink" : "font-medium text-ink"}`}>
              {row.member.isYou ? `${row.member.displayName} (you)` : row.member.displayName}
            </span>
            {row.club ? <ClubBadge club={row.club} /> : null}
          </span>
          {board.id === "streak" ? (
            <WeekDots row={row as Extract<SquadBoardView, { id: "streak" }>["rows"][number]} label={sub} />
          ) : sub ? (
            <span className="truncate text-xs text-muted">{sub}</span>
          ) : null}
        </span>
      </Link>
      <span className="shrink-0 whitespace-nowrap text-right text-base font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/** This week's workout days against the member's goal, one dot per goal day (●●○○). */
function WeekDots({ row, label }: { row: Extract<SquadBoardView, { id: "streak" }>["rows"][number]; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-1 py-1">
      {Array.from({ length: row.target }, (_, i) => (
        <span key={i} className={`size-1.5 rounded-full ${i < row.weekDays ? "bg-accent" : "bg-line-strong"}`} />
      ))}
    </span>
  );
}

/** Feature 013 card: title + (i), top 3 (topped up with greyed unranked rows where the board allows), and the viewer's own line when they are 4th or lower (FR-003). */
export function BoardCard({ board, hidden }: { board: SquadBoardView; hidden: boolean }) {
  const copy = BOARD_COPY[board.id];
  const ranked = board.rows.filter((r) => r.rank !== null);
  const top = [...ranked, ...(copy.showUnranked ? board.rows.filter((r) => r.rank === null) : [])].slice(0, 3);
  const you = board.rows.find((r) => r.member.isYou);
  const youOutside = you && !top.includes(you);
  return (
    <section aria-labelledby={`board-${board.id}`} className={`${cardClass} relative flex min-w-0 flex-col px-3 pt-1 pb-2`}>
      <header className="flex items-center gap-1">
        <h3 id={`board-${board.id}`} className="min-w-0 flex-1 text-base font-semibold">
          {/* Stretched link: the whole card opens the full list; names and (i) sit above it. */}
          <Link href={`/squad/boards/${board.id}`} className="flex min-h-11 items-center gap-1 after:absolute after:inset-0 after:rounded-lg after:content-['']">
            {copy.title}
          </Link>
        </h3>
        <span className="relative z-10">
          <InfoTip title={copy.title} text={copy.info} />
        </span>
        <ChevronRight aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
      </header>
      {top.length === 0 ? (
        <p className="py-2 text-sm text-muted">{board.rows.length > 0 && copy.emptyUnranked ? copy.emptyUnranked : copy.empty}</p>
      ) : (
        <ol className="divide-y divide-line">
          {top.map((r) => (
            <li key={r.member.userId}>
              <BoardRow board={board} row={r} rank={r.rank} />
            </li>
          ))}
        </ol>
      )}
      {youOutside ? (
        <p className="border-t border-line pt-2 text-sm text-muted">
          {you.rank === null ? (
            unrankedYou(board, you, hidden)
          ) : (
            <>
              <span className="font-medium text-ink">You</span> · #{you.rank} · {rowText(board, you).value}
            </>
          )}
        </p>
      ) : null}
    </section>
  );
}
