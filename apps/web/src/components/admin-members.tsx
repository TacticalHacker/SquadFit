"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import type { AdminUserCreated } from "@calci/shared";
import { createMember } from "@/server/actions/admin";
import { buttonClass, cardClass, inputClass, noticeErrorClass, secondaryButtonClass } from "./form-bits";

/** Feature 015 Story 5: create a member account; the temporary password is shown here once and kept nowhere. */
export function AdminMembers() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminUserCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Username: ${created.username}\nTemporary password: ${created.temporaryPassword}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="members-h" className="flex flex-col gap-3">
      <h2 id="members-h" className="text-xl font-semibold">
        Members
      </h2>
      <p className="text-sm text-muted">Create an account and send the username and temporary password to the new member. They choose their own password at first sign-in.</p>

      {created ? (
        <div className={`flex flex-col gap-3 p-4 ${cardClass}`} role="status">
          <p className="text-sm font-medium text-success">Account created. This password is shown only once.</p>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Username</dt>
            <dd className="font-medium text-ink">{created.username}</dd>
            <dt className="text-muted">Temporary password</dt>
            <dd className="font-mono text-base text-ink break-all">{created.temporaryPassword}</dd>
          </dl>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className={`${secondaryButtonClass} flex-1`}>
              {copied ? <Check aria-hidden size={18} strokeWidth={1.75} /> : <Copy aria-hidden size={18} strokeWidth={1.75} />}
              {copied ? "Copied" : "Copy both"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setCopied(false);
              }}
              className={secondaryButtonClass}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className={`flex flex-col gap-4 p-4 ${cardClass}`}
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await createMember({ username });
              if (r.ok) {
                setCreated(r.value);
                setUsername("");
              } else setError(r.error);
            });
          }}
        >
          <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby="username-hint"
              className={`font-normal ${inputClass}`}
            />
            <span id="username-hint" className="text-xs font-normal text-muted">
              3–20 letters, digits or underscores. Can&apos;t be changed later.
            </span>
          </label>
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>
      )}
    </section>
  );
}
