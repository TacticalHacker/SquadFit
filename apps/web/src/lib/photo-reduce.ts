import { MAX_PHOTO_BYTES } from "@calci/shared";

export const MAX_EDGE = 1280;
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.35;

/** Scale so the long edge is at most `maxEdge`, keeping the aspect ratio and never upscaling. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Next (lower) JPEG quality to try, or null when the size already fits or quality cannot go lower. */
export function nextQuality(size: number, limit: number, quality: number): number | null {
  if (size <= limit) return null;
  const next = Math.round((quality - 0.1) * 100) / 100;
  return next < MIN_QUALITY ? null : next;
}

export interface ReducedPhoto {
  contentType: "image/jpeg";
  dataBase64: string;
  /** Local preview for the optimistic card. */
  previewUrl: string;
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/**
 * Shrinks a picked photo in the browser (long edge ≤ 1280 px, JPEG, ≤ 1.5 MB) before upload (research R4).
 * Throws an Error with a message fit to show the user.
 */
export async function reducePhoto(file: File): Promise<ReducedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG, WebP or HEIC).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format can't be read here. Try a JPEG or PNG.");
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the photo in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality: number | null = START_QUALITY;
  let blob: Blob | null = null;
  while (quality !== null) {
    blob = await toBlob(canvas, quality);
    if (!blob || blob.type !== "image/jpeg") throw new Error("Couldn't process the photo in this browser.");
    quality = nextQuality(blob.size, MAX_PHOTO_BYTES, quality);
  }
  if (!blob || blob.size > MAX_PHOTO_BYTES) throw new Error("That photo is too large even after shrinking. Try another.");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the photo."));
    reader.readAsDataURL(blob);
  });
  return { contentType: "image/jpeg", dataBase64: dataUrl.split(",")[1] ?? "", previewUrl: dataUrl };
}
