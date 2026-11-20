"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import {
  CATALOG_GROUPS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type AdminExercisesResponse,
  type AdminMergeResponse,
  type CatalogExercise,
  type CatalogGroup,
} from "@calci/shared";
import { addExercise, mergeExercise, updateExercise } from "@/server/actions/admin";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { badgeClass, buttonClass, cardClass, chipClass, inputClass, noticeErrorClass, noticeOkClass, secondaryButtonClass } from "./form-bits";

type Row = { exerciseId: string; name: string; group: string; builtIn: boolean; item?: CatalogExercise };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

function GroupPicker({ value, onChange }: { value: CatalogGroup; onChange: (g: CatalogGroup) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Muscle group</legend>
      <div className="flex flex-wrap gap-2">
        {CATALOG_GROUPS.map((g) => (
          <button key={g} type="button" aria-pressed={g === value} onClick={() => onChange(g)} className={chipClass(g === value)}>
            {MUSCLE_GROUP_LABELS[g]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AddForm({ full }: { full: boolean }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<CatalogGroup>("chest");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={`flex flex-col gap-4 p-4 ${cardClass}`}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setAdded(null);
        startTransition(async () => {
          const r = await addExercise({ name, group });
          if (r.ok) {
            setAdded(`Added ${name.trim().replace(/\s+/g, " ")}. Members see it within a few minutes.`);
            setName("");
          } else setError(r.error);
        });
      }}
    >
      <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
      <div role="status">{added ? <p className={noticeOkClass}>{added}</p> : null}</div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={`font-normal ${inputClass}`}
        />
      </label>
      <GroupPicker value={group} onChange={setGroup} />
      <button type="submit" disabled={pending || full} className={buttonClass}>
        {pending ? "Adding…" : "Add exercise"}
      </button>
    </form>
  );
}

function EditSheet({ item, onClose }: { item: CatalogExercise; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [group, setGroup] = useState<CatalogGroup>(item.group);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const retired = item.status === "retired";

  const send = (patch: Record<string, string>) => {
    setError(null);
    startTransition(async () => {
      const r = await updateExercise(item.exerciseId, { updatedAt: item.updatedAt, ...patch });
      if (r.ok) onClose();
      else setError(r.error);
    });
  };
  const save = () => {
    const patch: Record<string, string> = {};
    if (name.trim() !== item.name) patch.name = name;
    if (group !== item.group) patch.group = group;
    if (Object.keys(patch).length === 0) return onClose();
    send(patch);
  };

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 text-lg font-semibold">Edit exercise</h2>
      <SheetClose />
    </div>
  );
  const footer = (
    <div className="flex flex-col gap-2">
      <button type="submit" form="admin-exercise" disabled={pending} className={`min-h-12 w-full text-base ${buttonClass}`}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" disabled={pending} onClick={() => send({ status: retired ? "active" : "retired" })} className={secondaryButtonClass}>
        {retired ? "Restore" : "Retire"}
      </button>
    </div>
  );

  return (
    <BottomSheet open onClose={onClose} label="Edit exercise" header={header} footer={footer}>
      <form
        id="admin-exercise"
        className="flex flex-col gap-4 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="off" className={`font-normal ${inputClass}`} />
        </label>
        <GroupPicker value={group} onChange={setGroup} />
        <p className="text-sm text-muted">
          {retired ? "Retired: hidden from the picker and the AI. Logged days keep it. " : null}
          Added by {item.createdBy} on {day(item.createdAt)}
          {item.updatedAt !== item.createdAt ? `; last changed by ${item.updatedBy} on ${day(item.updatedAt)}` : ""}.
        </p>
      </form>
    </BottomSheet>
  );
}

function MergeSheet({ row, members, onClose, onDone }: { row: Row; members: number; onClose: () => void; onDone: (r: AdminMergeResponse) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 text-lg font-semibold">Merge into {row.name}?</h2>
      <SheetClose />
    </div>
  );
  const footer = (
    <button
      type="button"
      disabled={pending}
      className={`min-h-12 w-full text-base ${buttonClass}`}
      onClick={() =>
        startTransition(async () => {
          const r = await mergeExercise(row.exerciseId);
          if (r.ok) {
            onDone(r.value);
            onClose();
          } else setError(r.error);
        })
      }
    >
      {pending ? "Merging…" : "Merge"}
    </button>
  );
  return (
    <BottomSheet open onClose={onClose} label={`Merge into ${row.name}`} header={header} footer={footer}>
      <div className="flex flex-col gap-3 px-1 text-sm">
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <p>
          {plural(members, "member has", "members have")} their own exercise named &ldquo;{row.name}&rdquo;. Their logged days move onto this one with
          every set kept, and their own copy is removed. A day where they already logged {row.name} is left as it is.
        </p>
      </div>
    </BottomSheet>
  );
}

/** Feature 015: the library grouped by muscle group; built-ins are read-only, catalog rows open an edit sheet. */
export function AdminExercises({ data }: { data: AdminExercisesResponse }) {
  const [editing, setEditing] = useState<CatalogExercise | null>(null);
  const [merging, setMerging] = useState<Row | null>(null);
  const [merged, setMerged] = useState<AdminMergeResponse | null>(null);

  const rows: Row[] = [
    ...data.builtIn.map((b) => ({ exerciseId: b.exerciseId, name: b.name, group: b.group, builtIn: true })),
    ...data.catalog.map((c) => ({ exerciseId: c.exerciseId, name: c.name, group: c.group, builtIn: false, item: c })),
  ];
  const full = data.catalog.length >= data.limit;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="add-h" className="flex flex-col gap-3">
        <h3 id="add-h" className="text-lg font-semibold">
          Add an exercise
        </h3>
        <p className="text-sm text-muted">
          Strength only. Every member can log it. {data.catalog.length} of {data.limit} added
          {full ? " (the library is full)" : ""}.
        </p>
        <AddForm full={full} />
      </section>

      {merged ? (
        <p role="status" className={noticeOkClass}>
          Merged: {plural(merged.members, "member", "members")}, {plural(merged.moved, "day", "days")} moved
          {merged.skipped ? `, ${plural(merged.skipped, "day", "days")} left (already logged)` : ""}, {plural(merged.removed, "own copy", "own copies")} removed.
        </p>
      ) : null}

      {MUSCLE_GROUPS.map((g) => {
        const list = rows.filter((r) => r.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} aria-labelledby={`g-${g}`} className="flex flex-col gap-2">
            <h3 id={`g-${g}`} className="text-lg font-semibold">
              {MUSCLE_GROUP_LABELS[g]}
            </h3>
            <ul className={`divide-y divide-line ${cardClass}`}>
              {list.map((r) => {
                const owners = data.ownMatches[r.exerciseId] ?? 0;
                const retired = r.item?.status === "retired";
                return (
                  <li key={r.exerciseId} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    {r.builtIn ? (
                      <span className="flex min-h-11 flex-1 items-center gap-2 text-ink">
                        <Lock aria-label="Built-in" size={16} strokeWidth={1.75} className="text-faint" />
                        {r.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing(r.item ?? null)}
                        className={`flex min-h-11 flex-1 items-center gap-2 text-left font-medium hover:text-accent ${retired ? "text-faint" : "text-ink"}`}
                      >
                        {r.name}
                        {retired ? <span className={badgeClass}>Retired</span> : null}
                      </button>
                    )}
                    {owners > 0 && !retired ? (
                      <span className="flex items-center gap-3">
                        <span className="text-sm text-muted">{plural(owners, "member has", "members have")} their own</span>
                        <button type="button" onClick={() => setMerging(r)} className={secondaryButtonClass}>
                          Merge
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {editing ? <EditSheet key={editing.exerciseId + editing.updatedAt} item={editing} onClose={() => setEditing(null)} /> : null}
      {merging ? (
        <MergeSheet row={merging} members={data.ownMatches[merging.exerciseId] ?? 0} onClose={() => setMerging(null)} onDone={setMerged} />
      ) : null}
    </div>
  );
}
