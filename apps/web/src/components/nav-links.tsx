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
              className={`flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-150 ${
                active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
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
