"use client";

import { useId, useState } from "react";
import { Avatar } from "./avatar";
import { secondaryButtonClass } from "./form-bits";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // FR-013
const SIZE = 256;

/** Center-crop to a square, shrink to 256×256 and encode as WebP (research R6). Animated GIFs become still images. */
async function toAvatarWebp(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") throw new Error("webp unsupported");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Renders a hidden `avatarBase64` field the form submits; empty means "leave the avatar as is". */
export function AvatarPicker({ displayName, currentUrl }: { displayName: string; currentUrl: string | null }) {
  const inputId = useId();
  const [base64, setBase64] = useState("");
  const [error, setError] = useState<string>();
  const preview = base64 ? `data:image/webp;base64,${base64}` : currentUrl;

  async function onFile(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!ACCEPTED.includes(file.type) || file.size > MAX_BYTES) {
      setBase64("");
      setError("Images must be PNG, JPEG, WebP or GIF, max 5 MB");
      return;
    }
    try {
      setBase64(await toAvatarWebp(file));
    } catch {
      setBase64("");
      setError("Couldn't read that image. Try another one.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Photo (optional)</span>
      <div className="flex items-center gap-4">
        <Avatar displayName={displayName || "?"} avatarUrl={preview} size={64} />
        <div>
          <label htmlFor={inputId} className={`${secondaryButtonClass} cursor-pointer`}>
            Choose image
          </label>
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        </div>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <input type="hidden" name="avatarBase64" value={base64} />
    </div>
  );
}
