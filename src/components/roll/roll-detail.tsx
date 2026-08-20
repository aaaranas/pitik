"use client";

import { Camera, ChevronLeft, LayoutGrid, Lock, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaptureViewer } from "./capture-viewer";
import { ContactSheet } from "./contact-sheet";
import { StripGrid } from "./strip-grid";
import { ShareSheet } from "./share-sheet";
import { Button } from "@/components/ui/button";
import { Modal, SheetRoot } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { useMinute } from "@/hooks/use-now";
import { useCaptures, useRoll, useStrips } from "@/hooks/use-store";
import { deleteRoll, updateRoll } from "@/lib/db/repo";
import { cn, formatCount, formatTimeUntil, relativeDay } from "@/lib/utils";

/**
 * One roll, in full.
 *
 * The gallery is the point of the screen, so it starts at the top of the fold
 * and the metadata is a single line above it. Actions that alter the roll live
 * behind explicit taps — nothing destructive is one mis-swipe away.
 */
export function RollDetail({ rollId }: { rollId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: roll, loading } = useRoll(rollId);
  const { data: captures } = useCaptures(rollId);
  const { data: strips } = useStrips(rollId);
  const now = useMinute();

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"photos" | "strips">("photos");
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  if (loading) {
    return <div className="h-full animate-pulse bg-ink-900/40" aria-hidden />;
  }

  if (!roll) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-ink-100">This roll is gone</h1>
          <p className="mt-2 text-sm text-ink-400">
            It may have been deleted, or it lives on another device.
          </p>
          <Link href="/rolls" className="mt-5 inline-block text-sm text-safelight-400 underline underline-offset-4">
            Back to your rolls
          </Link>
        </div>
      </div>
    );
  }

  const locked =
    roll.mode === "disposable" &&
    !roll.developedAt &&
    roll.revealAt !== null &&
    roll.revealAt > now;
  const develop = async () => {
    await updateRoll(roll.id, { developedAt: Date.now() });
    toast("Developed. Here's everything.", { tone: "success" });
  };

  const saveTitle = async () => {
    const next = draftTitle.trim();
    if (next) await updateRoll(roll.id, { title: next });
    setRenaming(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <header
        className="sticky top-0 z-20 flex items-center gap-1 bg-ink-950/90 px-2 pb-2 backdrop-blur"
        style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
      >
        <Link
          href="/rolls"
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Back to rolls"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Share this roll"
        >
          <Share2 className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Delete this roll"
        >
          <Trash2 className="size-5" />
        </button>
      </header>

      <div className="px-4">
        {renaming ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveTitle();
              if (event.key === "Escape") setRenaming(false);
            }}
            aria-label="Roll name"
            className="w-full border-b border-safelight-500 bg-transparent pb-1 font-display text-4xl text-paper focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftTitle(roll.title);
              setRenaming(true);
            }}
            className="text-left font-display text-4xl leading-tight text-paper"
            aria-label={`Rename ${roll.title}`}
          >
            {roll.emoji ? <span className="mr-2">{roll.emoji}</span> : null}
            {roll.title}
          </button>
        )}

        <p className="mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
          {formatCount(captures.length, "photo")}
          {strips.length ? ` · ${formatCount(strips.length, "strip")}` : ""} ·{" "}
          {relativeDay(roll.createdAt)}
          {roll.mode === "disposable" && roll.shotLimit
            ? ` · ${Math.max(0, roll.shotLimit - captures.length)} left`
            : ""}
        </p>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/camera?roll=${roll.id}`}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-paper text-sm font-medium text-ink-900 transition hover:bg-white"
          >
            <Camera className="size-4" aria-hidden />
            Keep shooting
          </Link>
          <Link
            href="/booth"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink-800 px-4 text-sm text-ink-100 transition hover:bg-ink-700"
          >
            <LayoutGrid className="size-4" aria-hidden />
            Booth
          </Link>
        </div>
      </div>

      {locked ? (
        <DevelopingState
          now={now}
          revealAt={roll.revealAt!}
          shotsTaken={captures.length}
          shotLimit={roll.shotLimit}
          onDevelop={() => void develop()}
        />
      ) : (
        <>
          {strips.length ? (
            <div
              role="tablist"
              aria-label="Roll contents"
              className="mt-6 flex gap-1 border-b border-ink-850 px-4"
            >
              {(["photos", "strips"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors",
                    tab === value
                      ? "border-safelight-500 text-ink-100"
                      : "border-transparent text-ink-400 hover:text-ink-200",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : null}

          {tab === "photos" ? (
            captures.length ? (
              <ContactSheet
                captures={captures}
                onOpen={setViewerIndex}
                className="mt-4 border-t border-ink-850 pt-px"
              />
            ) : (
              <EmptyRoll rollId={roll.id} />
            )
          ) : (
            <StripGrid strips={strips} title={roll.title} className="mt-5 px-4" />
          )}
        </>
      )}

      <CaptureViewer
        captures={captures}
        index={viewerIndex}
        rollTitle={roll.title}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />

      <ShareSheet roll={roll} open={shareOpen} onOpenChange={setShareOpen} />

      <SheetRoot open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Modal
          title={`Delete "${roll.title}"?`}
          description={`This removes ${formatCount(captures.length, "photo")} from this device. It can't be undone.`}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await deleteRoll(roll.id);
                  router.push("/rolls");
                }}
              >
                Delete
              </Button>
            </>
          }
        />
      </SheetRoot>
    </div>
  );
}

function DevelopingState({
  now,
  revealAt,
  shotsTaken,
  shotLimit,
  onDevelop,
}: {
  now: number;
  revealAt: number;
  shotsTaken: number;
  shotLimit: number | null;
  onDevelop: () => void;
}) {
  return (
    <section className="mt-8 px-4">
      <div className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center">
        <Lock className="mx-auto size-6 text-ink-500" aria-hidden />
        <h2 className="mt-4 font-display text-2xl text-ink-100">Still developing</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-400">
          {shotsTaken > 0
            ? `${formatCount(shotsTaken, "shot")} on the roll${shotLimit ? ` of ${shotLimit}` : ""}. `
            : "Nothing on the roll yet. "}
          Everything opens {formatTimeUntil(revealAt, now)}.
        </p>
        <Button variant="ghost" className="mt-5" onClick={onDevelop}>
          Develop it now
        </Button>
        <p className="mt-1 text-xs text-ink-600">Waiting is better, but it&rsquo;s your roll.</p>
      </div>
    </section>
  );
}

function EmptyRoll({ rollId }: { rollId: string }) {
  return (
    <div className="mt-10 px-6 text-center">
      <p className="font-display text-2xl text-ink-100">This roll is still blank.</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-400">
        Open the camera and take the first one. Nobody ever regrets the first photo.
      </p>
      <Link
        href={`/camera?roll=${rollId}`}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-paper px-5 text-sm font-medium text-ink-900"
      >
        <Camera className="size-4" aria-hidden />
        Start shooting
      </Link>
    </div>
  );
}
