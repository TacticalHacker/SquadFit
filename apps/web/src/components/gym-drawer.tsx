"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  GYM_MAX_REPS,
  GYM_MAX_SETS,
  GYM_MAX_WEIGHT,
  MUSCLE_GROUP_LABELS,
  drawerReducer,
  drawerToBody,
  drawerTotals,
  formatLast,
  formatWeight,
  initDrawer,
  type DrawerAction,
  type DrawerState,
  type GymExerciseView,
  type GymSaveResult,
} from "@calci/shared";
import { browserStorage, clearDraft, loadDraft, saveDraft } from "@/lib/gym-draft";
import { removeGymEntry, saveGymEntry } from "@/server/actions/gym";
import { BottomSheet } from "./bottom-sheet";
import { NumberField, Stepper, stepButtonClass } from "./stepper";

const DRAFT_DEBOUNCE_MS = 300;
const nf = new Intl.NumberFormat("en");

function freshState(exercise: GymExerciseView): DrawerState {
  return initDrawer({ exercise, entry: exercise.entry, last: exercise.entry ? null : exercise.last });
}

/**
 * One exercise on one day (US1, US2, US4). Values change locally; nothing reaches the server until Save.
 * Unsaved changes are kept as an on-device draft (FR-023). Totals in the footer use the same shared
 * functions the server uses to store them (FR-013, FR-014).
 */
export function GymDrawer({
  exercise,
  date,
  editable,
  username,
  onClose,
  onSaved,
}: {
  exercise: GymExerciseView;
  date: string;
  editable: boolean;
  username: string;
  onClose: () => void;
  onSaved: (result: GymSaveResult) => void;
}) {
  const id = exercise.exerciseId;
  // Read the draft once, on the client (the drawer is only ever mounted after a tap or after hydration).
  const [initialDraft] = useState(() => loadDraft(browserStorage(), username, date, id));
  const [state, setState] = useState<DrawerState>(() => initialDraft?.state ?? freshState(exercise));
  const [hasDraft, setHasDraft] = useState(initialDraft !== null);
  const [locked, setLocked] = useState(!editable);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseUpdatedAt = useRef<string | null>(initialDraft ? initialDraft.baseUpdatedAt : (exercise.entry?.updatedAt ?? null));

  const dispatch = (action: DrawerAction) => {
    if (locked) return;
    setState((s) => drawerReducer(s, action));
  };

  // Persist unsaved changes on the device, debounced (FR-023).
  useEffect(() => {
    if (locked || !state.dirty) return;
    const t = setTimeout(() => {
      saveDraft(browserStorage(), username, date, id, state, baseUpdatedAt.current, new Date().toISOString());
      setHasDraft(true);
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, locked, username, date, id]);

  const dropDraft = () => {
    clearDraft(browserStorage(), username, date, id);
    setHasDraft(false);
  };

  const discard = () => {
    dropDraft();
    baseUpdatedAt.current = exercise.entry?.updatedAt ?? null;
    setState(freshState(exercise));
    setError(null);
  };

  const finish = (call: () => ReturnType<typeof saveGymEntry>) => {
    setError(null);
    startTransition(async () => {
      const r = await call();
      if (r.ok) {
        dropDraft();
        onSaved(r.result);
        onClose();
        return;
      }
      if (r.code === "DAY_LOCKED") setLocked(true);
      setError(r.error);
    });
  };

  // Closing keeps unsaved values as a draft right away, without waiting for the debounce (FR-023).
  const close = () => {
    if (!locked && state.dirty) {
      saveDraft(browserStorage(), username, date, id, state, baseUpdatedAt.current, new Date().toISOString());
    }
    onClose();
  };

  const save = () => finish(() => saveGymEntry(date, id, drawerToBody(state)));
  const remove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    finish(() => removeGymEntry(date, id));
  };

  const totals = drawerTotals(state, exercise);
  const savedElsewhere =
    hasDraft && exercise.entry !== null && initialDraft !== null && initialDraft.baseUpdatedAt !== exercise.entry.updatedAt;
  const lastTop = exercise.last?.top;

  const header = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold">{exercise.name}</h2>
        <p className="text-xs text-slate-400">
          {MUSCLE_GROUP_LABELS[exercise.group]}
          {lastTop ? <span className="ml-2 font-semibold text-lime-300">{formatLast(lastTop)}</span> : null}
          {exercise.kind === "cardio" && exercise.last ? (
            <span className="ml-2 font-semibold text-lime-300">Last: {exercise.last.minutes} min</span>
          ) : null}
        </p>
      </div>
      <button type="button" onClick={close} aria-label="Close" className={stepButtonClass}>
        ×
      </button>
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-2">
      <p className="text-center text-sm text-slate-300 tabular-nums" aria-live="polite">
        {totals.volumeKg !== null ? (
          <>
            <span className="font-semibold text-slate-100">{nf.format(totals.volumeKg)} kg</span> volume ·{" "}
          </>
        ) : null}
        ~{totals.minutes} min · ~{totals.calories} kcal
      </p>
      {locked ? (
        <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm text-amber-200">This day can no longer be edited</p>
      ) : (
        <>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="min-h-12 w-full touch-manipulation rounded-xl bg-lime-400 text-base font-bold text-slate-900 transition active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
          >
            {pending ? "Saving…" : exercise.entry ? "Save changes" : "Save"}
          </button>
          {exercise.entry ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="min-h-11 touch-manipulation text-sm text-red-300 underline focus-visible:outline-2 focus-visible:outline-lime-400"
            >
              {confirmRemove ? "Tap again to remove from this day" : "Remove from this day"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <BottomSheet open onClose={close} label={`${exercise.name} sets`} header={header} footer={footer}>
      <div className="flex flex-col gap-3">
        {hasDraft && !locked ? (
          <div className="flex items-center gap-2 rounded-xl bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
            <span className="flex-1">
              Unsaved draft{savedElsewhere ? " · a saved version also exists" : ""}
            </span>
            <button type="button" onClick={discard} className="min-h-11 touch-manipulation px-2 font-semibold underline">
              Discard draft
            </button>
          </div>
        ) : null}

        <div role="alert" aria-live="assertive">
          {error ? <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        </div>

        {state.mode === "cardio" ? (
          <CardioBody state={state} disabled={locked} dispatch={dispatch} onError={setError} name={exercise.name} />
        ) : (
          <StrengthBody state={state} disabled={locked} dispatch={dispatch} onError={setError} />
        )}
      </div>
    </BottomSheet>
  );
}

function StrengthBody({
  state,
  disabled,
  dispatch,
  onError,
}: {
  state: DrawerState;
  disabled: boolean;
  dispatch: (a: DrawerAction) => void;
  onError: (m: string | null) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center rounded-xl bg-[#1E293B] py-2">
          <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Sets</span>
          <Stepper
            label="sets"
            onDec={() => dispatch({ type: "removeSet" })}
            onInc={() => dispatch({ type: "addSet" })}
            decDisabled={disabled || state.rows.length <= 1}
            incDisabled={disabled || state.rows.length >= GYM_MAX_SETS}
          >
            <span className="w-10 text-center text-lg font-bold tabular-nums" aria-live="polite">
              {state.rows.length}
            </span>
          </Stepper>
        </div>
        <div className="flex flex-col items-center rounded-xl bg-[#1E293B] py-2">
          <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Default reps</span>
          <Stepper
            label="default reps"
            onDec={() => dispatch({ type: "defaultReps", delta: -1 })}
            onInc={() => dispatch({ type: "defaultReps", delta: 1 })}
            decDisabled={disabled || state.defaultReps <= 1}
            incDisabled={disabled || state.defaultReps >= GYM_MAX_REPS}
          >
            <NumberField
              value={state.defaultReps}
              display={String(state.defaultReps)}
              field="reps"
              label="Default reps"
              widthClass="w-10"
              disabled={disabled}
              onCommit={(value) => dispatch({ type: "setDefaultReps", value })}
              onError={onError}
            />
          </Stepper>
        </div>
      </div>

      <div className="flex items-center gap-1 px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        <span className="w-6">#</span>
        <span className="flex-1 text-center">kg</span>
        <span className="flex-1 text-center">Reps</span>
        <span className="w-11 text-center">Done</span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {state.rows.map((row, i) => {
          const n = i + 1;
          return (
            <li
              key={i}
              className={`flex items-center gap-1 rounded-xl px-1 py-1 transition-colors motion-reduce:transition-none ${
                row.completed ? "bg-lime-400/10 ring-1 ring-lime-400/40" : "bg-[#1E293B]"
              }`}
            >
              <span className="w-6 text-center text-sm font-semibold text-slate-400 tabular-nums">#{n}</span>
              <div className="flex flex-1 justify-center">
                <Stepper
                  label={`set ${n} weight`}
                  onDec={() => dispatch({ type: "weight", index: i, delta: -1 })}
                  onInc={() => dispatch({ type: "weight", index: i, delta: 1 })}
                  decDisabled={disabled || row.weightKg <= 0}
                  incDisabled={disabled || row.weightKg >= GYM_MAX_WEIGHT}
                >
                  <NumberField
                    value={row.weightKg}
                    display={formatWeight(row.weightKg)}
                    field="weight"
                    label={`Set ${n} weight in kg`}
                    widthClass="w-12"
                    disabled={disabled}
                    onCommit={(value) => dispatch({ type: "setWeight", index: i, value })}
                    onError={onError}
                  />
                </Stepper>
              </div>
              <div className="flex flex-1 justify-center">
                <Stepper
                  label={`set ${n} reps`}
                  onDec={() => dispatch({ type: "reps", index: i, delta: -1 })}
                  onInc={() => dispatch({ type: "reps", index: i, delta: 1 })}
                  decDisabled={disabled || row.reps <= 1}
                  incDisabled={disabled || row.reps >= GYM_MAX_REPS}
                >
                  <NumberField
                    value={row.reps}
                    display={String(row.reps)}
                    field="reps"
                    label={`Set ${n} reps`}
                    widthClass="w-9"
                    disabled={disabled}
                    onCommit={(value) => dispatch({ type: "setReps", index: i, value })}
                    onError={onError}
                  />
                </Stepper>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => dispatch({ type: "toggleDone", index: i })}
                aria-pressed={row.completed}
                aria-label={`Set ${n} done`}
                className={`grid min-h-11 min-w-11 touch-manipulation place-items-center rounded-full text-lg font-bold transition active:scale-90 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-lime-400 ${
                  row.completed ? "bg-lime-400 text-slate-900" : "bg-white/10 text-slate-500"
                }`}
              >
                ✓
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function CardioBody({
  state,
  disabled,
  dispatch,
  onError,
  name,
}: {
  state: DrawerState;
  disabled: boolean;
  dispatch: (a: DrawerAction) => void;
  onError: (m: string | null) => void;
  name: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-[#1E293B] py-4">
      <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Minutes</span>
      <Stepper
        label={`${name} minutes by 5`}
        onDec={() => dispatch({ type: "minutes", delta: -1 })}
        onInc={() => dispatch({ type: "minutes", delta: 1 })}
        decDisabled={disabled || state.minutes <= 1}
        incDisabled={disabled || state.minutes >= 600}
      >
        <NumberField
          value={state.minutes}
          display={String(state.minutes)}
          field="minutes"
          label={`${name} minutes`}
          widthClass="w-16"
          disabled={disabled}
          onCommit={(value) => dispatch({ type: "setMinutes", value })}
          onError={onError}
        />
      </Stepper>
    </div>
  );
}
