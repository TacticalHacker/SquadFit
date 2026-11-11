"use client";

import { useActionState } from "react";
import { buttonClass, describedBy, Field, FormMessage, inputClass } from "@/components/form-bits";
import { setNewPassword } from "@/server/actions/auth";
import type { ActionState } from "@/server/actions/state";

export default function NewPasswordPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(setNewPassword, {});
  const f = state.fields ?? {};
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Choose your password</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Replace the temporary password you were given with one only you know.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <FormMessage error={state.error} />
        <Field id="newPassword" label="New password" error={f.newPassword} hint="At least 8 characters.">
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={f.newPassword ? true : undefined}
            aria-describedby={describedBy("newPassword", f.newPassword, "hint")}
            className={inputClass}
          />
        </Field>
        <Field id="confirm" label="Confirm new password" error={f.confirm}>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={f.confirm ? true : undefined}
            aria-describedby={describedBy("confirm", f.confirm)}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Set password"}
        </button>
      </form>
    </main>
  );
}
