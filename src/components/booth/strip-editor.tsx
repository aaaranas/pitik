"use client";

import { Check, Download, Film, RotateCcw, Share2 } from "lucide-react";
import { ClipDialog } from "./clip-dialog";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { exportStrip } from "@/lib/booth/compositor";
import {
  type BoothTemplate,
  CAPTION_FONT_IDS,
  type CaptionFontId,
  DEFAULT_STRIP_STYLE,
  PAPERS,
  paperBackgroundCss,
  PAPER_IDS,
  type PaperId,
  type StripStyle,
} from "@/lib/booth/types";
import type { MotionClip } from "@/lib/camera/motion";
import { CLIP_SPEED, speedUpClip } from "@/lib/camera/motion-speed";
import { addStrip } from "@/lib/db/repo";
import { extensionFor, downloadBlob, shareFile } from "@/lib/share";
import { cn, slugify } from "@/lib/utils";

/**
 * Rendering each label in its own face is both the fix for lazy loading — it
 * puts every face in the DOM, which is what actually triggers the browser to
 * fetch it — and better UX, because you see what you are choosing.
 *
 * Keyed as a `Record` over `CaptionFontId`, the same device already
 * protecting `FONT_FALLBACKS` and `FONT_SCALE` in the compositor: it makes
 * the union's coverage a compile error, not just a compile error on each
 * listed id. A face added to `CAPTION_FONT_IDS` and forgotten here fails
 * `pnpm typecheck` instead of silently never appearing in the picker.
 */
const CAPTION_FACE_META: Record<CaptionFontId, { label: string; className: string }> = {
  display: { label: "Bold", className: "font-display font-extrabold" },
  sans: { label: "Sans", className: "font-sans" },
  mono: { label: "Mono", className: "font-mono" },
  serif: { label: "Serif", className: "font-serif" },
  hand: { label: "Hand", className: "font-hand text-base" },
  script: { label: "Script", className: "font-script text-base" },
};

/** Order comes from the canonical list, not from object key order. */
const CAPTION_FACES = CAPTION_FONT_IDS.map((id) => ({ id, ...CAPTION_FACE_META[id] }));

/**
 * Finish and keep the strip.
 *
 * The preview is the real compositor output, re-rendered whenever a control
 * changes — there is no separate "preview renderer" that could disagree with
 * what gets exported. Rendering is debounced and done at half scale so typing a
 * caption doesn't re-encode a print-resolution PNG on every keystroke.
 */
export function StripEditor({
  template,
  frames,
  motion,
  onRetake,
}: {
  template: BoothTemplate;
  frames: ImageBitmap[];
  /** Clip of the whole shoot, when the device could record one. */
  motion?: MotionClip | null;
  onRetake: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { destinationFor } = useSession();

  const [style, setStyle] = useState<StripStyle>({
    ...DEFAULT_STRIP_STYLE,
    paper: template.defaultPaper,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);

  /**
   * The clip as it will actually be stored and shared.
   *
   * Starts as the raw recording and is replaced by the sped-up re-encode when
   * that finishes. Held in a ref alongside state so `save` can read the newest
   * value without being re-created, and so the re-encode can be awaited if the
   * user taps Keep it before it lands.
   */
  const [exportClip, setExportClip] = useState<MotionClip | null>(motion ?? null);
  const speedUpRef = useRef<Promise<MotionClip | null> | null>(null);

  const filename = useMemo(
    () => `pitik-${slugify(style.caption || template.name)}-strip.png`,
    [style.caption, template.name],
  );

  /**
   * Re-encodes the clip at speed, in the background.
   *
   * Started on mount rather than at save time because this is inherently
   * real-time work — it plays the clip through — and the seconds it takes are
   * seconds the user is already spending on paper and captions. By the time
   * they tap Keep it, it is almost always done.
   */
  useEffect(() => {
    if (!motion) return;
    let cancelled = false;

    const task = speedUpClip(motion, CLIP_SPEED)
      .then((faster) => {
        // A failed re-encode keeps the original: the player compensates with
        // playback rate, so the shoot is never lost over a speed change.
        const result = faster ?? motion;
        if (!cancelled) setExportClip(result);
        return result;
      })
      .catch(() => motion);

    speedUpRef.current = task;
    return () => {
      cancelled = true;
    };
  }, [motion]);

  // ------------------------------------------------------------- preview

  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const { blob } = await exportStrip({
          template,
          frames,
          style,
          // Half the export scale: plenty for an on-screen preview, and it
          // keeps caption typing responsive on a phone.
          scale: 1,
          format: "png",
        });
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);
        setPreviewUrl(previewUrlRef.current);
      } catch {
        // A failed preview leaves the last good one on screen; export has its
        // own error handling and is what actually matters.
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [frames, style, template]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // -------------------------------------------------------------- actions

  const buildFullSize = useCallback(
    () => exportStrip({ template, frames, style, scale: 2, format: "png" }),
    [frames, style, template],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const rollId = await destinationFor("booth");
      const composed = await buildFullSize();
      await addStrip({
        rollId,
        templateId: template.id,
        blob: composed.blob,
        thumb: composed.thumb,
        width: composed.width,
        height: composed.height,
        captureIds: [],
        caption: style.caption || null,
        // Wait for the re-encode if it is still running, so the stored clip is
        // the sped-up one rather than whichever happened to be ready.
        motion: (await speedUpRef.current) ?? exportClip ?? motion ?? undefined,
      });
      setSaved(true);
      toast("Strip saved to your roll.", { tone: "success" });
      router.push("/rolls?tab=booth");
    } catch (error) {
      toast("Couldn't save that strip.", {
        detail: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [buildFullSize, destinationFor, exportClip, motion, router, style.caption, template.id, toast]);

  const share = useCallback(async () => {
    try {
      const { blob } = await buildFullSize();
      const outcome = await shareFile({ blob, filename, title: "A strip from Pitik" });
      if (outcome === "downloaded") toast("Saved to your downloads.", { tone: "success" });
      if (outcome === "failed") toast("Couldn't share that strip.", { tone: "error" });
    } catch {
      toast("Couldn't build that strip.", { tone: "error" });
    }
  }, [buildFullSize, filename, toast]);

  const download = useCallback(async () => {
    try {
      const { blob } = await buildFullSize();
      downloadBlob(blob, filename.replace(/\.\w+$/, `.${extensionFor(blob)}`));
      toast("Saved to your downloads.", { tone: "success" });
    } catch {
      toast("Couldn't build that strip.", { tone: "error" });
    }
  }, [buildFullSize, filename, toast]);

  const caption = template.caption;

  return (
    <div className="flex h-full flex-col bg-cream-50">
      <ClipDialog
        clip={exportClip ?? motion ?? null}
        title={style.caption || template.name}
        open={clipOpen}
        onOpenChange={setClipOpen}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-center font-display text-3xl tracking-[-0.03em] text-cocoa-900">
            Your strip
          </h1>
          <p className="mt-1 text-center text-sm text-cocoa-600">
            {frames.length === template.shots
              ? "All frames in. Finish it however you like."
              : `${frames.length} of ${template.shots} frames came out.`}
            {motion ? " A clip of the shoot is saved with it." : ""}
          </p>

          <div className="mt-5 flex justify-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your finished photo strip"
                className="animate-pop slab rounded-frame max-h-[52svh] w-auto"
              />
            ) : (
              <div className="slab h-[52svh] w-40 animate-pulse rounded-frame" />
            )}
          </div>

          <div className="mt-6 space-y-5 pb-6">
            {caption ? (
              <div>
                <label htmlFor="strip-caption" className="counter mb-2 block">
                  Caption
                </label>
                <input
                  id="strip-caption"
                  value={style.caption}
                  maxLength={caption.maxLength}
                  placeholder={caption.placeholder || "Add a few words"}
                  onChange={(event) =>
                    setStyle((current) => ({ ...current, caption: event.target.value }))
                  }
                  className="w-full rounded-slot border border-edge-strong bg-cream-200 px-3 py-2.5 text-sm text-cocoa-900 placeholder:text-cocoa-600 focus:border-sky-deep focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CAPTION_FACES.map((face) => (
                    <button
                      key={face.id}
                      type="button"
                      aria-pressed={style.captionFont === face.id}
                      onClick={() =>
                        setStyle((current) => ({ ...current, captionFont: face.id }))
                      }
                      className={cn(
                        "rounded-slab border-2 px-2.5 py-1.5 text-sm transition",
                        face.className,
                        style.captionFont === face.id
                          ? "border-cocoa-900 bg-cocoa-900 text-cream-50"
                          : "border-cocoa-900 bg-cream-50 text-cocoa-900 hover:bg-cream-200",
                      )}
                    >
                      {face.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <span className="counter mb-2 block">Paper</span>
              {/* Wraps rather than scrolls: sixteen papers in a row would hide
                  most of the choice behind a swipe people don't know to make. */}
              <div className="flex flex-wrap gap-2">
                {PAPER_IDS.map((id) => (
                  <PaperSwatch
                    key={id}
                    id={id}
                    selected={style.paper === id}
                    onSelect={() => setStyle((current) => ({ ...current, paper: id }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Toggle
                label="Date"
                pressed={style.showDate}
                onPressedChange={(value) => setStyle((c) => ({ ...c, showDate: value }))}
              />
              <Toggle
                label="Rounded"
                pressed={style.rounded}
                onPressedChange={(value) => setStyle((c) => ({ ...c, rounded: value }))}
              />
              <Toggle
                label="Keyline"
                pressed={style.keyline}
                onPressedChange={(value) => setStyle((c) => ({ ...c, keyline: value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-cream-300 bg-cream-50 px-4 pt-3"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onRetake} aria-label="Take it again">
            <RotateCcw className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void download()} aria-label="Save to device">
            <Download className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void share()} aria-label="Share the strip">
            <Share2 className="size-5" />
          </Button>
          {/* Only rendered when there is a clip to hand over. A device that
              cannot record shows no control for recording. */}
          {motion ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setClipOpen(true)}
              aria-label="Watch the clip of this shoot"
              data-testid="clip-action"
            >
              <Film className="size-5" />
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => void save()}
            disabled={saving || saved}
          >
            {saved ? <Check className="size-5" aria-hidden /> : null}
            {saving ? "Saving…" : saved ? "Saved" : "Keep it"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaperSwatch({
  id,
  selected,
  onSelect,
}: {
  id: PaperId;
  selected: boolean;
  onSelect: () => void;
}) {
  const paper = PAPERS[id];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${paper.name} paper`}
      title={paper.name}
      className={cn(
        "size-9 rounded-pill border-2 transition",
        selected
          ? "border-cocoa-900 ring-2 ring-sky-deep ring-offset-2 ring-offset-cream-50"
          : "border-edge-strong hover:border-cocoa-900",
      )}
      style={{ background: paperBackgroundCss(paper) }}
    />
  );
}

function Toggle({
  label,
  pressed,
  onPressedChange,
}: {
  label: string;
  pressed: boolean;
  onPressedChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "flex-1 rounded-slab border-2 py-2 text-xs transition",
        pressed
          ? "border-cocoa-900 bg-sky-tint text-sky-deep"
          : "border-transparent bg-cream-200 text-cocoa-600 hover:bg-cream-300 hover:text-cocoa-800",
      )}
    >
      {label}
    </button>
  );
}
