"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  CATALOG_GROUPS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  exerciseNameKey,
  type AdminExercisesResponse,
  type AdminMergeResponse,
  type CatalogExercise,
  type CatalogGroup,
  type MuscleGroup,
} from "@calci/shared";
import { addExercise, mergeExercise, updateExercise } from "@/server/actions/admin";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { ExerciseSearch } from "./exercise-search";
import { badgeClass, buttonClass, cardClass, chipClass, iconButtonClass, inputClass, noticeErrorClass, noticeOkClass, noticeWarnClass, secondaryButtonClass } from "./form-bits";

type Row = { exerciseId: string; name: string; group: MuscleGroup; builtIn: boolean; item?: CatalogExercise };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** The submit button must still read as a button while disabled (not faded green text). */
export const submitClass = `min-h-12 w-full text-base ${buttonClass} disabled:border disabled:border-line-strong disabled:bg-surface-2 disabled:text-muted disabled:opacity-100`;

/** High-contrast selection: solid ink fill, so the chosen group can't be missed. */
const groupChipClass = (selected: boolean) =>
  selected
    ? "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-ink bg-ink px-4 text-sm font-medium text-paper"
    : chipClass(false);

export function GroupPicker({ value, onChange }: { value: CatalogGroup | null; onChange: (g: CatalogGroup) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Muscle group</legend>
      <div className="flex flex-wrap gap-2">
        {CATALOG_GROUPS.map((g) => (
          <button key={g} type="button" aria-pressed={g === value} onClick={() => onChange(g)} className={groupChipClass(g === value)}>
            {MUSCLE_GROUP_LABELS[g]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Cardio can&apos;t be added: cardio needs a calorie rate, so only the built-in ones exist.</p>
    </fieldset>
  );
}

/** Name → where it already lives, for the inline duplicate warning (same matching as the server). */
function useNameIndex(rows: readonly Row[]) {
  return useMemo(() => new Map(rows.map((r) => [exerciseNameKey(r.name), r])), [rows]);
}

function duplicateText(hit: Row | undefined, selfId?: string): string | null {
  if (!hit || hit.exerciseId === selfId) return null;
  const where = MUSCLE_GROUP_LABELS[hit.group];
  if (hit.item?.status === "retired") return `Already exists in ${where} (retired). Restore it instead.`;
  return `Already exists in ${where}${hit.builtIn ? " (built-in)" : ""}`;
}

function AddSheet({ rows, onClose, onAdded }: { rows: readonly Row[]; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<CatalogGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const index = useNameIndex(rows);
  const clean = name.trim().replace(/\s+/g, " ");
  const duplicate = clean ? duplicateText(index.get(exerciseNameKey(clean))) : null;
  const ready = clean.length > 0 && group !== null && !duplicate;

  const submit = () => {
    if (!ready || !group) return;
    setError(null);
    startTransition(async () => {
      const r = await addExercise({ name: clean, group });
      if (r.ok) {
        onAdded(clean);
        onClose();
      } else setError(r.error);
    });
  };

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 text-lg font-semibold">Add exercise</h2>
      <SheetClose />
    </div>
  );
  const footer = (
    <button type="submit" form="admin-add-exercise" disabled={pending || !ready} className={submitClass}>
      {pending ? "Adding…" : "Add exercise"}
    </button>
  );

  return (
    <BottomSheet open onClose={onClose} label="Add exercise" header={header} footer={footer}>
      <form
        id="admin-add-exercise"
        className="flex flex-col gap-4 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            autoComplete="off"
            aria-invalid={duplicate ? true : undefined}
            aria-describedby="add-name-dup"
            className={`font-normal ${inputClass}`}
          />
          <span id="add-name-dup" aria-live="polite" className="text-xs font-normal text-warning">
            {duplicate}
          </span>
        </label>
        <GroupPicker value={group} onChange={setGroup} />
        <p className="text-xs text-muted">Strength only. Every member can log it within a few minutes.</p>
      </form>
    </BottomSheet>
  );
}

function EditSheet({ item, rows, onClose }: { item: CatalogExercise; rows: readonly Row[]; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [group, setGroup] = useState<CatalogGroup>(item.group);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const index = useNameIndex(rows);
  const retired = item.status === "retired";
  const clean = name.trim().replace(/\s+/g, " ");
  const duplicate = clean ? duplicateText(index.get(exerciseNameKey(clean)), item.exerciseId) : null;

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
    if (clean !== item.name) patch.name = clean;
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
      <button type="submit" form="admin-exercise" disabled={pending || !clean || Boolean(duplicate)} className={submitClass}>
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            autoComplete="off"
            aria-invalid={duplicate ? true : undefined}
            aria-describedby="edit-name-dup"
            className={`font-normal ${inputClass}`}
          />
          <span id="edit-name-dup" aria-live="polite" className="text-xs font-normal text-warning">
            {duplicate}
          </span>
        </label>
        <GroupPicker value={group} onChange={setGroup} />
        <p className="text-sm text-muted">
          Exercises are retired, never deleted, so members&apos; logged days stay intact.
          {retired ? " Retired: hidden from the picker and the AI." : ""}
        </p>
        <p className="text-sm text-muted">
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
      className={submitClass}
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

type Filter = "all" | MuscleGroup;

/** Feature 015: searchable library; built-ins are read-only, custom rows open an edit sheet; adding is a sheet. */
export function AdminExercises({ data }: { data: AdminExercisesResponse }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogExercise | null>(null);
  const [merging, setMerging] = useState<Row | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows: Row[] = useMemo(
    () => [
      ...data.builtIn.map((b) => ({ exerciseId: b.exerciseId, name: b.name, group: b.group, builtIn: true })),
      ...data.catalog.map((c) => ({ exerciseId: c.exerciseId, name: c.name, group: c.group, builtIn: false, item: c })),
    ],
    [data],
  );
  const full = data.catalog.length >= data.limit;
  const q = exerciseNameKey(query);
  const visible = rows.filter((r) => (filter === "all" || r.group === filter) && (!q || exerciseNameKey(r.name).includes(q)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Exercise library</h2>
          <p className="text-sm text-muted">
            {data.builtIn.length} built-in · {data.catalog.length} of {data.limit} custom exercises added
          </p>
        </div>
        <button type="button" onClick={() => setAdding(true)} disabled={full} className={buttonClass}>
          <Plus aria-hidden size={18} strokeWidth={1.75} />
          Add exercise
        </button>
      </div>
      {full ? <p className={noticeWarnClass}>The library is full ({data.limit} custom exercises). Retired ones still count.</p> : null}
      {notice ? (
        <p role="status" className={noticeOkClass}>
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <ExerciseSearch value={query} onChange={setQuery} />
        <div role="group" aria-label="Filter by muscle group" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {(["all", ...MUSCLE_GROUPS] as const).map((g) => (
            <button key={g} type="button" aria-pressed={filter === g} onClick={() => setFilter(g)} className={chipClass(filter === g)}>
              {g === "all" ? "All" : MUSCLE_GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? <p className="text-sm text-muted">No exercises match.</p> : null}

      {MUSCLE_GROUPS.map((g) => {
        const list = visible.filter((r) => r.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} aria-labelledby={`g-${g}`} className="flex flex-col gap-2">
            <h3 id={`g-${g}`} className="text-sm font-semibold tracking-wide text-muted uppercase">
              {MUSCLE_GROUP_LABELS[g]} · {list.length}
            </h3>
            {g === "cardio" ? <p className="text-xs text-muted">Built-in only: new exercises are strength.</p> : null}
            <ul className={`divide-y divide-line ${cardClass}`}>
              {list.map((r) => {
                const owners = data.ownMatches[r.exerciseId] ?? 0;
                const retired = r.item?.status === "retired";
                return (
                  <li key={r.exerciseId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
                    <span className={`flex min-h-11 flex-1 items-center gap-2 ${retired ? "text-faint" : "text-ink"}`}>
                      {r.name}
                      {retired ? <span className={badgeClass}>Retired</span> : null}
                    </span>
                    {owners > 0 && !retired ? (
                      <span className="flex items-center gap-3">
                        <span className="text-sm text-muted">{plural(owners, "member has", "members have")} their own</span>
                        <button type="button" onClick={() => setMerging(r)} className={secondaryButtonClass}>
                          Merge
                        </button>
                      </span>
                    ) : null}
                    {r.builtIn ? (
                      <span className={badgeClass}>Built-in</span>
                    ) : (
                      <button type="button" onClick={() => setEditing(r.item ?? null)} aria-label={`Edit ${r.name}`} className={iconButtonClass}>
                        <Pencil aria-hidden size={16} strokeWidth={1.75} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {adding ? <AddSheet rows={rows} onClose={() => setAdding(false)} onAdded={(name) => setNotice(`Added ${name}. Members see it within a few minutes.`)} /> : null}
      {editing ? <EditSheet key={editing.exerciseId + editing.updatedAt} item={editing} rows={rows} onClose={() => setEditing(null)} /> : null}
      {merging ? (
        <MergeSheet
          row={merging}
          members={data.ownMatches[merging.exerciseId] ?? 0}
          onClose={() => setMerging(null)}
          onDone={(m) =>
            setNotice(
              `Merged: ${plural(m.members, "member", "members")}, ${plural(m.moved, "day", "days")} moved${m.skipped ? `, ${plural(m.skipped, "day", "days")} left (already logged)` : ""}, ${plural(m.removed, "own copy", "own copies")} removed.`,
            )
          }
        />
      ) : null}
    </div>
  );
}
