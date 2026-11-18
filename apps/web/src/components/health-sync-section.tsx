"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import type { StepSettings } from "@calci/shared";
import { issueHealthToken, revokeHealthToken, saveStepSettings } from "@/server/actions/health";
import type { ActionState } from "@/server/actions/state";
import {
  Field,
  FormMessage,
  buttonClass,
  dangerLinkClass,
  describedBy,
  iconButtonClass,
  inputClass,
  noticeErrorClass,
  noticeWarnClass,
  secondaryButtonClass,
} from "./form-bits";

export interface HealthSyncView {
  /** Pre-formatted in the member's timezone on the server, so the client never formats dates. */
  token: { created: string; lastUsed: string | null } | null;
  lastSync: { when: string; source: string } | null;
  steps: StepSettings;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      className={iconButtonClass}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={18} strokeWidth={1.75} aria-hidden /> : <Copy size={18} strokeWidth={1.75} aria-hidden />}
    </button>
  );
}

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} className={`${inputClass} font-mono text-sm`} onFocus={(e) => e.currentTarget.select()} />
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

const initialState: ActionState = {};

/** Settings → "Apple Health sync" (feature 012): AI agent or Shortcut, the Health sync token, step goal and sharing. */
export function HealthSyncSection({ view, endpointUrl, shortcutUrl }: { view: HealthSyncView; endpointUrl: string; shortcutUrl: string | null }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState(saveStepSettings, initialState);

  const issue = () =>
    start(async () => {
      setError(null);
      const r = await issueHealthToken();
      if (r.ok) setRevealed(r.token);
      else setError(r.error);
    });
  const revoke = () =>
    start(async () => {
      setError(null);
      const r = await revokeHealthToken();
      if (r.ok) setRevealed(null);
      else setError(r.error ?? "Couldn't revoke. Try again.");
    });

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-1 text-sm text-muted">
        <li>
          <span className="font-medium text-ink">AI agent:</span> ask your connected ChatGPT or Claude to &ldquo;sync my steps&rdquo;; it uses your AI
          key.
        </li>
        <li>
          <span className="font-medium text-ink">iPhone Shortcut:</span> runs daily and sends your Apple Health totals with a Health sync token.
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Health sync token</h3>
        {revealed ? (
          <div className="flex flex-col gap-2">
            <CopyField id="health-token" label="Health sync token" value={revealed} />
            <p className={noticeWarnClass}>Copy it now: this is the only time it&apos;s shown. It can only save your daily activity.</p>
          </div>
        ) : view.token ? (
          <p className="text-sm text-muted">
            <KeyRound size={16} strokeWidth={1.75} aria-hidden className="mr-1.5 inline align-[-3px]" />
            Created {view.token.created} · {view.token.lastUsed ? `last used ${view.token.lastUsed}` : "not used yet"}
          </p>
        ) : (
          <p className="text-sm text-muted">No token yet. Generate one to use the Shortcut or Health Auto Export.</p>
        )}
        {error ? (
          <p role="alert" className={noticeErrorClass}>
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={issue} disabled={pending} className={view.token || revealed ? secondaryButtonClass : buttonClass}>
            {view.token || revealed ? "Regenerate token" : "Generate token"}
          </button>
          {view.token || revealed ? (
            <button type="button" onClick={revoke} disabled={pending} className={dangerLinkClass}>
              Revoke
            </button>
          ) : null}
        </div>
        {view.token || revealed ? <p className="text-sm text-muted">Regenerating stops the old token at once; paste the new one into the Shortcut.</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Set up the Shortcut</h3>
        {shortcutUrl ? (
          <div>
            <a href={shortcutUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
              Add the SquadFit Shortcut
            </a>
          </div>
        ) : null}
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          <li>Generate a token above and copy it.</li>
          <li>{shortcutUrl ? "Add the SquadFit Shortcut on your iPhone and paste the token when asked." : "Create a Shortcut that reads today's and yesterday's steps from Health and posts them to the address below with the token."}</li>
          <li>In the Shortcuts app, go to Automation → New → Time of Day (e.g. 9:30 pm, daily), run the Shortcut, and turn off &ldquo;Ask Before Running&rdquo;.</li>
          <li>Run it once by hand and allow Health access. &ldquo;Last synced&rdquo; below updates.</li>
        </ol>
        <CopyField id="health-endpoint" label="Sync address" value={endpointUrl} />
        <p className="text-sm text-muted">
          Send <span className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</span> with JSON{" "}
          <span className="font-mono text-xs">{'{ "days": [{ "date": "YYYY-MM-DD", "steps": 8423 }] }'}</span>. Health Auto Export&apos;s REST JSON
          works at the same address.
        </p>
        <p className="text-sm text-ink">
          {view.lastSync ? (
            <>
              Last synced <span className="font-medium">{view.lastSync.when}</span> · {view.lastSync.source}
            </>
          ) : (
            "Not synced yet"
          )}
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <h3 className="text-base font-semibold">Steps</h3>
        <Field id="dailyStepGoal" label="Daily step goal" error={state.fields?.dailyStepGoal} hint="1,000 to 50,000 steps">
          <input
            id="dailyStepGoal"
            name="dailyStepGoal"
            inputMode="numeric"
            defaultValue={view.steps.dailyStepGoal}
            aria-invalid={state.fields?.dailyStepGoal ? true : undefined}
            aria-describedby={describedBy("dailyStepGoal", state.fields?.dailyStepGoal, "1,000 to 50,000 steps")}
            className={`${inputClass} max-w-40 tabular-nums`}
          />
        </Field>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="shareSteps" defaultChecked={view.steps.shareSteps} className="mt-1 size-5 shrink-0 accent-accent" />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">Share my steps</span>
            <span className="text-sm text-muted">
              Squad members see your daily steps and goal days (only while you&apos;re shown on the leaderboard). Active calories and distance appear
              on your profile only.
            </span>
          </span>
        </label>
        <FormMessage error={state.fields ? undefined : state.error} message={state.message} />
        <div>
          <button type="submit" disabled={saving} className={buttonClass}>
            {saving ? "Saving…" : "Save steps settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
