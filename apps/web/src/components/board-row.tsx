import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "./avatar";

interface RowMember {
  displayName: string;
  avatarUrl: string | null;
  isYou: boolean;
}

/** The ranked list shell: one card, hairline dividers, no horizontal scroll. */
export function BoardList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ol aria-label={label} className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {children}
    </ol>
  );
}

/**
 * One board row (feature 010): rank, avatar, name, the main figure large in tabular numerals and a muted
 * secondary line. The viewer's own row is tinted with the accent. `expand` turns the row into a disclosure.
 */
export function BoardRow({
  rank,
  member,
  main,
  unit,
  secondary,
  below,
  expand,
}: {
  rank: number | null;
  member: RowMember;
  main: ReactNode;
  unit?: string;
  secondary?: ReactNode;
  /** Extra content under the name (e.g. a progress bar). */
  below?: ReactNode;
  expand?: ReactNode;
}) {
  const body = (
    <div className="flex min-h-14 items-center gap-3 px-3 py-3">
      <span className="w-6 shrink-0 text-center text-sm font-medium tabular-nums text-muted">{rank ?? "—"}</span>
      <Avatar displayName={member.displayName} avatarUrl={member.avatarUrl} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {member.displayName}
          {member.isYou ? <span className="ml-1.5 text-xs font-normal text-muted">you</span> : null}
        </p>
        {secondary ? <p className="truncate text-xs text-muted">{secondary}</p> : null}
        {below}
      </div>
      <p className="shrink-0 text-right text-2xl font-semibold tabular-nums text-ink">
        {main}
        {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
      </p>
      {expand ? <ChevronDown aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" /> : null}
    </div>
  );
  return (
    <li className={member.isYou ? "bg-accent-soft" : undefined}>
      {expand ? (
        <details className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{body}</summary>
          <div className="border-t border-line px-4 py-3 pl-[3.75rem]">{expand}</div>
        </details>
      ) : (
        body
      )}
    </li>
  );
}

export function EmptyBoard({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
