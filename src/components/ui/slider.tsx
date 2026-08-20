"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single-value slider for camera controls.
 *
 * Styled as a thin track with an oversized invisible hit area — the visible
 * rail can be 2px because the thumb and the padding around it are what your
 * finger actually needs to find.
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
    <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden rounded-full bg-ink-600 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5">
      <SliderPrimitive.Range className="absolute h-full bg-safelight-500 data-[orientation=vertical]:w-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-5 rounded-full border-2 border-ink-950 bg-paper shadow-md shadow-black/40 transition-transform active:scale-110 disabled:opacity-40"
      aria-label={props["aria-label"]}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
