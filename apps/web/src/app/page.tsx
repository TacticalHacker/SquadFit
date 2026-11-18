import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Flame, Lock, Plug, type LucideIcon } from "lucide-react";
import { badgeClass, buttonClass, cardClass, secondaryButtonClass } from "@/components/form-bits";
import { InviteForm } from "./_landing/invite-form";
import { ProductPreview } from "./_landing/product-preview";
import { PulseStrip } from "./_landing/pulse-strip";

/**
 * Public landing page (feature 009). Static: the proxy sends signed-in members to /workouts/gym before this
 * renders (research R1), so nothing here reads cookies. Only the pulse strip streams in at request time.
 */
export const metadata = {
  title: "SquadFit · 10-second gym & macro logging",
  description:
    "Tap your sets in seconds, track daily protein, keep your squad streak alive, and connect Claude or ChatGPT to your own workout data.",
};

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="text-lg font-semibold tracking-[-0.015em]">SquadFit</span>
            <span className={badgeClass}>Private beta</span>
          </span>
          <Link href="/sign-in" className={`shrink-0 text-sm ${secondaryButtonClass}`}>
            Member Sign In
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-20 pb-20 sm:gap-28">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <p className={badgeClass}>Powered by Model Context Protocol (MCP)</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-5xl">
              10-second gym &amp; macro logging, coached by your own AI.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Built for lifters who hate bloated fitness apps. Tap your sets in seconds, track daily protein, keep your
              squad streak alive, and connect Claude or ChatGPT directly to your workout data.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#invite" className={`${buttonClass} px-5`}>
                Request Squad Invite
              </a>
              <Link href="/sign-in" className={`${secondaryButtonClass} px-5`}>
                Member Sign In
              </Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <Suspense fallback={null}>
          <PulseStrip />
        </Suspense>

        {/* Bring your own AI */}
        <section aria-labelledby="byo-ai" className="mx-auto w-full max-w-5xl px-4">
          <p className="eyebrow">Bring your own AI</p>
          <h2 id="byo-ai" className="mt-2 text-3xl font-semibold">
            Your coach, your model, your data.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card icon={Plug} title="Direct Claude & ChatGPT sync">
              Connect your own AI client to SquadFit over remote MCP. Ask it about progressive overload, protein gaps and
              how your week is trending, and it answers from your real logs.
            </Card>
            <Card icon={Flame} title="Realistic lifting calorie math">
              Your AI can adjust the burn on your gym sessions using your body weight, the kind of exercise and how you
              trained, and patch the result straight back to your day. Adjusted numbers are clearly marked.
            </Card>
            <Card icon={Lock} title="Private & isolated">
              Every member gets their own key. Your AI sees only your logs and acts only as you, while the squad keeps
              training side by side.
            </Card>
          </div>
        </section>

        {/* Invite */}
        <section id="invite" aria-labelledby="invite-title" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4">
          <div className={`grid gap-8 p-6 sm:p-10 md:grid-cols-2 ${cardClass}`}>
            <div className="min-w-0">
              <h2 id="invite-title" className="text-3xl font-semibold">
                Request a squad invite
              </h2>
              <p className="mt-3 text-muted">
                SquadFit is invite-only while we&apos;re in private beta. Leave your details and we&apos;ll reach out when
                a spot opens.
              </p>
            </div>
            <div className="relative min-w-0">
              <InviteForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        SquadFit · Private beta · Accounts by invitation only
      </footer>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <article className={`p-6 ${cardClass}`}>
      <span aria-hidden className="grid size-10 place-items-center rounded-md bg-surface-2 text-accent">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </article>
  );
}
