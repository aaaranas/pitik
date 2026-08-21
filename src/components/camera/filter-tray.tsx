"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toCssPreview } from "@/lib/filters/css";
import { resolveFilter } from "@/lib/filters/registry";
import type { FilterDefinition } from "@/lib/filters/types";
import { cn } from "@/lib/utils";

/**
 * Filter chips, previewed on the user's own frame.
 *
 * The chips show a still grabbed from the live camera a moment ago rather than
 * stock swatches, so you are choosing a look for *this* light and *these*
 * faces. Grabbing one frame every few seconds costs a single 96px draw, which
 * is nothing next to running the grade continuously in twenty thumbnails.
 */

const REFERENCE_WIDTH = 112;
const REFRESH_MS = 2500;

export function useReferenceFrame(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): string | null {
  const [frame, setFrame] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const grab = () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      const height = Math.round((REFERENCE_WIDTH * video.videoHeight) / video.videoWidth);
      canvas.width = REFERENCE_WIDTH;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, REFERENCE_WIDTH, height);
      // A data URL rather than a blob URL: these are tiny, they change often,
      // and there is no object URL left behind to leak.
      setFrame(canvas.toDataURL("image/jpeg", 0.6));
    };

    grab();
    const timer = window.setInterval(grab, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [videoRef, active]);

  return frame;
}

interface FilterChipProps {
  filter: FilterDefinition;
  selected: boolean;
  referenceFrame: string | null;
  onSelect: () => void;
}

function FilterChip({ filter, selected, referenceFrame, onSelect }: FilterChipProps) {
  const preview = useMemo(() => toCssPreview(resolveFilter(filter.id).adjustments), [filter.id]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 outline-offset-4"
    >
      <span
        className={cn(
          "relative block size-16 overflow-hidden rounded-xl bg-ink-800 transition",
          selected
            ? "ring-2 ring-safelight-500 ring-offset-2 ring-offset-ink-950"
            : "ring-1 ring-white/10",
        )}
      >
        {referenceFrame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referenceFrame}
            alt=""
            aria-hidden
            className="size-full object-cover"
            style={{ filter: preview.filter }}
          />
        ) : (
          // Before the first frame arrives, a neutral reference gradient still
          // shows the grade's direction rather than an empty grey box.
          <span
            aria-hidden
            className="block size-full"
            style={{
              background:
                "linear-gradient(150deg, #f2d9c0 0%, #c98d6d 38%, #4a5568 72%, #16181d 100%)",
              filter: preview.filter,
            }}
          />
        )}
        {preview.layers.map((layer, index) => (
          <span
            key={index}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: layer.background,
              mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
              opacity: layer.opacity,
            }}
          />
        ))}
      </span>
      {/* Maker above model, as it is moulded into a real body. Model names run
          long — "Handycam DCR-TRV350" — so this wraps rather than truncating a
          camera down to something you cannot identify. */}
      <span className="flex w-full flex-col items-center gap-0.5">
        {filter.maker ? (
          <span
            className={cn(
              "max-w-full truncate font-mono text-[0.5rem] uppercase leading-none tracking-[0.14em] transition-colors",
              selected ? "text-safelight-400/80" : "text-ink-500 group-hover:text-ink-400",
            )}
          >
            {filter.maker}
          </span>
        ) : null}
        <span
          className={cn(
            "w-full text-balance text-center text-[0.625rem] leading-tight transition-colors",
            selected ? "text-safelight-400" : "text-ink-300 group-hover:text-ink-100",
          )}
        >
          {filter.name}
        </span>
      </span>
    </button>
  );
}

export interface FilterTrayProps {
  filters: FilterDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  referenceFrame: string | null;
  className?: string;
}

export function FilterTray({
  filters,
  selectedId,
  onSelect,
  referenceFrame,
  className,
}: FilterTrayProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the active chip on screen when the selection changes from elsewhere
  // (a swipe on the viewfinder, or restoring the last-used filter on open).
  useEffect(() => {
    const container = scrollRef.current;
    const active = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId]);

  return (
    <div
      ref={scrollRef}
      role="group"
      aria-label="Filters"
      className={cn(
        "flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-2",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          selected={filter.id === selectedId}
          referenceFrame={referenceFrame}
          onSelect={() => onSelect(filter.id)}
        />
      ))}
    </div>
  );
}
