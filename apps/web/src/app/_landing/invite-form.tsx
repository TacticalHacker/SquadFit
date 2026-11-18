"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { WAITLIST_GOAL_LABELS, WaitlistGoalSchema } from "@calci/shared";
import { buttonClass, inputClass } from "@/components/form-bits";
import { requestInvite } from "@/server/actions/waitlist";
import type { ActionState } from "@/server/actions/state";

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestInvite, {});

  if (state.message === "received") {
    return (
      <div role="status" className="rounded-lg border border-success/30 bg-success/10 p-6 text-center">
        <p className="flex items-center justify-center gap-2 text-lg font-semibold">
          <Check aria-hidden size={20} strokeWidth={1.75} className="text-success" />
          You&apos;re on the list
        </p>
        <p className="mt-1 text-sm text-muted">We&apos;ll reach out when a squad spot opens.</p>
      </div>
    );
  }

  const err = (k: string) => state.fields?.[k];
  const goalErr = err("primaryGoal");
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Field id="invite-name" label="Name" error={err("name")}>
        <input id="invite-name" name="name" autoComplete="name" maxLength={60} required className={inputClass} aria-invalid={!!err("name")} aria-describedby={err("name") ? "invite-name-err" : undefined} />
      </Field>
      <Field id="invite-email" label="Email" error={err("email")}>
        <input id="invite-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required className={inputClass} aria-invalid={!!err("email")} aria-describedby={err("email") ? "invite-email-err" : undefined} />
      </Field>
      {/* Same `primaryGoal` field as before, shown as choice chips instead of a <select>. */}
      <fieldset aria-describedby={goalErr ? "invite-goal-err" : undefined} aria-invalid={!!goalErr} className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Primary goal</legend>
        <div className="grid grid-cols-2 gap-2">
          {WaitlistGoalSchema.options.map((g) => (
            <label
              key={g}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-center text-sm font-medium transition-colors duration-150 hover:bg-surface-2 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:shadow-[var(--focus-ring)]"
            >
              <input type="radio" name="primaryGoal" value={g} required className="sr-only" />
              {WAITLIST_GOAL_LABELS[g]}
            </label>
          ))}
        </div>
        {goalErr ? (
          <p id="invite-goal-err" className="text-sm text-danger">
            {goalErr}
          </p>
        ) : null}
      </fieldset>
      {/* Honeypot (research R6): off-screen, skipped by keyboard and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="invite-website">Website</label>
        <input id="invite-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${buttonClass} px-5`}>
        {pending ? "Sending…" : "Request Squad Invite"}
      </button>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
