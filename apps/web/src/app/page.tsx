import Link from "next/link";
import { Suspense, type ReactNode } from "react";
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

const signInClass =
  "rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export default function LandingPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip bg-[#0D0F12] text-zinc-100 [color-scheme:dark]">
      {/* Decorative glows */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] max-w-[150vw] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-0 top-[36rem] h-80 w-80 translate-x-1/3 rounded-full bg-purple-600/20 blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0D0F12]/75 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">SquadFit</span>
            <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
              Private beta
            </span>
          </span>
          <Link href="/sign-in" className={`shrink-0 ${signInClass}`}>
            Member Sign In
          </Link>
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-20 pb-20 sm:gap-28">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              ✨ Powered by Model Context Protocol (MCP)
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              10-second gym &amp; macro logging,{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
                coached by your own AI.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              Built for lifters who hate bloated fitness apps. Tap your sets in seconds, track daily protein, keep your
              squad streak alive, and connect Claude or ChatGPT directly to your workout data.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#invite"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-center font-semibold text-[#0D0F12] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Request Squad Invite
              </a>
              <Link href="/sign-in" className={`rounded-xl py-3 text-center ${signInClass}`}>
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
          <p className="text-sm font-semibold uppercase tracking-wider text-purple-300">Bring your own AI</p>
          <h2 id="byo-ai" className="mt-2 text-3xl font-bold tracking-tight text-white">
            Your coach, your model, your data.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card icon="🔌" title="Direct Claude & ChatGPT sync">
              Connect your own AI client to SquadFit over remote MCP. Ask it about progressive overload, protein gaps and
              how your week is trending, and it answers from your real logs.
            </Card>
            <Card icon="🔥" title="Realistic lifting calorie math">
              Your AI can adjust the burn on your gym sessions using your body weight, the kind of exercise and how you
              trained, and patch the result straight back to your day. Adjusted numbers are clearly marked.
            </Card>
            <Card icon="🔒" title="Private & isolated">
              Every member gets their own key. Your AI sees only your logs and acts only as you, while the squad keeps
              training side by side.
            </Card>
          </div>
        </section>

        {/* Invite */}
        <section id="invite" aria-labelledby="invite-title" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4">
          <div className="grid gap-8 rounded-3xl border border-white/10 bg-[#161920]/80 p-6 backdrop-blur sm:p-10 md:grid-cols-2">
            <div className="min-w-0">
              <h2 id="invite-title" className="text-3xl font-bold tracking-tight text-white">
                Request a squad invite
              </h2>
              <p className="mt-3 text-zinc-300">
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

      <footer className="relative z-10 border-t border-white/10 px-4 py-6 text-center text-xs text-zinc-500">
        SquadFit · Private beta · Accounts by invitation only
      </footer>
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#161920] p-6 transition hover:border-emerald-400/30">
      <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-white/5 text-xl">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{children}</p>
    </article>
  );
}
