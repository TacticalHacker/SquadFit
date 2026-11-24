"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Feature 014: the chart's "7-day trend" toggle, remembered per device (off by default). Storage may be unavailable. */
const KEY = "sf:weighttrend:v1";
const EVENT = "sf:weighttrend-change";
/** This tab's choice, so the toggle works even when storage is blocked. */
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  const onStorage = () => {
    memory = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWeightTrend(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => {
    memory = next;
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Blocked storage: `memory` keeps the choice until reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
