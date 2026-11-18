"use client";

import { useActionState, useState } from "react";
import { SQUAD_MAX_TARGET, SQUAD_MIN_TARGET, type SquadSettings } from "@calci/shared";
import { saveSquadSettings } from "@/server/actions/squad";
import type { ActionState } from "@/server/actions/state";
import { FormMessage, buttonClass } from "./form-bits";
import { Stepper } from "./stepper";

const initialState: ActionState = {};

/** Weekly target, leaderboard visibility and body weight sharing (feature 010, FR-003/004/006). */
export function SquadSettingsForm({ initial, hasBodyWeight }: { initial: SquadSettings; hasBodyWeight: boolean }) {
  const [state, action, pending] = useActionState(saveSquadSettings, initialState);
  const [target, setTarget] = useState(initial.weeklyTarget);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span id="weekly-target-label" className="text-sm font-medium text-ink">
          Weekly workout target
        </span>
        <Stepper
          label="weekly target"
          onDec={() => setTarget((t) => Math.max(SQUAD_MIN_TARGET, t - 1))}
          onInc={() => setTarget((t) => Math.min(SQUAD_MAX_TARGET, t + 1))}
          decDisabled={target <= SQUAD_MIN_TARGET}
          incDisabled={target >= SQUAD_MAX_TARGET}
        >
          <span aria-labelledby="weekly-target-label" className="min-w-16 text-center text-lg font-semibold tabular-nums">
            {target} {target === 1 ? "day" : "days"}
          </span>
        </Stepper>
        <input type="hidden" name="weeklyTarget" value={target} />
        <p className="text-sm text-muted">Days with a workout that make a week count toward your streak.</p>
      </div>

      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="leaderboardVisible" defaultChecked={initial.leaderboardVisible} className="mt-1 size-5 shrink-0 accent-accent" />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-ink">Show me on the squad leaderboard</span>
          <span className="text-sm text-muted">When off, you can still see the squad, but nobody sees you.</span>
        </span>
      </label>

      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="shareBodyWeight"
          defaultChecked={initial.shareBodyWeight}
          disabled={!hasBodyWeight && !initial.shareBodyWeight}
          className="mt-1 size-5 shrink-0 accent-accent"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-ink">Share my body weight for relative strength</span>
          <span className="text-sm text-muted">
            Others see only lift ÷ body weight, never your weight.
            {hasBodyWeight ? "" : " Save your body weight in Profile first."}
          </span>
        </span>
      </label>

      <FormMessage error={state.error} message={state.message} />
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save squad settings"}
        </button>
      </div>
    </form>
  );
}
