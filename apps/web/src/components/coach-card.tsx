import Markdown from "react-markdown";
import type { CoachNote } from "@calci/shared";
import { coachMarkdownOptions } from "@/lib/coach-markdown";

/** The AI coach's note for the day: markdown summary plus a recommendations list. Read-only. */
export function CoachCard({ note }: { note: CoachNote }) {
  return (
    <section aria-label="AI coach note" className="flex flex-col gap-3 rounded-2xl bg-[#1E293B] p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-purple-400/20 px-2 py-0.5 text-xs font-semibold tracking-wide text-purple-300">
          AI
        </span>
        <h2 className="text-sm font-semibold text-slate-100">Coach note</h2>
      </div>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-200 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-slate-50 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:border-white/10 [&_td]:py-1 [&_td]:pr-3 [&_th]:pb-1 [&_th]:pr-3 [&_th]:text-slate-400">
        <Markdown {...coachMarkdownOptions}>{note.summaryMarkdown}</Markdown>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendations</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-slate-200">
          {note.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
