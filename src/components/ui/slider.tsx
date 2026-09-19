"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single-value slider for camera controls.
 *
 * Styled as an ink-bordered track with an oversized invisible hit area — the
 * thumb and the padding around it are what your finger actually needs to
 * find. The thumb keeps a real `cocoa-900` boundary against both the empty
 * track (7.59:1) and the filled range (5.90:1); a previous cream-on-sky knob
 * measured 1.29:1 and was effectively invisible.
 */
export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-3",
      "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-3 data-[orientation=vertical]:py-0",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-slab border-2 border-cocoa-900 bg-cream-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5">
      <SliderPrimitive.Range className="absolute h-full bg-sky-base data-[orientation=vertical]:w-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-5 rounded-slab border-2 border-cocoa-900 bg-cream-50 transition-transform active:scale-110 disabled:opacity-40"
      aria-label={props["aria-label"]}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
