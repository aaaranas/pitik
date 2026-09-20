"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DialItem {
  id: string;
  name: string;
  /** Printed small above the model, the way a real body is badged. */
  maker?: string;
}

/**
 * The model dial.
 *
 * Modelled on the click-wheel across the top of a compact camera: names in a
 * row, the selected one under a fixed marker. Implemented as a scroll-snap
 * strip so it responds to a thumb flick with real momentum, and to arrow keys
 * for anyone driving it from a keyboard.
 *
 * `selectedId` may match nothing — a look chosen from the full filter tray is
 * not one of the bodies on the dial — in which case no entry is marked, which
 * is honest rather than highlighting something that isn't in force.
 */
export function ProfileDial({
  items,
  selectedId,
  label = "Camera model",
  onSelect,
  className,
}: {
  items: DialItem[];
  selectedId: string;
  label?: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[data-selected="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId]);

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const index = Math.max(0, selectedIndex);
  /** A look chosen from the full tray is not one of the bodies on the dial. */
  const onDial = selectedIndex >= 0;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = (index + delta + items.length) % items.length;
            onSelect(items[next].id);
          }
        }}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-[42%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex shrink-0 snap-center flex-col items-center gap-0.5 whitespace-nowrap rounded-pill px-3 py-1 transition-colors",
                selected
                  ? "ring-2 ring-inset ring-sky-deep text-cocoa-900"
                  : "text-cocoa-600 hover:text-cocoa-900",
              )}
            >
              {/* Badged like a maker's mark on a real body: mono tracked
                  caps. The model name underneath stays legible sans — this
                  is a list to scan, not a plate to read once. */}
              {item.maker ? (
                <span className="font-mono text-[0.5rem] uppercase leading-none tracking-[0.14em]">
                  {item.maker}
                </span>
              ) : null}
              <span className="font-sans text-[0.6875rem] leading-none">{item.name}</span>
            </button>
          );
        })}
      </div>
      {/* Fixed marker beneath the strip, the way a dial has an index mark.
          Hidden when the active look is not on the dial at all — the mark sits
          at a fixed position, so leaving it up would point at whichever entry
          happened to be centred and imply it was selected. */}
      {onDial ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-0.5 flex justify-center"
        >
          <div className="h-px w-8 bg-sky-deep" />
        </div>
      ) : null}
    </div>
  );
}
