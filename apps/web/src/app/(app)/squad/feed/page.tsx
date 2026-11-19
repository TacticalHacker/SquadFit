import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SquadFeedSchema } from "@calci/shared";
import { linkClass } from "@/components/form-bits";
import { SquadFeed } from "@/components/squad-feed";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Activity · SquadFit" };

async function FeedContent() {
  await requireProfile();
  const feed = await apiFetch("/squad/feed", { schema: SquadFeedSchema });
  return <SquadFeed items={feed.items} />;
}

/** Feature 013: the full squad feed (the Squad page shows the latest 5). */
export default function FeedPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 self-start text-sm`}>
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Activity</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <FeedContent />
      </Suspense>
    </div>
  );
}
