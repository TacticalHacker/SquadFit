import Link from "next/link";
import type { HallOfFame as HallOfFameData } from "@calci/shared";
import { RECORD_LABEL, monthName, recordValue, shortDate } from "@/lib/plain";
import { Avatar } from "./avatar";
import { ClubBadge } from "./club-badge";
import { cardClass } from "./form-bits";

/** Feature 013: all-time records, one row each: what, who, how much, when. */
export function HallOfFame({ data }: { data: HallOfFameData }) {
  return (
    <ul aria-label="Hall of Fame" className={`${cardClass} divide-y divide-line`}>
      {data.records.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 px-3 py-3">
          <p className="text-xs font-medium text-muted">{RECORD_LABEL[r.id]}</p>
          {r.holder ? (
            <div className="flex items-center gap-3">
              <Link href={`/squad/${r.holder.userId}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-2">
                <Avatar displayName={r.holder.displayName} avatarUrl={r.holder.avatarUrl} size={32} />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{r.holder.isYou ? `${r.holder.displayName} (you)` : r.holder.displayName}</span>
                    {r.club ? <ClubBadge club={r.club} /> : null}
                  </span>
                  <span className="text-xs text-muted">{r.date ? shortDate(r.date) : r.month ? monthName(r.month) : ""}</span>
                </span>
              </Link>
              <span className="shrink-0 text-right text-base font-semibold tabular-nums text-ink">{recordValue(r.id, r.value, r.liftName)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">No record yet</p>
          )}
        </li>
      ))}
    </ul>
  );
}
