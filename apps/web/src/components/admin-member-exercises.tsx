"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CornerDownRight, Globe } from "lucide-react";
import { MUSCLE_GROUP_LABELS, exerciseNameKey, type AdminExercisesResponse, type CatalogGroup, type MuscleGroup } from "@calci/shared";
import { mergeMemberExercise, promoteExercise } from "@/server/actions/admin";
import { GroupPicker, submitClass } from "./admin-exercises";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import { ExerciseSearch } from "./exercise-search";
import { buttonClass, cardClass, linkClass, noticeErrorClass, noticeOkClass, noticeWarnClass, secondaryButtonClass } from "./form-bits";

type Item = AdminExercisesResponse["memberExercises"][number];
type Target = { exerciseId: string; name: string; group: MuscleGroup };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const impact = (it: Item) => `${plural(it.days, "logged day", "logged days")} from ${plural(it.members, "member", "members")}`;

function PromoteSheet({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: (text: string) => void }) {
  const [group, setGroup] = useState<CatalogGroup>(item.group);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 truncate text-lg font-semibold">Add &ldquo;{item.name}&rdquo; to the library?</h2>
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
          onDone(`${item.name} is now in the library. ${plural(m.moved, "day", "days")} moved, ${plural(m.removed, "own copy", "own copies")} removed.`);
          onClose();
        })
      }
    >
      {pending ? "Adding…" : "Add to library"}
    </button>
  );

  return (
    <BottomSheet open onClose={onClose} label={`Add ${item.name} to the library`} header={header} footer={footer}>
      <div className="flex flex-col gap-4 px-1 text-sm">
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        <p>
          Every member will see {item.name} in the gym picker. {impact(item)} move onto it with every set kept, and the own copies are removed.
        </p>
        <GroupPicker value={group} onChange={setGroup} />
        <p className="text-xs text-muted">The name stays as it is so every copy matches. You can rename it in the library afterwards.</p>
      </div>
    </BottomSheet>
  );
}

/** "Merge into…": pick a library exercise (search is focused; Enter takes the first result), then confirm direction and impact. */
function MergeSheet({
  item,
  library,
  initial,
  onClose,
  onDone,
}: {
  item: Item;
  library: readonly Target[];
  initial: Target | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [target, setTarget] = useState<Target | null>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLDivElement>(null);

  const q = exerciseNameKey(query);
  const results = library.filter((e) => !q || exerciseNameKey(e.name).includes(q)).slice(0, 30);

  // Focus the search once the sheet is up (the dialog focuses its first button on open).
  useEffect(() => {
    if (target) return;
    const id = requestAnimationFrame(() => searchRef.current?.querySelector("input")?.focus());
    return () => cancelAnimationFrame(id);
  }, [target]);

  const header = (
    <div className="flex items-center gap-3">
      <h2 className="flex-1 truncate text-lg font-semibold">{target ? "Confirm merge" : `Merge “${item.name}” into…`}</h2>
      <SheetClose />
    </div>
  );
  const footer = target ? (
    <button
      type="button"
      disabled={pending}
      className={submitClass}
      onClick={() =>
        startTransition(async () => {
          const r = await mergeMemberExercise(target.exerciseId, item.name);
          if (!r.ok) return setError(r.error);
          const m = r.value;
          onDone(
            `${item.name} → ${target.name}: ${plural(m.moved, "day", "days")} moved, ${plural(m.removed, "own copy", "own copies")} removed${m.skipped ? `, ${plural(m.skipped, "day", "days")} left (already logged ${target.name} that day)` : ""}.`,
          );
          onClose();
        })
      }
    >
      {pending ? "Merging…" : "Merge"}
    </button>
  ) : undefined;

  return (
    <BottomSheet open onClose={onClose} label={`Merge ${item.name}`} header={header} footer={footer}>
      <div className="flex flex-col gap-4 px-1 text-sm">
        <div role="alert">{error ? <p className={noticeErrorClass}>{error}</p> : null}</div>
        {target ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-base">
              <span className="font-medium">&ldquo;{item.name}&rdquo;</span>
              <ArrowRight aria-label="into" size={18} strokeWidth={1.75} className="text-accent" />
              <span className="font-semibold">{target.name}</span>
              <span className="text-muted">({MUSCLE_GROUP_LABELS[target.group]})</span>
            </p>
            <p>
              {impact(item)} will move to {target.name}, with every set kept. {item.name} stops existing as an own exercise. {target.name} stays as
              it is.
            </p>
            <button type="button" onClick={() => setTarget(null)} className={`self-start ${linkClass}`}>
              Choose a different exercise
            </button>
          </>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (results[0]) setTarget(results[0]);
            }}
          >
            <div ref={searchRef}>
              <ExerciseSearch value={query} onChange={setQuery} />
            </div>
            {results.length === 0 ? <p className="text-muted">No library exercise matches.</p> : null}
            <ul className={`divide-y divide-line ${cardClass}`}>
              {results.map((e) => (
                <li key={e.exerciseId}>
                  <button type="button" onClick={() => setTarget(e)} className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left hover:bg-surface-2 active:bg-line">
                    <span className="flex-1 text-ink">{e.name}</span>
                    <span className="text-xs text-muted">{MUSCLE_GROUP_LABELS[e.group]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}

/** Feature 015 Story 6: members' own exercises not in the library, with a likely match to merge or Add to library. Counts only, never who. */
export function AdminMemberExercises({ items, library, full }: { items: readonly Item[]; library: readonly Target[]; full: boolean }) {
  const [promoting, setPromoting] = useState<Item | null>(null);
  const [merging, setMerging] = useState<{ item: Item; target: Target | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Likely duplicates first: most of them are a single tap.
  const sorted = [...items].sort((a, b) => Number(Boolean(b.suggestion)) - Number(Boolean(a.suggestion)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Member-made exercises · {items.length} to review</h2>
        <p className="text-sm text-muted">
          Merge a duplicate into the library exercise it copies, or add a genuinely new one to the library. Copies with the same name are counted
          together; who made them is never shown.
        </p>
      </div>
      {notice ? (
        <p role="status" className={noticeOkClass}>
          {notice}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing to review: every member exercise is in the library.</p>
      ) : (
        <ul className={`divide-y divide-line ${cardClass}`}>
          {sorted.map((it) => (
            <li key={it.name} className="flex flex-col gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-ink">&ldquo;{it.name}&rdquo;</p>
                <p className="text-sm text-muted">
                  {MUSCLE_GROUP_LABELS[it.group]} · {plural(it.days, "day", "days")} logged · {plural(it.members, "member", "members")}
                </p>
              </div>
              {it.suggestion ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-2 px-3 py-2">
                  <CornerDownRight aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
                  <span className="min-w-0 flex-1 text-sm">
                    Suggested match: <span className="font-medium text-ink">{it.suggestion.name}</span>{" "}
                    <span className="text-muted">({MUSCLE_GROUP_LABELS[it.suggestion.group]})</span>
                  </span>
                  <button type="button" onClick={() => setMerging({ item: it, target: it.suggestion })} className={buttonClass}>
                    Merge
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMerging({ item: it, target: null })} className={secondaryButtonClass}>
                  {it.suggestion ? "Other…" : "Merge into…"}
                </button>
                <button type="button" disabled={full} onClick={() => setPromoting(it)} className={secondaryButtonClass}>
                  <Globe aria-hidden size={16} strokeWidth={1.75} />
                  Add to library
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {full ? <p className={noticeWarnClass}>The library is full, so nothing can be added right now. Merging still works.</p> : null}

      {promoting ? <PromoteSheet item={promoting} onClose={() => setPromoting(null)} onDone={setNotice} /> : null}
      {merging ? (
        <MergeSheet item={merging.item} library={library} initial={merging.target} onClose={() => setMerging(null)} onDone={setNotice} />
      ) : null}
    </div>
  );
}
