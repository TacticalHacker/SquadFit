"use client";

import { useActionState } from "react";
import { WAITLIST_GOAL_LABELS, WaitlistGoalSchema } from "@calci/shared";
import { requestInvite } from "@/server/actions/waitlist";
import type { ActionState } from "@/server/actions/state";

const input =
  "w-full min-w-0 rounded-xl border border-white/10 bg-[#0D0F12] px-3 py-2.5 text-base text-white placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestInvite, {});

  if (state.message === "received") {
    return (
      <div role="status" className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-center">
        <p className="text-lg font-semibold text-white">You&apos;re on the list ✨</p>
        <p className="mt-1 text-sm text-zinc-300">We&apos;ll reach out when a squad spot opens.</p>
      </div>
    );
  }

  const err = (k: string) => state.fields?.[k];
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Field id="invite-name" label="Name" error={err("name")}>
        <input id="invite-name" name="name" autoComplete="name" maxLength={60} required className={input} aria-invalid={!!err("name")} aria-describedby={err("name") ? "invite-name-err" : undefined} />
      </Field>
      <Field id="invite-email" label="Email" error={err("email")}>
        <input id="invite-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required className={input} aria-invalid={!!err("email")} aria-describedby={err("email") ? "invite-email-err" : undefined} />
      </Field>
      <Field id="invite-goal" label="Primary goal" error={err("primaryGoal")}>
        <select id="invite-goal" name="primaryGoal" required defaultValue="" className={input} aria-invalid={!!err("primaryGoal")} aria-describedby={err("primaryGoal") ? "invite-goal-err" : undefined}>
          <option value="" disabled>
            Choose one
          </option>
          {WaitlistGoalSchema.options.map((g) => (
            <option key={g} value={g}>
              {WAITLIST_GOAL_LABELS[g]}
            </option>
          ))}
        </select>
      </Field>
      {/* Honeypot (research R6): off-screen, skipped by keyboard and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="invite-website">Website</label>
        <input id="invite-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-[#0D0F12] transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request Squad Invite"}
      </button>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
