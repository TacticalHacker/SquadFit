import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AdminExercisesResponseSchema } from "@calci/shared";
import { AdminExercises } from "@/components/admin-exercises";
import { AdminMembers } from "@/components/admin-members";
import { linkClass } from "@/components/form-bits";
import { apiFetch } from "@/server/api";
import { getMe } from "@/server/session";

export const metadata = { title: "Admin · SquadFit" };

/** Feature 015: admins only. Everyone else gets the not-found page; the API enforces the same rule. */
async function Panel() {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  const data = await apiFetch("/admin/exercises", { schema: AdminExercisesResponseSchema });
  return (
    <div className="flex flex-col gap-10">
      <AdminMembers />
      <section aria-labelledby="library-h" className="flex flex-col gap-6">
        <h2 id="library-h" className="text-xl font-semibold">
          Exercise library
        </h2>
        <AdminExercises data={data} />
      </section>
    </div>
  );
}

export default function AdminPage() {
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
        <Panel />
      </Suspense>
    </>
  );
}
