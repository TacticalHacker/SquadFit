"use client";

import { useActionState } from "react";
import { buttonClass, describedBy, Field, FormMessage, inputClass } from "@/components/form-bits";
import { signIn } from "@/server/actions/auth";
import type { ActionState } from "@/server/actions/state";

export function SignInForm({ next, notice }: { next: string; notice?: string | undefined }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state.error} message={notice} />
      <input type="hidden" name="next" value={next} />
      <Field id="username" label="Username">
        <input
          id="username"
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={inputClass}
          aria-describedby={describedBy("username", state.error)}
        />
      </Field>
      <Field id="password" label="Password">
        <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
