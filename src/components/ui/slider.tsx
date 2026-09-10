"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single-value slider for camera controls.
 *
 * Styled as a thin track with an oversized invisible hit area — the visible
 * rail is a 4px hairline (a 2px line reads fine on near-black but disappears
 * on cream) while the thumb and the padding around it are what your finger
 * actually needs to find.
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
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-pill bg-cream-300 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1">
      <SliderPrimitive.Range className="absolute h-full bg-sky-base data-[orientation=vertical]:w-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-5 rounded-pill border-2 border-cream-50 bg-sky-deep shadow-[0_1px_4px_color-mix(in_srgb,var(--color-cocoa-900)_25%,transparent)] transition-transform active:scale-110 disabled:opacity-40"
      aria-label={props["aria-label"]}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
