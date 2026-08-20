"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, Share2, X } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { useObjectUrl } from "@/hooks/use-object-url";
import { motionExtension } from "@/lib/camera/motion";
import type { MotionAttachment } from "@/lib/db/types";
import { downloadBlob, shareFile } from "@/lib/share";
import { slugify } from "@/lib/utils";

/**
 * Watching a booth clip.
 *
 * Storing something the user can only ever export is a dead end — you should be
 * able to see what you recorded without handing it to another app first. This
 * is the one place a clip is played, and it carries its own share and save
 * actions so the strip's controls stay about the strip.
 *
 * Not muted: sound is the point of recording the shoot rather than
 * photographing it. Autoplay with audio may be refused, which is why the
 * native controls are always present rather than a custom play button.
 */
export function ClipDialog({
  clip,
  title,
  open,
  onOpenChange,
}: {
  clip: MotionAttachment | null;
  /** Used for the exported filename and the accessible label. */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  // Only materialised while the dialog is open: a clip is megabytes, and an
  // object URL pins every one of them until it is revoked.
  const url = useObjectUrl(open && clip ? clip.blob : null);

  if (!clip) return null;

  const filename = `pitik-${slugify(title)}-clip.${motionExtension(clip.mimeType)}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{`Clip from ${title}`}</Dialog.Title>

          <header
            className="flex shrink-0 items-center justify-between px-3"
            style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
          >
            <Dialog.Close
              className="grid size-10 place-items-center rounded-full text-ink-100 transition hover:bg-white/10"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-300">
              {Math.round(clip.durationMs / 1000)}s · the whole shoot
            </p>
            <span className="size-10" aria-hidden />
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-4">
            {url ? (
              <video
                src={url}
                controls
                autoPlay
                loop
                playsInline
                data-testid="clip-video"
                aria-label={`Clip from ${title}`}
                className="max-h-full max-w-full rounded-xl bg-black"
              />
            ) : (
              <div className="size-16 animate-pulse rounded-full bg-ink-800" />
            )}
          </div>

          <footer
            className="flex shrink-0 items-center justify-center gap-3 px-4"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}
          >
            <button
              type="button"
              onClick={async () => {
                const outcome = await shareFile({ blob: clip.blob, filename, title });
                if (outcome === "downloaded") toast("Clip saved.", { tone: "success" });
                if (outcome === "failed") toast("Couldn't share that clip.", { tone: "error" });
              }}
              className="flex h-11 items-center gap-2 rounded-xl bg-paper px-5 text-sm font-medium text-ink-900"
            >
              <Share2 className="size-4" aria-hidden />
              Share clip
            </button>
            <button
              type="button"
              onClick={() => {
                downloadBlob(clip.blob, filename);
                toast("Clip saved to your downloads.", { tone: "success" });
              }}
              aria-label="Save the clip to this device"
              className="grid size-11 place-items-center rounded-xl bg-ink-800 text-ink-100 transition hover:bg-ink-700"
            >
              <Download className="size-5" />
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
