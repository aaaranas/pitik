import { cn } from "@/lib/utils";

/**
 * The Pitik mark: a lens barrel in ink with a sky iris and a viewfinder tick
 * at ten o'clock.
 *
 * The geometry is the same drawing as the app icon — `scripts/generate-icons.mjs`
 * works in fractions of the icon's edge, and these numbers are those fractions
 * on a 32-unit viewBox (barrel 0.345/0.215, iris 0.133, tick 0.435 at 135°).
 * If one moves, move the other: the installed icon and the in-app mark being
 * visibly different marks is worse than either being imperfect.
 *
 * What the icon has and this deliberately does not is the hard blush offset.
 * This renders at 16–32px, where a proportional offset lands on a single pixel
 * and reads as a smudge on the barrel rather than as ink printed twice — the
 * same reason the 32px favicon goes without it.
 *
 * Drawn as inline SVG so it inherits colour and never blocks first paint.
 */
export function PitikMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      {/* Stroked at the barrel's mid-radius, so the painted band spans
          0.215–0.345 of the edge exactly as the icon's annulus does. */}
      <circle cx="16" cy="16" r="8.96" fill="none" stroke="currentColor" strokeWidth="4.16" />
      <circle cx="16" cy="16" r="4.26" className="fill-sky-base" />
      <circle cx="6.16" cy="6.16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <PitikMark className="size-6 text-cocoa-900" />
      <span className="font-display text-3xl leading-none font-extrabold tracking-[-0.04em] text-cocoa-900">
        Pitik
      </span>
    </span>
  );
}
