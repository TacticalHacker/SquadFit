import type { ShareSummary } from "@calci/shared";
import { coverScale, type LoadedPhoto, type PhotoTransform } from "./share-photo";
import {
  NEW_PB,
  SHARE_SITE,
  exercisesCount,
  liftsImproved,
  minutes,
  moreRows,
  shareDate,
  sharePrValue,
  shareRowValue,
  shareStreak,
  stepsCount,
} from "./plain";

/**
 * Feature 016: draws the 1080 × 1920 story image on a canvas, in the browser only. One layout routine (a stack of
 * measured blocks) serves all three templates; the templates differ only in background, colours and where the stack sits.
 * Instagram covers the top ~250 px and bottom ~340 px with its own UI, so nothing is drawn there except backgrounds.
 */

export const SHARE_W = 1080;
export const SHARE_H = 1920;
const SAFE_TOP = 250;
const SAFE_BOTTOM = SHARE_H - 340;

export type ShareTemplate = "card" | "photo" | "sticker";
export interface ShareOptions {
  exercises: boolean;
  prs: boolean;
  streak: boolean;
  duration: boolean;
  improved: boolean;
  steps: boolean;
}
export const DEFAULT_SHARE_OPTIONS: ShareOptions = { exercises: true, prs: true, streak: true, duration: true, improved: true, steps: false };

/** The site's dark tokens (globals.css, prefers-color-scheme: dark). The Card is always dark; canvas can't read CSS variables per theme. */
const DARK = { bg: "#1a1917", surface: "#23221f", border: "#35332e", text: "#ece9e2", muted: "#a8a49a", accent: "#79c09c" };

interface Palette {
  text: string;
  muted: string;
  accent: string;
  line: string;
  shadow: boolean;
}
const PALETTE: Record<ShareTemplate, Palette> = {
  card: { text: DARK.text, muted: DARK.muted, accent: DARK.accent, line: DARK.border, shadow: false },
  photo: { text: "#ffffff", muted: "rgba(255,255,255,0.74)", accent: DARK.accent, line: "rgba(255,255,255,0.22)", shadow: false },
  sticker: { text: "#ffffff", muted: "rgba(255,255,255,0.85)", accent: DARK.accent, line: "rgba(255,255,255,0.45)", shadow: true },
};

// ---------------------------------------------------------------- fonts

export interface ShareFonts {
  sans: string;
  mono: string;
}
const FALLBACK: ShareFonts = { sans: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace" };

/** The real family names next/font registered (hashed), loaded in every weight the card uses before drawing. */
export async function loadShareFonts(): Promise<ShareFonts> {
  const css = getComputedStyle(document.body);
  const fonts: ShareFonts = {
    sans: css.getPropertyValue("--font-plex-sans").trim() || FALLBACK.sans,
    mono: css.getPropertyValue("--font-plex-mono").trim() || FALLBACK.mono,
  };
  try {
    await Promise.all(
      ["400", "500", "600"].flatMap((w) => [document.fonts.load(`${w} 40px ${fonts.sans}`), document.fonts.load(`${w} 40px ${fonts.mono}`)]),
    );
    await document.fonts.ready;
  } catch {
    // Draw with whatever is available rather than not at all.
  }
  return fonts;
}

// ---------------------------------------------------------------- text helpers

type Ctx = CanvasRenderingContext2D;
const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

/** Fit `text` in `maxW`: shrink down to 85% of `size`, then cut with "…". */
export function fitText(ctx: Ctx, text: string, maxW: number, weight: number, size: number, family: string): { text: string; size: number } {
  for (let s = size; s >= Math.ceil(size * 0.85); s -= 2) {
    ctx.font = font(weight, s, family);
    if (ctx.measureText(text).width <= maxW) return { text, size: s };
  }
  const s = Math.ceil(size * 0.85);
  ctx.font = font(weight, s, family);
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return { text: `${text.slice(0, lo).trimEnd()}…`, size: s };
}

function drawText(ctx: Ctx, text: string, x: number, y: number, weight: number, size: number, family: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font(weight, size, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

/** Lucide "trophy" (24 × 24, stroke 1.75), drawn at `size`. */
const TROPHY = [
  "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2",
  "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2",
  "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3",
  "M4 22h16",
  "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
  "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3",
];
function drawTrophy(ctx: Ctx, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.75;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of TROPHY) ctx.stroke(new Path2D(d));
  ctx.restore();
}

// ---------------------------------------------------------------- the stack of blocks

interface Block {
  h: number;
  draw: (ctx: Ctx, x: number, y: number, w: number) => void;
}

/** "69 min" → ["69", "min"]: the big number and its plain word under it (wording stays in plain.ts). */
const split = (phrase: string): [string, string] => {
  const i = phrase.indexOf(" ");
  return [phrase.slice(0, i), phrase.slice(i + 1)];
};

function buildBlocks(s: ShareSummary, o: ShareOptions, p: Palette, f: ShareFonts, template: ShareTemplate): Block[] {
  const blocks: Block[] = [];
  const gap = (h: number): Block => ({ h, draw: () => {} });
  const divider: Block = {
    h: 2,
    draw: (ctx, x, y, w) => {
      ctx.fillStyle = p.line;
      ctx.fillRect(x, y, w, 2);
    },
  };

  const brand: Block = {
    h: 48,
    draw: (ctx, x, y, w) => {
      ctx.font = font(600, 40, f.sans);
      const squadW = ctx.measureText("Squad").width;
      drawText(ctx, "Squad", x, y + 38, 600, 40, f.sans, p.text);
      drawText(ctx, "Fit", x + squadW, y + 38, 600, 40, f.sans, p.accent);
      const site = fitText(ctx, SHARE_SITE, w - squadW - 140, 400, 26, f.sans);
      drawText(ctx, site.text, x + w, y + 36, 400, site.size, f.sans, p.muted, "right");
    },
  };

  const head: Block = {
    h: s.label ? 124 : 56,
    draw: (ctx, x, y, w) => {
      drawText(ctx, shareDate(s.date), x, y + 38, 500, 36, f.sans, p.muted);
      if (s.label) {
        const t = fitText(ctx, s.label, w, 600, 64, f.sans);
        drawText(ctx, t.text, x, y + 112, 600, t.size, f.sans, p.text);
      }
    },
  };

  const stats: [string, string][] = [];
  if (o.duration && s.durationMin > 0) stats.push(split(minutes(s.durationMin)));
  stats.push(split(exercisesCount(s.exerciseCount)));
  if (o.improved && s.liftsImproved > 0) stats.push(split(liftsImproved(s.liftsImproved)));
  const headline: Block = {
    h: 150,
    draw: (ctx, x, y, w) => {
      const col = w / stats.length;
      stats.forEach(([value, word], i) => {
        const cx = x + col * i;
        const v = fitText(ctx, value, col - 24, 600, 104, f.mono);
        drawText(ctx, v.text, cx, y + 96, 600, v.size, f.mono, p.text);
        const t = fitText(ctx, word, col - 24, 400, 32, f.sans);
        drawText(ctx, t.text, cx, y + 142, 400, t.size, f.sans, p.muted);
      });
    },
  };

  /** Name on the left, value on the right; the name gives way (shrinks, then "…") to the value. */
  const pairRow = (name: string, value: string, size: number, h: number, valueColor: string): Block => ({
    h,
    draw: (ctx, x, y, w) => {
      ctx.font = font(500, size - 2, f.mono);
      const vw = Math.min(ctx.measureText(value).width, w * 0.6);
      const v = fitText(ctx, value, vw, 500, size - 2, f.mono);
      drawText(ctx, v.text, x + w, y + h - 20, 500, v.size, f.mono, valueColor, "right");
      const n = fitText(ctx, name, w - vw - 32, 400, size, f.sans);
      drawText(ctx, n.text, x, y + h - 20, 400, n.size, f.sans, p.text);
    },
  });
  const note = (text: string): Block => ({ h: 48, draw: (ctx, x, y) => drawText(ctx, text, x, y + 36, 400, 32, f.sans, p.muted) });

  if (template === "card") blocks.push(brand, gap(48));
  blocks.push(head, gap(40));
  blocks.push(headline);

  if (o.exercises && s.rows.length) {
    blocks.push(gap(36), divider, gap(20));
    for (const r of s.rows) blocks.push(pairRow(r.name, shareRowValue(r), 40, 66, p.text));
    if (s.moreCount > 0) blocks.push(note(moreRows(s.moreCount)));
  }

  if (o.prs && s.prs.length) {
    blocks.push(gap(36), divider, gap(28));
    blocks.push({
      h: 56,
      draw: (ctx, x, y) => {
        drawTrophy(ctx, x, y + 6, 40, p.accent);
        drawText(ctx, NEW_PB, x + 56, y + 40, 600, 36, f.sans, p.accent);
      },
    });
    for (const pr of s.prs.slice(0, 3)) blocks.push(pairRow(pr.name, sharePrValue(pr), 38, 62, p.text));
    if (s.prs.length > 3) blocks.push(note(moreRows(s.prs.length - 3)));
  }

  const footer = [o.streak ? shareStreak(s.streak) : "", o.steps && s.steps !== null ? stepsCount(s.steps) : ""].filter(Boolean).join(" · ");
  if (footer) {
    blocks.push(gap(36), divider, gap(24));
    blocks.push({
      h: 48,
      draw: (ctx, x, y, w) => {
        const t = fitText(ctx, footer, w, 500, 36, f.sans);
        drawText(ctx, t.text, x, y + 38, 500, t.size, f.sans, p.text);
      },
    });
  }

  if (template !== "card") blocks.push(gap(44), brand);
  return blocks;
}

// ---------------------------------------------------------------- drawing

export interface ShareDrawInput {
  template: ShareTemplate;
  summary: ShareSummary;
  options: ShareOptions;
  fonts: ShareFonts;
  photo: (LoadedPhoto & { transform: PhotoTransform }) | null;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawShare(ctx: Ctx, input: ShareDrawInput) {
  const { template, summary, options, fonts, photo } = input;
  const p = PALETTE[template];
  ctx.clearRect(0, 0, SHARE_W, SHARE_H);

  // Background.
  if (template === "card") {
    ctx.fillStyle = DARK.bg;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  } else if (template === "photo") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);
    if (photo) {
      const s = coverScale(photo, SHARE_W, SHARE_H) * photo.transform.zoom;
      const w = photo.width * s;
      const h = photo.height * s;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(photo.source, photo.transform.cx - w / 2, photo.transform.cy - h / 2, w, h);
    }
  }

  const blocks = buildBlocks(summary, options, p, fonts, template);
  const pad = template === "sticker" ? 0 : 56;
  const margin = 72;
  const innerX = margin + pad;
  const innerW = SHARE_W - 2 * innerX;
  const natural = blocks.reduce((t, b) => t + b.h, 0);
  const room = SAFE_BOTTOM - SAFE_TOP - 2 * pad;
  const k = Math.min(1, room / natural); // a very full day shrinks as a whole rather than overflowing
  const height = natural * k + 2 * pad;

  // Where the stack sits: Card centred, Photo at the bottom of the safe area, Sticker centred.
  const top = template === "photo" ? SAFE_BOTTOM - height : SAFE_TOP + (SAFE_BOTTOM - SAFE_TOP - height) / 2;

  if (template === "card") {
    roundRect(ctx, margin, top, SHARE_W - 2 * margin, height, 24);
    ctx.fillStyle = DARK.surface;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = DARK.border;
    ctx.stroke();
  } else if (template === "photo") {
    // A scrim only behind the text, so the rest of the photo stays untouched.
    roundRect(ctx, margin, top, SHARE_W - 2 * margin, height, 24);
    ctx.fillStyle = "rgba(12,12,11,0.62)";
    ctx.fill();
  }

  ctx.save();
  if (p.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
  }
  ctx.translate(innerX + (innerW - innerW * k) / 2, top + pad);
  ctx.scale(k, k);
  let y = 0;
  for (const b of blocks) {
    b.draw(ctx, 0, y, innerW);
    y += b.h;
  }
  ctx.restore();
}

export const shareFileName = (date: string, template: ShareTemplate) => `squadfit-${date}.${template === "sticker" ? "png" : "jpg"}`;

/** JPEG (q 0.9) for Card and Photo, transparent PNG for Sticker. */
export function exportShare(canvas: HTMLCanvasElement, template: ShareTemplate, date: string): Promise<File> {
  const type = template === "sticker" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], shareFileName(date, template), { type })) : reject(new Error("Couldn't make the image."))), type, 0.9),
  );
}
