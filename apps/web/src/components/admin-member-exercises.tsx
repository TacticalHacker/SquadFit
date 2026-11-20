"use client";

import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { MUSCLE_GROUP_LABELS, type AdminExercisesResponse, type CatalogGroup } from "@calci/shared";
import { promoteExercise } from "@/server/actions/admin";
import { GroupPicker, submitClass } from "./admin-exercises";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { cardClass, noticeErrorClass, noticeOkClass, noticeWarnClass, secondaryButtonClass } from "./form-bits";

type Item = AdminExercisesResponse["memberExercises"][number];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function PromoteSheet({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: (text: string) => void }) {
  const [group, setGroup] = useState<CatalogGroup>(item.group);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 truncate text-lg font-semibold">Make &ldquo;{item.name}&rdquo; global?</h2>
      <SheetClose />
    </div>
  );
  const footer = (
    <button
      type="button"
      disabled={pending}
      className={submitClass}
      onClick={() =>
        startTransition(async () => {
          const r = await promoteExercise({ name: item.name, group });
          if (!r.ok) return setError(r.error);
          const m = r.value;
          onDone(
            `${item.name} is now in the library. ${plural(m.moved, "day", "days")} moved, ${plural(m.removed, "own copy", "own copies")} removed${m.skipped ? `, ${plural(m.skipped, "day", "days")} left as they were` : ""}.`,
          );
          onClose();
        })
      }
    >
      {pending ? "Making global…" : "Make global"}
    </button>
  );

  return (
    <BottomSheet open onClose={onClose} label={`Make ${item.name} global`} header={header} footer={footer}>
      <div className="flex flex-col gap-4 px-1 text-sm">
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <p>
          Every member will see {item.name} in the gym picker. The {plural(item.members, "member who has", "members who have")} their own copy keep all{" "}
          {plural(item.days, "logged day", "logged days")}: they move onto the library exercise with every set kept, and the own copies are removed.
        </p>
        <GroupPicker value={group} onChange={setGroup} />
        <p className="text-xs text-muted">The name stays as it is so every copy matches. You can rename it in the library afterwards.</p>
      </div>
    </BottomSheet>
  );
}

/** Feature 015 Story 6: members' own exercises that aren't in the library yet. Counts only, never who. */
export function AdminMemberExercises({ items, full }: { items: readonly Item[]; full: boolean }) {
  const [promoting, setPromoting] = useState<Item | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Member-made exercises</h2>
        <p className="text-sm text-muted">
          Exercises members added for themselves that aren&apos;t in the library. Copies with the same name are counted together; who made them is never shown.
        </p>
      </div>
      {full ? <p className={noticeWarnClass}>The library is full, so nothing can be made global right now.</p> : null}
      {notice ? (
        <p role="status" className={noticeOkClass}>
          {notice}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing here: every member exercise is already in the library.</p>
      ) : (
        <ul className={`divide-y divide-line ${cardClass}`}>
          {items.map((it) => (
            <li key={it.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{it.name}</p>
                <p className="text-sm text-muted">
                  {MUSCLE_GROUP_LABELS[it.group]} · {plural(it.members, "member", "members")} · {plural(it.days, "day", "days")} logged
                </p>
              </div>
              <button type="button" disabled={full} onClick={() => setPromoting(it)} className={secondaryButtonClass}>
                <Globe aria-hidden size={16} strokeWidth={1.75} />
                Make global
              </button>
            </li>
          ))}
        </ul>
      )}

      {promoting ? <PromoteSheet item={promoting} onClose={() => setPromoting(null)} onDone={setNotice} /> : null}
    </div>
  );
}
