"use client";

import { cn } from "@/lib/utils";

/**
 * Composition guides drawn over the viewfinder.
 *
 * Hairlines at 30% opacity: enough to align a horizon against, faint enough
 * that you stop seeing them while you frame.
 */
export function GridOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
    </div>
  );
}

/**
 * Horizon indicator.
 *
 * Reads device tilt from the accelerometer where it's permitted; when it isn't
 * — which is every iOS browser that hasn't been granted motion access — the
 * component renders nothing rather than showing a level that never moves.
 */
export function LevelIndicator({ roll }: { roll: number | null }) {
  if (roll === null) return null;
  const level = Math.abs(roll) < 2;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center"
      aria-hidden
    >
      <div
        className={cn(
          "h-px w-24 origin-center transition-colors duration-200",
          level ? "bg-safelight-400" : "bg-white/40",
        )}
        style={{ transform: `rotate(${-roll}deg)` }}
      />
    </div>
  );
}
