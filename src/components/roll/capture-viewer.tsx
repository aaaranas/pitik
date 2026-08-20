"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, Heart, Share2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Modal, SheetRoot } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/hooks/use-object-url";
import { deleteCapture, toggleFavorite } from "@/lib/db/repo";
import type { Capture } from "@/lib/db/types";
import { getFilter, getProfile } from "@/lib/filters/registry";
import { downloadBlob, extensionFor, shareFile } from "@/lib/share";
import { cn, slugify } from "@/lib/utils";

/**
 * Full-frame viewer.
 *
 * Chrome stays out of the way: the photo gets the whole screen and the controls
 * sit on a gradient that only exists where they do. Left/right move through the
 * roll without closing, because looking back through an evening is a sequence,
 * not a series of separate openings.
 */
export function CaptureViewer({
  captures,
  index,
  rollTitle,
  onClose,
  onIndexChange,
}: {
  captures: Capture[];
  index: number | null;
  rollTitle: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const capture = index === null ? null : (captures[index] ?? null);
  const url = useObjectUrl(capture?.blob ?? null);

  const move = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next < 0 || next >= captures.length) return;
      onIndexChange(next);
    },
    [captures.length, index, onIndexChange],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, move]);

  if (!capture) return null;

  const filename = `pitik-${slugify(rollTitle)}-${index! + 1}.${extensionFor(capture.blob)}`;

  const onShare = async () => {
    const outcome = await shareFile({
      blob: capture.blob,
      filename,
      title: rollTitle,
    });
    if (outcome === "downloaded") toast("Saved to your downloads.", { tone: "success" });
    if (outcome === "failed") toast("Couldn't share that photo.", { tone: "error" });
  };

  return (
    <Dialog.Root open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            Frame {index! + 1} of {captures.length} from {rollTitle}
          </Dialog.Title>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`Frame ${index! + 1} from ${rollTitle}`}
                className="animate-develop max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="size-16 animate-pulse rounded-full bg-ink-800" />
            )}

            {index! > 0 ? (
              <NavArrow side="left" onClick={() => move(-1)} />
            ) : null}
            {index! < captures.length - 1 ? (
              <NavArrow side="right" onClick={() => move(1)} />
            ) : null}
          </div>

          <header
            className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-ink-950/85 to-transparent px-3 pb-8"
            style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
          >
            <Dialog.Close
              className="grid size-10 place-items-center rounded-full text-ink-100 transition hover:bg-white/10"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-300">
              {capture.authorId ? "Shared · " : ""}
              {getProfile(capture.profileId).name} · {getFilter(capture.filterId).name}
            </p>
            <span className="size-10" aria-hidden />
          </header>

          <footer
            className="absolute inset-x-0 bottom-0 flex items-center justify-around bg-gradient-to-t from-ink-950/85 to-transparent px-4 pt-10"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}
          >
            <ViewerAction
              label={capture.favorite ? "Remove from favourites" : "Add to favourites"}
              onClick={() => void toggleFavorite(capture.id)}
            >
              <Heart
                className={cn(
                  "size-5",
                  capture.favorite && "fill-safelight-500 text-safelight-500",
                )}
              />
            </ViewerAction>

            <ViewerAction label="Share" onClick={() => void onShare()}>
              <Share2 className="size-5" />
            </ViewerAction>

            <ViewerAction
              label="Save to device"
              onClick={() => {
                downloadBlob(capture.blob, filename);
                toast("Saved to your downloads.", { tone: "success" });
              }}
            >
              <Download className="size-5" />
            </ViewerAction>

            <ViewerAction label="Delete" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-5" />
            </ViewerAction>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>

      <SheetRoot open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Modal
          title="Delete this photo?"
          description="It will be removed from this device. This can't be undone."
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await deleteCapture(capture.id);
                  setConfirmDelete(false);
                  // Step back rather than closing: you were mid-way through
                  // looking at the roll and should stay there.
                  if (captures.length <= 1) onClose();
                  else onIndexChange(Math.max(0, index! - 1));
                }}
              >
                Delete
              </Button>
            </>
          }
        />
      </SheetRoot>
    </Dialog.Root>
  );
}

function NavArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink-950/40 text-ink-100 backdrop-blur transition hover:bg-ink-950/70",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function ViewerAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-12 place-items-center rounded-full text-ink-100 transition hover:bg-white/10"
    >
      {children}
    </button>
  );
}
