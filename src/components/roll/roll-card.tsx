"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useMinute } from "@/hooks/use-now";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { CoverStyle, Roll } from "@/lib/db/types";
import { formatCount, formatTimeUntil, relativeDay } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * A roll, as a physical object.
 *
 * Each cover style is its own pastel surface — cream, a cool tinted proof, a
 * deeper cream, a bright white instant frame — so at a glance down the home
 * screen the shape and tone alone tell you which roll is which before you've
 * read a single title. Each also carries its own `.slab-<hue>` shadow, so a
 * library of rolls reads as a pile of different objects rather than a
 * uniform grid: sky is reserved for "contact" (its bare `.slab` default,
 * kept for the sheet that already reads as cool and proof-like), blush is
 * left alone entirely because it already means "danger" on the delete
 * button and the disposable-roll countdown.
 */

const COVER_SURFACE: Record<CoverStyle, string> = {
  envelope: "bg-cream-50 text-cocoa-900",
  contact: "bg-sky-tint text-sky-deep",
  sleeve: "bg-cream-200 text-cocoa-900",
  polaroid: "bg-white text-cocoa-900",
};

/** The shadow modifier per cover, on top of the shared `.slab` border. Empty
 * string keeps `.slab`'s own default (sky) shadow. */
const COVER_SLAB: Record<CoverStyle, string> = {
  envelope: "slab-butter",
  contact: "",
  sleeve: "slab-mint",
  polaroid: "slab-lilac",
};

/** Muted text on each cover: full-strength, never dimmed with opacity — an
 * opacity modifier on top of these fills falls well short of 4.5:1. */
const COVER_MUTED: Record<CoverStyle, string> = {
  envelope: "text-cocoa-600",
  contact: "text-sky-deep",
  sleeve: "text-cocoa-600",
  polaroid: "text-cocoa-600",
};

export function RollCard({
  roll,
  count,
  cover,
}: {
  roll: Roll;
  count: number;
  cover?: Blob;
}) {
  const coverUrl = useObjectUrl(cover ?? null);
  const now = useMinute();
  const undeveloped =
    roll.mode === "disposable" &&
    !roll.developedAt &&
    roll.revealAt !== null &&
    roll.revealAt > now;

  return (
    <Link
      href={`/rolls/${roll.id}`}
      className="group block focus-visible:outline-none"
      aria-label={`${roll.title}, ${formatCount(count, "photo")}`}
    >
      <article
        className={cn(
          "soft-grain slab relative overflow-hidden transition-transform duration-200",
          "group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-sky-deep",
          COVER_SLAB[roll.coverStyle],
          COVER_SURFACE[roll.coverStyle],
        )}
      >
        <div
          className={cn(
            "relative z-[2] aspect-[4/3] w-full overflow-hidden",
            roll.coverStyle === "polaroid" && "mx-auto mt-1 w-[calc(100%-1.5rem)] aspect-square",
          )}
        >
          {coverUrl && !undeveloped ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center bg-cocoa-900/10">
              {undeveloped ? (
                <div className={cn("text-center", COVER_MUTED[roll.coverStyle])}>
                  <Lock className="mx-auto size-5" aria-hidden />
                  <p className="mt-1.5 text-[0.6875rem]">Developing</p>
                </div>
              ) : (
                <p className={cn("text-[0.6875rem]", COVER_MUTED[roll.coverStyle])}>Empty</p>
              )}
            </div>
          )}
        </div>

        <div className="relative z-[2] px-3 pb-3 pt-2.5">
          <h3 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {roll.emoji ? <span className="mr-1.5">{roll.emoji}</span> : null}
            {roll.title}
          </h3>
          <p className={cn("counter mt-0.5", COVER_MUTED[roll.coverStyle])}>
            {undeveloped && roll.revealAt
              ? `Ready ${formatTimeUntil(roll.revealAt, now)}`
              : `${formatCount(count, "photo")} · ${relativeDay(roll.updatedAt, now || undefined)}`}
          </p>
        </div>
      </article>
    </Link>
  );
}
