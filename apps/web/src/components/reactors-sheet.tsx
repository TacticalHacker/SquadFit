"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Reactors } from "@calci/shared";
import { loadReactors } from "@/server/actions/squad";
import { NOTIFY_COPY, REACTIONS, othersCount } from "@/lib/plain";
import { Avatar } from "./avatar";
import { BottomSheet, SheetClose } from "./bottom-sheet";

/**
 * Feature 022: who reacted to a feed item or workout day, per reaction. Loaded when opened; hidden members are
 * never named (the server only counts them).
 */
export function ReactorsSheet({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Reactors | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadReactors(id).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.reactors);
        setError(false);
      } else setError(true);
    });
    return () => {
      live = false;
    };
  }, [id, open]);

  const groups = data ? REACTIONS.filter((r) => data[r.type].members.length + data[r.type].others > 0) : [];
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={NOTIFY_COPY.whoTitle}
      header={
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{NOTIFY_COPY.whoTitle}</h2>
          <SheetClose />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-4">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {NOTIFY_COPY.whoError}
          </p>
        ) : !data ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted">{NOTIFY_COPY.whoEmpty}</p>
        ) : (
          groups.map(({ type, emoji, label }) => (
            <section key={type} aria-label={label} className="flex flex-col gap-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span aria-hidden>{emoji}</span>
                {label}
                <span className="font-normal tabular-nums text-muted">{data[type].members.length + data[type].others}</span>
              </h3>
              <ul className="flex flex-col">
                {data[type].members.map((m) => (
                  <li key={m.userId}>
                    <Link href={`/squad/${m.userId}`} className="flex min-h-11 items-center gap-3 rounded-md px-1 text-sm text-ink hover:bg-surface-2 active:bg-line active:duration-0">
                      <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={28} />
                      {m.isYou ? "You" : m.displayName}
                    </Link>
                  </li>
                ))}
                {data[type].others > 0 ? <li className="px-1 py-2 text-sm text-muted">{othersCount(data[type].others)}</li> : null}
              </ul>
            </section>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
