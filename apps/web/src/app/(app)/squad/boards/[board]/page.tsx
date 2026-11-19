import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SquadBoardsSchema } from "@calci/shared";
import { BoardList } from "@/components/board-list";
import { linkClass } from "@/components/form-bits";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Board · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Feature 013: one board's full ranked list, from the same response as the cards. */
async function BoardContent({ params, searchParams }: { params: PageProps<"/squad/boards/[board]">["params"]; searchParams: PageProps<"/squad/boards/[board]">["searchParams"] }) {
  await requireProfile();
  const [{ board: id }, q] = await Promise.all([params, searchParams]);
  const data = await apiFetch("/squad/boards", { schema: SquadBoardsSchema });
  const board = data.boards.find((b) => b.id === id);
  if (!board) notFound();
  return <BoardList board={board} mode={{ pct: first(q.sort) === "pct", big4: first(q.lifts) === "4" }} />;
}

export default function BoardPage(props: PageProps<"/squad/boards/[board]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 self-start text-sm`}>
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <BoardContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
