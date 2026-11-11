"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/server/actions/profile";
import type { ActionState } from "@/server/actions/state";
import { AvatarPicker } from "./avatar-picker";
import { buttonClass, describedBy, Field, FormMessage, inputClass } from "./form-bits";
import { TimezoneSelect } from "./timezone-select";

export interface ProfileFormValues {
  displayName: string;
  timezone?: string;
  dailyCalorieTarget?: number;
  dailyProteinTarget?: number | null;
  avatarUrl: string | null;
}

/** Used for first-time setup (mode="setup" → redirects Home) and for editing in settings (mode="edit"). */
export function ProfileForm({
  mode,
  submitLabel,
  initial,
}: {
  mode: "setup" | "edit";
  submitLabel: string;
  initial: ProfileFormValues;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfile, {});
  const [name, setName] = useState(initial.displayName);
  const f = state.fields ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />
      <FormMessage error={state.error} message={state.message} />

      <Field id="displayName" label="Display name" error={f.displayName}>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={40}
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={f.displayName ? true : undefined}
          aria-describedby={describedBy("displayName", f.displayName)}
          className={inputClass}
        />
      </Field>

      <AvatarPicker displayName={name} currentUrl={initial.avatarUrl} />

      <Field id="timezone" label="Timezone" error={f.timezone} hint="Your days start and end at midnight in this timezone.">
        <TimezoneSelect id="timezone" initial={initial.timezone} error={f.timezone} />
      </Field>

      <Field
        id="dailyCalorieTarget"
        label="Daily calorie target (kcal)"
        error={f.dailyCalorieTarget}
        hint="Between 500 and 10,000. Only you can see this."
      >
        <input
          id="dailyCalorieTarget"
          name="dailyCalorieTarget"
          type="number"
          inputMode="numeric"
          min={500}
          max={10000}
          step={1}
          required
          defaultValue={initial.dailyCalorieTarget}
          aria-invalid={f.dailyCalorieTarget ? true : undefined}
          aria-describedby={describedBy("dailyCalorieTarget", f.dailyCalorieTarget, "hint")}
          className={inputClass}
        />
      </Field>

      <Field
        id="dailyProteinTarget"
        label="Daily protein target (g), optional"
        error={f.dailyProteinTarget}
        hint="Between 10 and 500. Leave blank for none. Your AI coach can adjust it too."
      >
        <input
          id="dailyProteinTarget"
          name="dailyProteinTarget"
          type="number"
          inputMode="numeric"
          min={10}
          max={500}
          step={1}
          defaultValue={initial.dailyProteinTarget ?? undefined}
          aria-invalid={f.dailyProteinTarget ? true : undefined}
          aria-describedby={describedBy("dailyProteinTarget", f.dailyProteinTarget, "hint")}
          className={inputClass}
        />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
