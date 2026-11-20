import { PHOTO_ERROR } from "./plain";

/**
 * Feature 016: the member's own photo for a share card. Decoded on the device (right way up from the camera's
 * orientation data), shrunk so 12–48 MP photos never exhaust a phone browser, and never uploaded by this module.
 */

/** Long edge after shrinking: 2× the 1080 px output width, enough for a 2× zoom without visible softness. */
export const PHOTO_MAX_EDGE = 2160;
export const MAX_ZOOM = 3;

export interface LoadedPhoto {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** Where the photo sits on the 1080 × 1920 frame: zoom over "cover" (1 = just covers) and its centre point. */
export interface PhotoTransform {
  zoom: number;
  cx: number;
  cy: number;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older Safari: an <img> applies the orientation itself.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Throws an Error with a message fit to show (e.g. a HEIC the browser can't read). */
export async function loadSharePhoto(file: File): Promise<LoadedPhoto> {
  let raw: Awaited<ReturnType<typeof decode>>;
  try {
    raw = await decode(file);
  } catch {
    throw new Error(PHOTO_ERROR);
  }
  if (!raw.width || !raw.height) throw new Error(PHOTO_ERROR);
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(raw.width, raw.height));
  if (scale === 1) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(raw.width * scale);
  canvas.height = Math.round(raw.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(PHOTO_ERROR);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(raw.source, 0, 0, canvas.width, canvas.height);
  raw.close?.();
  return { source: canvas, width: canvas.width, height: canvas.height };
}

/** Scale that makes the photo just cover a `w` × `h` frame. */
export const coverScale = (p: Pick<LoadedPhoto, "width" | "height">, w: number, h: number) => Math.max(w / p.width, h / p.height);

/** Keep the zoom in range and the photo covering the whole frame (no empty edge). */
export function clampTransform(t: PhotoTransform, p: Pick<LoadedPhoto, "width" | "height">, w: number, h: number): PhotoTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, t.zoom));
  const s = coverScale(p, w, h) * zoom;
  const halfW = (p.width * s) / 2;
  const halfH = (p.height * s) / 2;
  return { zoom, cx: Math.min(halfW, Math.max(w - halfW, t.cx)), cy: Math.min(halfH, Math.max(h - halfH, t.cy)) };
}

export const centredTransform = (w: number, h: number): PhotoTransform => ({ zoom: 1, cx: w / 2, cy: h / 2 });

/** Zoom to `zoom` keeping the frame point (mx, my) still (pinch centre, or the frame centre for the slider). */
export function zoomAt(t: PhotoTransform, zoom: number, mx: number, my: number): PhotoTransform {
  const k = Math.min(MAX_ZOOM, Math.max(1, zoom)) / t.zoom;
  return { zoom: t.zoom * k, cx: mx + (t.cx - mx) * k, cy: my + (t.cy - my) * k };
}
