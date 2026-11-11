"use client";

import { useActionState } from "react";
import { buttonClass, describedBy, Field, FormMessage, inputClass } from "@/components/form-bits";
import { changePassword } from "@/server/actions/auth";
import type { ActionState } from "@/server/actions/state";

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePassword, {});
  const f = state.fields ?? {};
  const field = (id: string, label: string, autoComplete: string, hint?: string) => (
    <Field id={id} label={label} error={f[id]} {...(hint ? { hint } : {})}>
      <input
        id={id}
        name={id}
        type="password"
        required
        autoComplete={autoComplete}
        aria-invalid={f[id] ? true : undefined}
        aria-describedby={describedBy(id, f[id], hint)}
        className={inputClass}
      />
    </Field>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state.error} message={state.message} />
      {field("current", "Current password", "current-password")}
      {field("newPassword", "New password", "new-password", "At least 8 characters.")}
      {field("confirm", "Confirm new password", "new-password")}
      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
