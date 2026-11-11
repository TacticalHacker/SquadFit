import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { describe, expect, it } from "vitest";
import { coachMarkdownOptions } from "./coach-markdown";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, coachMarkdownOptions, md));

describe("coach note markdown", () => {
  it("renders formatting", () => {
    expect(render("**Solid** day\n\n- a\n- b")).toMatch(/<strong>Solid<\/strong>/);
    expect(render("- a\n- b")).toContain("<li>");
  });

  it("shows raw HTML as inert escaped text, never as live tags", () => {
    const html = render('<script>alert(1)</script><img src=x onerror="alert(1)"><b onclick="x()">hi</b>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<b[ >]/i);
    expect(html).not.toMatch(/<[a-z][^>]*\son(error|click)=/i); // no attribute inside a real tag
  });

  it("drops markdown images and javascript: links", () => {
    expect(render("![x](https://evil/x.png)")).not.toContain("<img");
    expect(render("[click](javascript:alert(1))")).not.toMatch(/href="javascript:/i);
  });

  it("renders tables", () => {
    const html = render("| Meal | kcal |\n|---|---|\n| Lunch | 300 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>300</td>");
  });

  it("opens links safely in a new tab", () => {
    const html = render("[site](https://example.com)");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });
});
