"use client";

import { Search, X } from "lucide-react";
import { inputClass } from "./form-bits";

/** Compact search across every group (FR-004). 16 px text so iOS never zooms. */
export function ExerciseSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search exercises"
        aria-label="Search exercises"
        enterKeyHint="search"
        autoComplete="off"
        className={`${inputClass} pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-0 right-0 grid min-h-11 min-w-11 touch-manipulation place-items-center rounded-md text-muted hover:text-ink"
        >
          <X aria-hidden size={18} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
