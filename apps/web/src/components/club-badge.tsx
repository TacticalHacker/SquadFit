import { Award } from "lucide-react";
import type { Club } from "@calci/shared";
import { CLUB_LABEL, CLUB_SHORT } from "@/lib/plain";

/** Feature 013: the highest club badge next to a name (compact), or the full label on profiles. */
export function ClubBadge({ club, full = false }: { club: Club; full?: boolean }) {
  return (
    <span
      title={`${CLUB_LABEL[club]} (est.)`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 px-1.5 py-0.5 text-xs font-medium tabular-nums text-accent"
    >
      <Award aria-hidden size={12} strokeWidth={1.75} />
      {full ? `${CLUB_LABEL[club]} (est.)` : <><span className="sr-only">{CLUB_LABEL[club]} (est.)</span><span aria-hidden>{CLUB_SHORT[club]}</span></>}
    </span>
  );
}
