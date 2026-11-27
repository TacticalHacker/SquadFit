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

export const metadata = { title: "Manage raid · SquadFit" };

/** Feature 021, Story 4: edit, cancel or delete a raid. Admins only. */
async function EditRaid({ params }: { params: PageProps<"/squad/raids/[raidId]">["params"] }) {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  const { raidId } = await params;
  const data = await apiFetch("/admin/raids", { schema: AdminRaidsResponseSchema });
  const raid = data.raids.find((r) => r.raidId === raidId);
  if (!raid) notFound();
  return <RaidForm key={raid.updatedAt} timezone={data.timezone} defaultStartsAt={data.defaultStartsAt} raid={raid} />;
}

export default function EditRaidPage(props: PageProps<"/squad/raids/[raidId]">) {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1 self-start text-sm`}>
        <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{RAID_COPY.manage}</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <EditRaid params={props.params} />
      </Suspense>
    </div>
  );
}
