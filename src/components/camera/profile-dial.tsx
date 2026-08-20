"use client";

import { useEffect, useRef } from "react";
import type { CameraProfile } from "@/lib/filters/types";
import { cn } from "@/lib/utils";

/**
 * The mode dial.
 *
 * Modelled on the click-wheel across the top of a compact camera: names in a
 * row, the selected one under a fixed marker. Implemented as a scroll-snap
 * strip so it responds to a thumb flick with real momentum, and to arrow keys
 * for anyone driving it from a keyboard.
 */
export function ProfileDial({
  profiles,
  selectedId,
  onSelect,
  className,
}: {
  profiles: CameraProfile[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[data-selected="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId]);

  const index = Math.max(
    0,
    profiles.findIndex((profile) => profile.id === selectedId),
  );

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Camera profile"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = (index + delta + profiles.length) % profiles.length;
            onSelect(profiles[next].id);
          }
        }}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-[42%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {profiles.map((profile) => {
          const selected = profile.id === selectedId;
          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              onClick={() => onSelect(profile.id)}
              className={cn(
                "shrink-0 snap-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors",
                selected ? "text-safelight-400" : "text-ink-400 hover:text-ink-200",
              )}
            >
              {profile.name}
            </button>
          );
        })}
      </div>
      {/* Fixed marker beneath the strip, the way a dial has an index mark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-0.5 flex justify-center"
      >
        <div className="h-px w-8 bg-safelight-500" />
      </div>
    </div>
  );
}
