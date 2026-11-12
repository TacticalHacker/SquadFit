import { EDIT_WINDOW_DAYS, GymDraftSchema, addDays, type DrawerState, type GymDraft } from "@calci/shared";

/**
 * Unsaved gym drawer values, kept only in this browser (FR-023, research R8). One per member, day and exercise.
 * Never sent to the server. Every storage call is guarded: private mode or a full quota just turns drafts off.
 */
const PREFIX = "sf:gymdraft:v1:";

const CHANGE_EVENT = "sf:gymdraft-change";

/** Tell subscribers in this tab that drafts changed (other tabs get the native `storage` event). */
function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: re-read drafts when they change in this tab or another. */
export function subscribeDrafts(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const draftKey = (username: string, date: string, exerciseId: string) => `${PREFIX}${username}:${date}:${exerciseId}`;

/** The browser's localStorage, or null where it is unavailable (server render, blocked storage). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function keys(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(PREFIX)) out.push(k);
  }
  return out;
}

export function loadDraft(storage: Storage | null, username: string, date: string, exerciseId: string): GymDraft | null {
  if (!storage) return null;
  const key = draftKey(username, date, exerciseId);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = GymDraftSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through: corrupt JSON or blocked storage
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
  return null;
}

export function saveDraft(
  storage: Storage | null,
  username: string,
  date: string,
  exerciseId: string,
  state: DrawerState,
  baseUpdatedAt: string | null,
  nowIso: string,
): void {
  if (!storage) return;
  const draft: GymDraft = { v: 1, savedAt: nowIso, baseUpdatedAt, state };
  try {
    storage.setItem(draftKey(username, date, exerciseId), JSON.stringify(draft));
    notify();
  } catch {
    // quota or private mode: drafts are best-effort
  }
}

export function clearDraft(storage: Storage | null, username: string, date: string, exerciseId: string): void {
  try {
    storage?.removeItem(draftKey(username, date, exerciseId));
    notify();
  } catch {
    // ignore
  }
}

export function listDraftExerciseIds(storage: Storage | null, username: string, date: string): string[] {
  if (!storage) return [];
  const prefix = `${PREFIX}${username}:${date}:`;
  try {
    return keys(storage)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  } catch {
    return [];
  }
}

/** Drops every draft (any member on this device) whose day can no longer be edited. */
export function pruneDrafts(storage: Storage | null, today: string): void {
  if (!storage) return;
  const oldest = addDays(today, -EDIT_WINDOW_DAYS);
  try {
    for (const k of keys(storage)) {
      const date = k.slice(PREFIX.length).split(":")[1] ?? "";
      if (date < oldest) storage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
