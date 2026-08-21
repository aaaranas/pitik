import { cn } from "@/lib/utils";

/**
 * The Pitik mark: a lens ring with a safelight iris, matching the app icon.
 * Drawn as inline SVG so it inherits colour and never blocks first paint.
 */
export function PitikMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="9.6" fill="none" stroke="currentColor" strokeWidth="2.9" />
      <circle cx="16" cy="16" r="4.6" className="fill-safelight-500" />
      <circle cx="6.6" cy="6.6" r="1.45" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <PitikMark className="size-6 text-paper" />
      <span className="font-display text-3xl leading-none tracking-[0.03em] text-paper">
        Pitik
      </span>
    </span>
  );
}
