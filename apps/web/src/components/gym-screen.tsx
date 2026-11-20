"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { filterExercises, type GymExerciseView, type GymSaveResult, type GymView, type MuscleGroup } from "@calci/shared";
import { browserStorage, listDraftExerciseIds, pruneDrafts, subscribeDrafts } from "@/lib/gym-draft";
import { hasDayChanged } from "@/lib/rollover";
import { CustomExerciseSheet } from "./custom-exercise-form";
import { ExerciseList } from "./exercise-list";
import { ExerciseSearch } from "./exercise-search";
import { GymDrawer } from "./gym-drawer";
import { noticeWarnClass } from "./form-bits";
import { MusclePills } from "./muscle-pills";

const CHECK_EVERY_MS = 60_000;
const noSubscribe = () => () => {};

/** Gym tab (feature 006): pills + search + list, a drawer per exercise, own-exercise sheet. */
export function GymScreen({ initialView, username, openId: initialOpenId }: { initialView: GymView; username: string; openId: string | null }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [seen, setSeen] = useState(initialView);
  const [group, setGroup] = useState<MuscleGroup>(() => {
    const target = initialView.exercises.find((e) => e.exerciseId === initialOpenId);
    return target?.group ?? "chest";
  });
  const [query, setQuery] = useState("");
  // `?open=<id>` (from the Activities tab) opens that drawer; it renders only after hydration (drafts are browser-only).
  const [openId, setOpenId] = useState<string | null>(() =>
    initialOpenId && initialView.exercises.some((e) => e.exerciseId === initialOpenId) ? initialOpenId : null,
  );
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [sheet, setSheet] = useState<{ editing: GymExerciseView | null } | null>(null);

  // A refresh or navigation delivered a new server view: adopt it.
  if (seen !== initialView) {
    setSeen(initialView);
    setView(initialView);
  }

  const { date, today, timezone, editable } = view;

  // Drafts live in this browser only (FR-023): drop ones whose day is locked, and watch the rest for badges.
  useEffect(() => pruneDrafts(browserStorage(), today), [today]);
  const draftIds = useSyncExternalStore(
    subscribeDrafts,
    () => listDraftExerciseIds(browserStorage(), username, date).sort().join("|"),
    () => "",
  );
  const drafts = useMemo<ReadonlySet<string>>(() => new Set(draftIds ? draftIds.split("|") : []), [draftIds]);

  // Follow local midnight like the Activities tab; an open drawer keeps saving to its own date.
  useEffect(() => {
    const check = () => {
      if (openId === null && hasDayChanged(new Date(), timezone, today)) router.replace("/workouts/gym");
    };
    const id = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, timezone, today, openId]);

  const shown = useMemo(() => filterExercises(view.exercises, group, query), [view.exercises, group, query]);
  const open = hydrated && openId ? (view.exercises.find((e) => e.exerciseId === openId) ?? null) : null;

  const onSaved = useCallback(
    (r: GymSaveResult) => {
      // Keep every `last`; replace this exercise's entry and the day totals with server truth (SC-006).
      setView((v) => ({
        ...v,
        editable: r.editable,
        summary: r.summary,
        exercises: v.exercises.map((e) => (e.exerciseId === r.exerciseId ? { ...e, entry: r.entry } : e)),
      }));
      router.refresh(); // week strip and streak are rendered on the server
    },
    [router],
  );

  const onExerciseSaved = (ex: GymExerciseView) => {
    setView((v) => {
      const exists = v.exercises.some((e) => e.exerciseId === ex.exerciseId);
      const exercises = exists
        ? v.exercises.map((e) => (e.exerciseId === ex.exerciseId ? { ...e, name: ex.name, group: ex.group } : e))
        : [...v.exercises, ex];
      return { ...v, exercises };
    });
    setQuery("");
    setGroup(ex.group);
  };

  const onExerciseRemoved = (id: string) => {
    // Keep it on a day it was logged (its entry stays); otherwise it disappears from the list.
    setView((v) => ({ ...v, exercises: v.exercises.filter((e) => e.exerciseId !== id || e.entry !== null) }));
  };

  return (
    <div className="flex flex-col gap-3 overflow-x-clip">
      <p className="text-sm text-muted">
        {date === today ? "Today" : "This day"}: <span className="font-semibold text-ink">{view.summary.totalMinutes} min</span> ·{" "}
        <span className="font-semibold text-ink">{view.summary.totalCalories} kcal</span> burned
      </p>
      {!editable ? (
        <p role="status" className={noticeWarnClass}>
          This day can no longer be edited
        </p>
      ) : null}

      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-1 border-b border-line bg-paper px-4 pt-2">
        <ExerciseSearch value={query} onChange={setQuery} />
        <MusclePills
          value={group}
          dimmed={query.trim() !== ""}
          onChange={(g) => {
            setGroup(g);
            setQuery("");
          }}
        />
      </div>

      <ExerciseList
        exercises={shown}
        drafts={drafts}
        showGroup={query.trim() !== ""}
        canAdd={editable}
        onOpen={setOpenId}
        onEdit={(id) => setSheet({ editing: view.exercises.find((e) => e.exerciseId === id) ?? null })}
        onAddCustom={() => setSheet({ editing: null })}
      />

      {open ? (
        <GymDrawer
          key={`${date}:${open.exerciseId}`}
          exercise={open}
          date={date}
          editable={editable}
          username={username}
          bodyWeightKg={view.bodyWeightKg}
          onClose={() => setOpenId(null)}
          onSaved={onSaved}
        />
      ) : null}

      {sheet ? (
        <CustomExerciseSheet
          editing={sheet.editing}
          defaultGroup={group}
          onClose={() => setSheet(null)}
          onSaved={onExerciseSaved}
          onRemoved={onExerciseRemoved}
        />
      ) : null}
    </div>
  );
}
