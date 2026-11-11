/** Icon and colour tone per workout. Class names are literal so Tailwind can see them. */
export type Tone = "lime" | "purple" | "cyan" | "teal" | "orange" | "pink" | "amber" | "sky" | "indigo";

export const TONES: Record<Tone, { badge: string; text: string; bar: string }> = {
  lime: { badge: "bg-lime-400/15 shadow-[0_0_14px_-2px] shadow-lime-400/40", text: "text-lime-300", bar: "bg-lime-400" },
  purple: { badge: "bg-purple-400/15 shadow-[0_0_14px_-2px] shadow-purple-400/40", text: "text-purple-300", bar: "bg-purple-400" },
  cyan: { badge: "bg-cyan-400/15 shadow-[0_0_14px_-2px] shadow-cyan-400/40", text: "text-cyan-300", bar: "bg-cyan-400" },
  teal: { badge: "bg-teal-400/15 shadow-[0_0_14px_-2px] shadow-teal-400/40", text: "text-teal-300", bar: "bg-teal-400" },
  orange: { badge: "bg-orange-400/15 shadow-[0_0_14px_-2px] shadow-orange-400/40", text: "text-orange-300", bar: "bg-orange-400" },
  pink: { badge: "bg-pink-400/15 shadow-[0_0_14px_-2px] shadow-pink-400/40", text: "text-pink-300", bar: "bg-pink-400" },
  amber: { badge: "bg-amber-400/15 shadow-[0_0_14px_-2px] shadow-amber-400/40", text: "text-amber-300", bar: "bg-amber-400" },
  sky: { badge: "bg-sky-400/15 shadow-[0_0_14px_-2px] shadow-sky-400/40", text: "text-sky-300", bar: "bg-sky-400" },
  indigo: { badge: "bg-indigo-400/15 shadow-[0_0_14px_-2px] shadow-indigo-400/40", text: "text-indigo-300", bar: "bg-indigo-400" },
};

const STYLE: Record<string, { emoji: string; tone: Tone }> = {
  "std-walking": { emoji: "🚶", tone: "lime" },
  "std-running": { emoji: "🏃", tone: "lime" },
  "std-cycling": { emoji: "🚴", tone: "cyan" },
  "std-swimming": { emoji: "🏊", tone: "sky" },
  "std-yoga": { emoji: "🧘", tone: "teal" },
  "std-strength": { emoji: "🏋️", tone: "purple" },
  "std-hiit": { emoji: "🔥", tone: "orange" },
  "std-jump-rope": { emoji: "🪢", tone: "orange" },
  "std-hiking": { emoji: "🥾", tone: "amber" },
  "std-stretching": { emoji: "🤸", tone: "teal" },
  "std-dancing": { emoji: "💃", tone: "pink" },
  "std-team-sport": { emoji: "⚽", tone: "amber" },
};

export const workoutStyle = (workoutId: string) => STYLE[workoutId] ?? { emoji: "⭐", tone: "indigo" as Tone };

/** One-tap picks at the top of the screen (provisional until a history endpoint can rank by use). */
export const QUICK_PICK_IDS = ["std-walking", "std-running", "std-strength", "std-cycling", "std-yoga"] as const;

export const MINUTE_CHIPS = [15, 30, 45, 60] as const;
