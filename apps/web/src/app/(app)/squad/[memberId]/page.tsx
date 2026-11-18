import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { MemberProfileSchema, TimelineSchema } from "@calci/shared";
import { linkClass } from "@/components/form-bits";
import { MemberProfileView } from "@/components/member-profile";
import { Timeline } from "@/components/timeline";
import { ApiRequestError, apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Member · SquadFit" };

async function MemberContent({ params }: { params: PageProps<"/squad/[memberId]">["params"] }) {
  await requireProfile();
  const { memberId } = await params;
  const id = encodeURIComponent(memberId);
  const loaded = await Promise.all([
    apiFetch(`/squad/members/${id}`, { schema: MemberProfileSchema }),
    apiFetch(`/squad/members/${id}/timeline`, { schema: TimelineSchema }),
  ]).catch((err: unknown) => {
    if (err instanceof ApiRequestError && err.code === "MEMBER_PRIVATE") return null;
    throw err;
  });
  if (!loaded) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">This member keeps their log private.</p>;
  }
  const [profile, timeline] = loaded;
  return (
    <div className="flex flex-col gap-5">
      <MemberProfileView profile={profile} />
      <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
        <h2 id="timeline-heading" className="text-xl font-semibold">
          Activity
        </h2>
        <Timeline memberId={memberId} initial={timeline} />
      </section>
    </div>
  );
}

export default function MemberPage(props: PageProps<"/squad/[memberId]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 text-sm`}>
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <MemberContent params={props.params} />
      </Suspense>
    </div>
  );
}
