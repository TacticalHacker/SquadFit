import Link from "next/link";
import { segmentClass, segmentGroupClass } from "./form-bits";

/**
 * Segmented control made of links that only change the query string (feature 013). The selected option is a plain
 * label, not a link: it looks the same as any selected segment, and because the link the member clicked is replaced
 * it can't keep a focus ring. Keyboard focus still shows the global :focus-visible ring on the other options.
 */
export function SegmentLinks({ label, options }: { label: string; options: readonly { label: string; href: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className={`${segmentGroupClass} grid-cols-2`}>
      {options.map((o) =>
        o.current ? (
          <span key={o.label} aria-current="page" className={`min-h-11 ${segmentClass(true)}`}>
            {o.label}
          </span>
        ) : (
          <Link key={o.label} href={o.href} className={`min-h-11 ${segmentClass(false)}`}>
            {o.label}
          </Link>
        ),
      )}
    </nav>
  );
}
