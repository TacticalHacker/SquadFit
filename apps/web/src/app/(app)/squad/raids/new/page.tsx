import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AdminRaidsResponseSchema } from "@calci/shared";
import { linkClass } from "@/components/form-bits";
import { RaidForm } from "@/components/raid-form";
import { RAID_COPY } from "@/lib/plain";
import { apiFetch } from "@/server/api";
import { getMe } from "@/server/session";

export const metadata = { title: "New raid · SquadFit" };

/** Feature 021, Story 3: admins only; everyone else gets the not-found page (the API enforces the same rule). */
async function NewRaid() {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  const data = await apiFetch("/admin/raids", { schema: AdminRaidsResponseSchema });
  return <RaidForm timezone={data.timezone} defaultStartsAt={data.defaultStartsAt} />;
}

export default function NewRaidPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1 self-start text-sm`}>
        <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{RAID_COPY.newRaid}</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <NewRaid />
      </Suspense>
    </div>
  );
}
