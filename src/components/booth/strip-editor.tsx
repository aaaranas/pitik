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
  DEFAULT_STRIP_STYLE,
  PAPERS,
  paperBackgroundCss,
  PAPER_IDS,
  type PaperId,
  type StripStyle,
} from "@/lib/booth/types";
import type { MotionClip } from "@/lib/camera/motion";
import { addStrip } from "@/lib/db/repo";
import { extensionFor, downloadBlob, shareFile } from "@/lib/share";
import { cn, slugify } from "@/lib/utils";

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
  const { ensureRoll } = useSession();

  const [style, setStyle] = useState<StripStyle>({
    ...DEFAULT_STRIP_STYLE,
    paper: template.defaultPaper,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);

  const filename = useMemo(
    () => `pitik-${slugify(style.caption || template.name)}-strip.png`,
    [style.caption, template.name],
  );

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
      const roll = await ensureRoll();
      const composed = await buildFullSize();
      await addStrip({
        rollId: roll.id,
        templateId: template.id,
        blob: composed.blob,
        thumb: composed.thumb,
        width: composed.width,
        height: composed.height,
        captureIds: [],
        caption: style.caption || null,
        motion: motion ?? undefined,
      });
      setSaved(true);
      toast("Strip saved to your roll.", { tone: "success" });
      router.push(`/rolls/${roll.id}`);
    } catch (error) {
      toast("Couldn't save that strip.", {
        detail: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [buildFullSize, ensureRoll, motion, router, style.caption, template.id, toast]);

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
    <div className="flex h-full flex-col bg-ink-950">
      <ClipDialog
        clip={motion ?? null}
        title={style.caption || template.name}
        open={clipOpen}
        onOpenChange={setClipOpen}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-center font-display text-3xl text-paper">Your strip</h1>
          <p className="mt-1 text-center text-sm text-ink-400">
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
                className="animate-develop max-h-[52svh] w-auto rounded-sm shadow-2xl shadow-black/60"
              />
            ) : (
              <div className="h-[52svh] w-40 animate-pulse rounded-sm bg-ink-900" />
            )}
          </div>

          <div className="mt-6 space-y-5 pb-6">
            {caption ? (
              <div>
                <label
                  htmlFor="strip-caption"
                  className="mb-2 block text-[0.6875rem] uppercase tracking-[0.16em] text-ink-400"
                >
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
                  className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-safelight-500 focus:outline-none"
                />
                <div className="mt-2 flex gap-1.5">
                  {(["display", "sans", "mono"] as const).map((font) => (
                    <button
                      key={font}
                      type="button"
                      aria-pressed={style.captionFont === font}
                      onClick={() => setStyle((current) => ({ ...current, captionFont: font }))}
                      className={cn(
                        "flex-1 rounded-lg py-1.5 text-xs capitalize transition",
                        font === "display" && "font-display text-base",
                        font === "mono" && "font-mono",
                        style.captionFont === font
                          ? "bg-safelight-500/20 text-safelight-400 ring-1 ring-safelight-500"
                          : "bg-ink-900 text-ink-300 hover:bg-ink-800",
                      )}
                    >
                      {font === "display" ? "Serif" : font === "sans" ? "Sans" : "Mono"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <span className="mb-2 block text-[0.6875rem] uppercase tracking-[0.16em] text-ink-400">
                Paper
              </span>
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
        className="shrink-0 border-t border-ink-850 bg-ink-950 px-4 pt-3"
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
        "size-9 rounded-full transition",
        selected
          ? "ring-2 ring-safelight-500 ring-offset-2 ring-offset-ink-950"
          : "ring-1 ring-white/15 hover:ring-white/40",
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
        "flex-1 rounded-lg py-2 text-xs transition",
        pressed
          ? "bg-safelight-500/20 text-safelight-400 ring-1 ring-safelight-500"
          : "bg-ink-900 text-ink-300 hover:bg-ink-800",
      )}
    >
      {label}
    </button>
  );
}
