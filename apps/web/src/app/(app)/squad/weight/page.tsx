import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SquadWeightSchema, WeightViewSchema } from "@calci/shared";
import { BodyweightCard } from "@/components/bodyweight-card";
import { linkClass } from "@/components/form-bits";
import { SegmentLinks } from "@/components/segment-links";
import { SquadWeightChart } from "@/components/squad-weight-chart";
import { WEIGHT_COPY } from "@/lib/plain";
import { apiFetch } from "@/server/api";
import { requireProfile } from "@/server/session";

export const metadata = { title: "Bodyweight · SquadFit" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Feature 017: Me = your own weigh-ins (feature 014 card); Squad = kg change of members who share. */
async function WeightContent({ searchParams }: { searchParams: PageProps<"/squad/weight">["searchParams"] }) {
  const squad = first((await searchParams).view) === "squad";
  const { profile } = await requireProfile();
  const toggle = (
    <SegmentLinks
      label="Whose weight"
      options={[
        { label: WEIGHT_COPY.me, href: "/squad/weight", current: !squad },
        { label: WEIGHT_COPY.squad, href: "/squad/weight?view=squad", current: squad },
      ]}
    />
  );
  if (squad) {
    const data = await apiFetch("/squad/weight?range=M", { schema: SquadWeightSchema });
    return (
      <>
        {toggle}
        <SquadWeightChart initial={data} />
      </>
    );
  }
  const view = await apiFetch("/me/weight?range=M", { schema: WeightViewSchema });
  return (
    <>
      {toggle}
      <BodyweightCard initialView={view} timezone={profile.timezone} />
    </>
  );
}

export default function WeightPage(props: PageProps<"/squad/weight">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/squad" className={`${linkClass} inline-flex min-h-11 items-center gap-1.5 self-start text-sm`}>
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Squad
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{WEIGHT_COPY.title}</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <WeightContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
