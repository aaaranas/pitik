"use client";

import { Download, Film, Share2 } from "lucide-react";
import { useState } from "react";
import { ClipDialog } from "@/components/booth/clip-dialog";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { Strip } from "@/lib/db/types";
import { downloadBlob, extensionFor, shareFile } from "@/lib/share";
import { cn, relativeDay, slugify } from "@/lib/utils";

/**
 * Saved booth strips, with their clips.
 *
 * Shared by the booth shelf and by a roll's Strips tab so a strip offers the
 * same three things wherever it appears: save it, send it, watch the shoot.
 */
export function StripGrid({
  strips,
  title,
  className,
}: {
  strips: Strip[];
  /** Used for exported filenames when a strip has no caption. */
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3", className)}>
      {strips.map((strip) => (
        <StripTile key={strip.id} strip={strip} title={title} />
      ))}
    </div>
  );
}

function StripTile({ strip, title }: { strip: Strip; title: string }) {
  const url = useObjectUrl(strip.thumb);
  const [clipOpen, setClipOpen] = useState(false);
  const filename = `pitik-${slugify(strip.caption || title)}-strip.${extensionFor(strip.blob)}`;

  return (
    <figure className="group relative">
      <ClipDialog
        clip={strip.motion ?? null}
        title={strip.caption || title}
        open={clipOpen}
        onOpenChange={setClipOpen}
      />

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={strip.caption ?? "Photo strip"}
          loading="lazy"
          className="w-full rounded-sm shadow-lg shadow-black/40"
        />
      ) : (
        <div className="aspect-[1/3] w-full animate-pulse rounded-sm bg-ink-900" />
      )}

      <figcaption className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-ink-400">
          {strip.caption || relativeDay(strip.createdAt)}
        </span>
        <span className="flex gap-1">
          <TileAction label="Save this strip" onClick={() => downloadBlob(strip.blob, filename)}>
            <Download className="size-3.5" />
          </TileAction>
          <TileAction
            label="Share this strip"
            onClick={() => void shareFile({ blob: strip.blob, filename, title })}
          >
            <Share2 className="size-3.5" />
          </TileAction>
          {/* A clip saved with the strip has to stay reachable, or it is data
              the user can never get back out. */}
          {strip.motion ? (
            <TileAction label="Watch the clip of this shoot" onClick={() => setClipOpen(true)}>
              <Film className="size-3.5" />
            </TileAction>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

function TileAction({
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
      className="grid size-7 place-items-center rounded-full text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
    >
      {children}
    </button>
  );
}
