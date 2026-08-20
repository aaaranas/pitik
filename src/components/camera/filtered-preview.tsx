"use client";

import { useMemo } from "react";
import { fitBox, useElementSize } from "@/hooks/use-element-size";
import { toCssPreview } from "@/lib/filters/css";
import type { Adjustments } from "@/lib/filters/types";
import { cn } from "@/lib/utils";

/**
 * The live viewfinder.
 *
 * Every graded pixel here is produced by the compositor, not by JavaScript:
 * one CSS `filter` on the video element plus a handful of blended overlay
 * divs. Nothing in this component runs per frame, which is what lets the
 * preview hold 60fps on a mid-range phone while the sensor is streaming 4K.
 *
 * The frame is measured and sized to fit the space it is given, rather than
 * being shaped by `aspect-ratio` alone — see {@link fitBox}. An overflowing
 * viewfinder does not merely look wrong, it sits on top of the shutter and
 * swallows the taps meant for it.
 */

export interface FilteredPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  adjustments: Adjustments;
  mirrored: boolean;
  /** `null` fills the container with the sensor's native framing. */
  aspectRatio: number | null;
  /** Set false on low-end devices to shoot with an ungraded preview. */
  livePreview?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FilteredPreview({
  videoRef,
  adjustments,
  mirrored,
  aspectRatio,
  livePreview = true,
  className,
  children,
}: FilteredPreviewProps) {
  // Recomputed only when the grade changes — never on a render caused by, say,
  // the shutter animation.
  const preview = useMemo(() => toCssPreview(adjustments), [adjustments]);
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>();
  const frame = useMemo(
    () => fitBox(containerSize, aspectRatio),
    [containerSize, aspectRatio],
  );

  return (
    <div ref={containerRef} className={cn("grid size-full place-items-center", className)}>
      <div
        className="relative isolate overflow-hidden rounded-2xl bg-ink-950"
        style={{ width: frame.width || "100%", height: frame.height || "100%" }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          // Decorative: the frame's meaning is the live scene, which no alt text
          // can convey. Controls around it carry the accessible labels.
          aria-hidden
          className="size-full object-cover"
          style={{
            filter: livePreview ? preview.filter : undefined,
            transform: mirrored ? "scaleX(-1)" : undefined,
          }}
        />

        {livePreview
          ? preview.layers.map((layer, index) => (
              <div
                key={`${layer.kind}-${index}`}
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: layer.background,
                  mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
                  opacity: layer.opacity,
                }}
              />
            ))
          : null}

        {children}
      </div>
    </div>
  );
}
