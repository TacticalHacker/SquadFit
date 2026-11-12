"use client";

/** Compact search across every group (FR-004). 16 px text so iOS never zooms. */
export function ExerciseSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search exercises"
        aria-label="Search exercises"
        enterKeyHint="search"
        autoComplete="off"
        className="min-h-11 w-full rounded-xl bg-[#1E293B] py-2 pr-12 pl-10 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-lime-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-0 right-0 grid min-h-11 min-w-11 touch-manipulation place-items-center text-lg text-slate-400"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
