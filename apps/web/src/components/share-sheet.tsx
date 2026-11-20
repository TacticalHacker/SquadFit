"use client";

import { Download, ImagePlus, Share, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { SharePostState, ShareSummary } from "@calci/shared";
import { HIDDEN_POST, PHOTO_STAYS, SHARE_HINT, shareDate } from "@/lib/plain";
import { reducePhoto } from "@/lib/photo-reduce";
import { centredTransform, clampTransform, loadSharePhoto, MAX_ZOOM, zoomAt, type LoadedPhoto, type PhotoTransform } from "@/lib/share-photo";
import {
  DEFAULT_SHARE_OPTIONS,
  SHARE_H,
  SHARE_W,
  drawShare,
  exportShare,
  loadShareFonts,
  type ShareFonts,
  type ShareOptions,
  type ShareTemplate,
} from "@/lib/share-render";
import { loadShare, postShare, removePost } from "@/server/actions/share";
import { BottomSheet, SheetClose } from "./bottom-sheet";
import {
  buttonClass,
  chipClass,
  dangerLinkClass,
  iconButtonClass,
  noticeErrorClass,
  secondaryButtonClass,
  segmentClass,
  segmentGroupClass,
} from "./form-bits";

const TEMPLATES: { id: ShareTemplate; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "photo", label: "Photo" },
  { id: "sticker", label: "Sticker" },
];

const canShareFile = (file: File | null) => {
  if (!file || typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

/**
 * Feature 016: share one of the member's own workout days as a 9:16 story image. The figures come from the server; the
 * image is drawn here, and the photo never leaves the device unless "Also post this photo to your squad" is ticked.
 */
export function ShareSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [summary, setSummary] = useState<ShareSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fonts, setFonts] = useState<ShareFonts | null>(null);
  const [template, setTemplate] = useState<ShareTemplate>("card");
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [transform, setTransform] = useState<PhotoTransform>(() => centredTransform(SHARE_W, SHARE_H));
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [post, setPost] = useState<SharePostState | null>(null);
  const [withPhoto, setWithPhoto] = useState(false);
  const [posting, setPosting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadShare(date).then((r) => {
      if (!live) return;
      if (r.ok) {
        setSummary(r.value);
        setPost(r.value.post);
      } else setLoadError(r.error);
    });
    loadShareFonts().then((f) => live && setFonts(f));
    return () => {
      live = false;
    };
  }, [date, attempt]);

  // Draw on every change (a few ms), then make the file shortly after so Share can run inside the tap itself.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !summary || !fonts) return;
    drawShare(ctx, { template, summary, options, fonts, photo: template === "photo" && photo ? { ...photo, transform } : null });
    setPreparing(true);
    const id = setTimeout(() => {
      exportShare(canvas, template, date)
        .then(setFile)
        .catch(() => setMessage("Couldn't make the image."))
        .finally(() => setPreparing(false));
    }, 150);
    return () => clearTimeout(id);
  }, [summary, fonts, template, options, photo, transform, date]);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setMessage(null);
    try {
      const loaded = await loadSharePhoto(f);
      setPhoto(loaded);
      setPhotoFile(f);
      setTransform(centredTransform(SHARE_W, SHARE_H));
      // First photo: keep the scrim to the bottom of the frame by starting without the exercise list (one tap to add).
      if (!photo) setOptions((o) => ({ ...o, exercises: false }));
      setTemplate("photo");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't open this photo.");
    }
  };

  const dropPhoto = () => {
    setPhoto(null);
    setPhotoFile(null);
    setWithPhoto(false);
    setTemplate((t) => (t === "photo" ? "card" : t));
  };

  // Drag to move, pinch to zoom (photo template only). Positions are in output pixels.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const toFrame = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * SHARE_W, y: ((e.clientY - rect.top) / rect.height) * SHARE_H };
  }, []);
  const editing = template === "photo" && photo !== null;
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toFrame(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!editing || !prev || !photo) return;
    const now = toFrame(e);
    const others = [...pointers.current].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    pointers.current.set(e.pointerId, now);
    setTransform((t) => {
      if (others.length === 0) return clampTransform({ ...t, cx: t.cx + now.x - prev.x, cy: t.cy + now.y - prev.y }, photo, SHARE_W, SHARE_H);
      const o = others[0]!;
      const before = Math.hypot(prev.x - o.x, prev.y - o.y);
      const after = Math.hypot(now.x - o.x, now.y - o.y);
      if (before < 1) return t;
      return clampTransform(zoomAt(t, t.zoom * (after / before), (now.x + o.x) / 2, (now.y + o.y) / 2), photo, SHARE_W, SHARE_H);
    });
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const shareable = canShareFile(file);
  const doShare = () => {
    if (!file) return;
    setMessage(null);
    navigator.share({ files: [file], title: "SquadFit workout" }).catch((err: unknown) => {
      // Closing the share sheet is not an error.
      if (err instanceof Error && err.name === "AbortError") return;
      setMessage("Couldn't open sharing here. Use Download instead.");
    });
  };
  const doDownload = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const doPost = async () => {
    setPosting(true);
    setMessage(null);
    try {
      const photoInput = withPhoto && photoFile ? { data: (await reducePhoto(photoFile)).dataBase64 } : ("remove" as const);
      const r = await postShare(date, photoInput);
      if (r.ok) setPost(r.value);
      else setMessage(r.error);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't post. Try again.");
    } finally {
      setPosting(false);
    }
  };
  const doUnpost = async () => {
    setPosting(true);
    setMessage(null);
    const r = await removePost(date);
    if (r.ok) setPost(r.value);
    else setMessage(r.error);
    setPosting(false);
  };

  const toggles: { key: keyof ShareOptions; label: string; show: boolean }[] = summary
    ? [
        { key: "exercises", label: "Exercises", show: summary.rows.length > 0 },
        { key: "prs", label: "Personal bests", show: summary.prs.length > 0 },
        { key: "streak", label: "Streak", show: true },
        { key: "duration", label: "Duration", show: summary.durationMin > 0 },
        { key: "improved", label: "Lifts improved", show: summary.liftsImproved > 0 },
        { key: "steps", label: "Steps", show: summary.steps !== null },
      ]
    : [];

  const ready = summary !== null && fonts !== null;
  const footer = ready ? (
    <div className="flex flex-col gap-2">
      {message ? (
        <p role="alert" className={noticeErrorClass}>
          {message}
        </p>
      ) : null}
      <div className="flex gap-2">
        {shareable ? (
          <>
            <button type="button" className={`${buttonClass} flex-1`} onClick={doShare} disabled={preparing || !file}>
              <Share aria-hidden size={18} strokeWidth={1.75} />
              {preparing ? "Preparing…" : "Share"}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={doDownload} disabled={!file} aria-label="Download image">
              <Download aria-hidden size={18} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <button type="button" className={`${buttonClass} flex-1`} onClick={doDownload} disabled={preparing || !file}>
            <Download aria-hidden size={18} strokeWidth={1.75} />
            {preparing ? "Preparing…" : "Download image"}
          </button>
        )}
      </div>
      {!shareable ? <p className="text-xs text-muted">{SHARE_HINT}</p> : null}
    </div>
  ) : undefined;

  return (
    <BottomSheet
      open
      onClose={onClose}
      label="Share workout"
      header={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Share workout</h2>
            <p className="text-sm text-muted">{shareDate(date)}</p>
          </div>
          <SheetClose />
        </div>
      }
      {...(footer ? { footer } : {})}
    >
      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className={noticeErrorClass}>
            {loadError}
          </p>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setLoadError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative mx-auto aspect-[9/16] h-[46dvh] overflow-hidden rounded-lg border border-line bg-backdrop">
            <canvas
              ref={canvasRef}
              width={SHARE_W}
              height={SHARE_H}
              aria-label="Preview of the story image"
              role="img"
              className={`h-full w-full ${editing ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {!ready ? <p className="absolute inset-0 grid place-items-center text-sm text-muted">Making your image…</p> : null}
          </div>

          {ready ? (
            <>
              <div role="radiogroup" aria-label="Template" className={`${segmentGroupClass} grid-cols-3`}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={template === t.id}
                    disabled={t.id === "photo" && !photo}
                    className={`${segmentClass(template === t.id)} disabled:opacity-50`}
                    onClick={() => setTemplate(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button type="button" className={`${secondaryButtonClass} flex-1`} onClick={() => inputRef.current?.click()}>
                    <ImagePlus aria-hidden size={18} strokeWidth={1.75} />
                    {photo ? "Change photo" : "Add photo"}
                  </button>
                  {photo ? (
                    <button type="button" className={iconButtonClass} onClick={dropPhoto} aria-label="Remove photo">
                      <X aria-hidden size={18} strokeWidth={1.75} />
                    </button>
                  ) : null}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      void pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                {editing ? (
                  <label className="flex items-center gap-3 text-sm text-muted">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={MAX_ZOOM}
                      step={0.01}
                      value={transform.zoom}
                      className="flex-1 accent-accent"
                      onChange={(e) => setTransform((t) => clampTransform(zoomAt(t, Number(e.target.value), SHARE_W / 2, SHARE_H / 2), photo, SHARE_W, SHARE_H))}
                    />
                  </label>
                ) : null}
                <p className="text-xs text-muted">{editing ? `Drag to move, pinch to zoom. ${PHOTO_STAYS}` : PHOTO_STAYS}</p>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-ink">Show</legend>
                <div className="flex flex-wrap gap-2">
                  {toggles
                    .filter((t) => t.show)
                    .map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={options[t.key]}
                        className={chipClass(options[t.key])}
                        onClick={() => setOptions((o) => ({ ...o, [t.key]: !o[t.key] }))}
                      >
                        {t.label}
                      </button>
                    ))}
                </div>
              </fieldset>

              {post ? (
                <section aria-label="Squad feed" className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-sm font-medium">Squad feed</h3>
                  {!post.canPost ? (
                    <p className="text-sm text-muted">{HIDDEN_POST}</p>
                  ) : (
                    <>
                      {photo ? (
                        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
                          <input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} className="size-5 accent-accent" />
                          Also post this photo to your squad
                        </label>
                      ) : null}
                      {post.posted ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="flex-1 text-sm text-success">Posted to squad feed{post.hasPhoto ? " with your photo" : ""}</p>
                          <button type="button" className={secondaryButtonClass} onClick={doPost} disabled={posting}>
                            Update post
                          </button>
                          <button type="button" className={dangerLinkClass} onClick={doUnpost} disabled={posting}>
                            Remove post
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={secondaryButtonClass} onClick={doPost} disabled={posting}>
                          {posting ? "Posting…" : "Post to squad feed"}
                        </button>
                      )}
                      <p className="text-xs text-muted">Squad members see your workout and can react. {withPhoto ? "Your photo goes with it, for signed-in members only." : "Your photo isn't posted."}</p>
                    </>
                  )}
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
