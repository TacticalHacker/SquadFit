"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  // Opens the Gym tab by default; stays highlighted on every /workouts page.
  { href: "/workouts/gym", match: "/workouts", label: "Workouts" },
  { href: "/food", match: "/food", label: "Food" },
  { href: "/people", match: "/people", label: "People" },
  { href: "/settings", match: "/settings", label: "Settings" },
] as const;

/** Tab-style links; scrolls sideways instead of overflowing on narrow screens. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {LINKS.map((l) => {
        const active = pathname === l.match || pathname.startsWith(`${l.match}/`);
        return (
          <li key={l.href} className="shrink-0">
            <Link
              href={l.href}
              {...(active ? { "aria-current": "page" as const } : {})}
              className={`block rounded-full px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
