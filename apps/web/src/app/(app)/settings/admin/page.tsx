import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AdminExercisesResponseSchema } from "@calci/shared";
import { AdminExercises } from "@/components/admin-exercises";
import { AdminMembers } from "@/components/admin-members";
import { AdminMemberExercises } from "@/components/admin-member-exercises";
import { linkClass } from "@/components/form-bits";
import { SegmentLinks } from "@/components/segment-links";
import { apiFetch } from "@/server/api";
import { getMe } from "@/server/session";

export const metadata = { title: "Admin · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Feature 015: admins only. Everyone else gets the not-found page; the API enforces the same rule. */
async function Panel({ searchParams }: { searchParams: PageProps<"/settings/admin">["searchParams"] }) {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  const tab = first((await searchParams).tab);
  const members = tab === "members";
  const made = tab === "member-made";
  return (
    <div className="flex flex-col gap-6">
      <SegmentLinks
        label="Admin sections"
        options={[
          { label: "Members", href: "/settings/admin?tab=members", current: members },
          { label: "Exercise library", href: "/settings/admin", current: !members && !made },
          { label: "Member-made", href: "/settings/admin?tab=member-made", current: made },
        ]}
      />
      {members ? <AdminMembers /> : made ? <MemberMade /> : <Library />}
    </div>
  );
}

async function Library() {
  const data = await apiFetch("/admin/exercises", { schema: AdminExercisesResponseSchema });
  return <AdminExercises data={data} />;
}

async function MemberMade() {
  const data = await apiFetch("/admin/exercises", { schema: AdminExercisesResponseSchema });
  return <AdminMemberExercises items={data.memberExercises} full={data.catalog.length >= data.limit} />;
}

export default function AdminPage(props: PageProps<"/settings/admin">) {
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/settings" className={`inline-flex items-center gap-1 ${linkClass}`}>
          <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
          Back to settings
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-[-0.02em]">Admin</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Panel searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
