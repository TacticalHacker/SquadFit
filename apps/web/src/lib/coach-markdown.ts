import { createElement, type ComponentProps } from "react";
import type { Options } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Coach notes come from an external AI client, so they are rendered as markdown with no raw HTML
 * (react-markdown's default), no images, and safe links (research R8).
 */
export const coachMarkdownOptions: Omit<Options, "children"> = {
  remarkPlugins: [remarkGfm], // tables and strikethrough; still no raw HTML
  disallowedElements: ["img"],
  unwrapDisallowed: true,
  components: {
    a: (props: ComponentProps<"a">) =>
      createElement(
        "a",
        { href: props.href, target: "_blank", rel: "noopener noreferrer nofollow", className: "text-lime-300 underline" },
        props.children,
      ),
  },
};
