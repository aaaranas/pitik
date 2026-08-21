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
 * Each cover style borrows from a different piece of darkroom furniture — a
 * negative envelope, a proof sheet, a print sleeve, an instant frame. They are
 * decoration with a job: at a glance down the home screen, the shape alone
 * tells you which roll is which before you've read a single title.
 */

const COVER_SURFACE: Record<CoverStyle, string> = {
  envelope: "bg-paper text-ink-900",
  contact: "bg-ink-900 text-ink-100",
  sleeve: "bg-paper-dim text-ink-900",
  polaroid: "bg-white text-ink-900",
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
          "paper-grain relative overflow-hidden rounded-lg shadow-lg shadow-black/40 transition-transform duration-200",
          "group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-safelight-400",
          COVER_SURFACE[roll.coverStyle],
        )}
      >
        {/* Sprocket edge — the tell that this is film and not a content card. */}
        <div
          aria-hidden
          className="sprockets h-3 w-full opacity-[0.18]"
          style={{ backgroundPosition: "0 center" }}
        />

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
            <div className="grid size-full place-items-center bg-ink-800/10">
              {undeveloped ? (
                <div className="text-center">
                  <Lock className="mx-auto size-5 opacity-50" aria-hidden />
                  <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.16em] opacity-60">
                    Developing
                  </p>
                </div>
              ) : (
                <p className="text-[0.6875rem] uppercase tracking-[0.16em] opacity-40">
                  Empty
                </p>
              )}
            </div>
          )}
        </div>

        <div className="relative z-[2] px-3 pb-3 pt-2.5">
          <h3 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {roll.emoji ? <span className="mr-1.5">{roll.emoji}</span> : null}
            {roll.title}
          </h3>
          <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] opacity-55">
            {undeveloped && roll.revealAt
              ? `Ready ${formatTimeUntil(roll.revealAt, now)}`
              : `${formatCount(count, "photo")} · ${relativeDay(roll.updatedAt, now || undefined)}`}
          </p>
        </div>
      </article>
    </Link>
  );
}
