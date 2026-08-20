"use client";

/**
 * Tap-to-focus feedback.
 *
 * Drawn wherever the user tapped, whether or not the device honoured the focus
 * request — the reticle acknowledges the *tap*. Whether focus actually moved is
 * reported separately by the camera service; pretending a tap did nothing when
 * the user clearly touched the screen feels broken even when it's honest.
 */
export interface FocusPoint {
  x: number;
  y: number;
  id: number;
}

export function FocusReticle({ point }: { point: FocusPoint | null }) {
  if (!point) return null;
  return (
    <div
      key={point.id}
      aria-hidden
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
    >
      <div className="size-16 animate-[rise_320ms_var(--ease-shutter)] rounded-lg border border-amber-warm/90 shadow-[0_0_12px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-x-1/2 top-0 h-2 w-px -translate-x-1/2 bg-amber-warm/90" />
        <div className="absolute inset-x-1/2 bottom-0 h-2 w-px -translate-x-1/2 bg-amber-warm/90" />
        <div className="absolute inset-y-1/2 left-0 h-px w-2 -translate-y-1/2 bg-amber-warm/90" />
        <div className="absolute inset-y-1/2 right-0 h-px w-2 -translate-y-1/2 bg-amber-warm/90" />
      </div>
    </div>
  );
}
