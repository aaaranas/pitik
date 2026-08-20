"use client";

import { cn } from "@/lib/utils";

/**
 * The shutter.
 *
 * The one control that must never feel like a web page. It is deliberately
 * oversized, sits in the thumb arc, and responds on `pointerdown` rather than
 * `click` so the ring collapses at the instant of the press — the ~80ms a click
 * event waits is exactly the gap that makes a camera feel laggy.
 */
export interface ShutterButtonProps {
  onCapture: () => void;
  disabled?: boolean;
  /** Renders the countdown numeral in place of the shutter. */
  countdown?: number | null;
  busy?: boolean;
  label?: string;
}

export function ShutterButton({
  onCapture,
  disabled,
  countdown,
  busy,
  label = "Take a photo",
}: ShutterButtonProps) {
  const counting = typeof countdown === "number" && countdown > 0;

  return (
    <button
      type="button"
      aria-label={counting ? `Capturing in ${countdown}` : label}
      disabled={disabled || counting}
      onPointerDown={(event) => {
        // Primary pointer only: a stray palm contact shouldn't fire a frame.
        if (event.isPrimary && !disabled && !counting) onCapture();
      }}
      className={cn(
        "group relative grid size-[4.75rem] shrink-0 place-items-center rounded-full",
        "outline-offset-4 disabled:opacity-60",
      )}
    >
      {/* Outer ring — the fixed body of the button. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full border-[3px] transition-colors duration-200",
          counting ? "border-safelight-500" : "border-paper/90",
        )}
      />
      {/* Inner disc — collapses under the thumb. */}
      <span
        aria-hidden
        className={cn(
          "size-[3.75rem] rounded-full bg-paper transition-transform duration-100 ease-out",
          "group-active:scale-[0.86]",
          busy && "animate-pulse",
          counting && "scale-[0.7] bg-safelight-500",
        )}
      />
      {counting ? (
        <span className="absolute font-display text-3xl text-white tabular-nums">
          {countdown}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The white blink after a capture.
 *
 * Keyed by capture count so React remounts it — restarting a CSS animation by
 * toggling a class requires a reflow hack that is easy to get subtly wrong.
 */
export function ShutterFlash({ flashKey }: { flashKey: number }) {
  if (!flashKey) return null;
  return (
    <div
      key={flashKey}
      aria-hidden
      className="animate-shutter-flash pointer-events-none absolute inset-0 z-30 bg-white"
    />
  );
}
