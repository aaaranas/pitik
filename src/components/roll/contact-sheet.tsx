"use client";

import { Heart, Users } from "lucide-react";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { Capture } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * The roll gallery, laid out like a proof sheet.
 *
 * Frames are numbered in shooting order and sit shoulder to shoulder with a
 * hairline gutter — the reading experience of a contact sheet, where the
 * sequence is part of the story. Only thumbnails are decoded here; full frames
 * load when a frame is opened.
 */

function Frame({
  capture,
  index,
  onOpen,
}: {
  capture: Capture;
  index: number;
  onOpen: () => void;
}) {
  const url = useObjectUrl(capture.thumb);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden bg-ink-900 outline-offset-2"
      aria-label={`Frame ${index + 1}${capture.favorite ? ", favourite" : ""}${
        capture.authorId ? ", added by someone else" : ""
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="block size-full animate-pulse bg-ink-800" />
      )}

      <span
        aria-hidden
        className="absolute left-1 top-1 font-mono text-[0.5625rem] text-white/70 mix-blend-difference"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {capture.favorite ? (
        <Heart
          aria-hidden
          className="absolute bottom-1 right-1 size-3.5 fill-safelight-500 text-safelight-500 drop-shadow"
        />
      ) : null}

      {/* A frame with an author came from somebody else's device, via a shared
          roll. Worth marking: half the pleasure of a shared roll is seeing what
          the other person saw. */}
      {capture.authorId ? (
        <Users aria-hidden className="absolute bottom-1 left-1 size-3.5 text-white/80 drop-shadow" />
      ) : null}
    </button>
  );
}

export function ContactSheet({
  captures,
  onOpen,
  className,
}: {
  captures: Capture[];
  onOpen: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Hairline gutters show the page beneath rather than a lighter fill:
        // a partially-filled last row would otherwise paint a bright block
        // across the empty cells, which reads as a rendering fault.
        "grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-6",
        className,
      )}
    >
      {captures.map((capture, index) => (
        <Frame
          key={capture.id}
          capture={capture}
          index={index}
          onOpen={() => onOpen(index)}
        />
      ))}
    </div>
  );
}
