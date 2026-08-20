"use client";

import { PAPERS, paperBackgroundCss, type BoothTemplate } from "@/lib/booth/types";
import { cn } from "@/lib/utils";

/**
 * A scale drawing of a template.
 *
 * Rendered from the same geometry the compositor uses, so what you pick is
 * literally what gets printed — no hand-drawn preview to fall out of sync when
 * a layout is adjusted.
 */
export function TemplateThumb({
  template,
  maxHeight = 176,
  className,
}: {
  template: BoothTemplate;
  /** Tallest the drawing may be, in pixels. Width follows from the aspect. */
  maxHeight?: number;
  className?: string;
}) {
  const paper = PAPERS[template.defaultPaper];
  const aspect = template.width / template.height;

  return (
    <div
      className={cn("relative overflow-hidden rounded-sm shadow-md shadow-black/30", className)}
      style={{
        // Two constraints, both expressed in CSS so no measurement is needed:
        // the drawing fills its column, and `maxWidth` is set to exactly the
        // width at which the derived height would hit `maxHeight`. A 1:3 strip
        // and a 2.3:1 wide strip therefore both fit the same slot.
        width: "100%",
        maxWidth: `${Math.round(maxHeight * aspect)}px`,
        aspectRatio: aspect,
        background: paperBackgroundCss(paper),
      }}
      aria-hidden
    >
      {template.slots.map((slot, index) => (
        <div
          key={index}
          className="absolute"
          style={{
            left: `${(slot.x / template.width) * 100}%`,
            top: `${(slot.y / template.height) * 100}%`,
            width: `${(slot.width / template.width) * 100}%`,
            height: `${(slot.height / template.height) * 100}%`,
            borderRadius: `${(slot.radius ?? 0) / 6}px`,
            // A neutral photographic gradient rather than flat grey, so the
            // thumbnail reads as "photos go here" at 80px wide.
            background: "linear-gradient(155deg, #b9a695 0%, #6d6157 55%, #2c2823 100%)",
          }}
        />
      ))}
      {template.caption ? (
        <div
          className="absolute h-px"
          style={{
            left: "28%",
            width: "44%",
            top: `${((template.caption.y - template.caption.size * 0.35) / template.height) * 100}%`,
            background: paper.muted,
            opacity: 0.45,
          }}
        />
      ) : null}
    </div>
  );
}
