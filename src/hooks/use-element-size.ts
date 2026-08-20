"use client";

import { useEffect, useRef, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

/**
 * Measures an element, live.
 *
 * Used by the viewfinder, which has to fit a fixed-aspect frame inside whatever
 * space the layout leaves it. Pure CSS cannot do that: `aspect-ratio` with a
 * definite width overflows a short container, and with a definite height it
 * overflows a narrow one. Either way the frame ends up covering the shutter,
 * which is not a cosmetic problem on a camera screen.
 */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  Size,
] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize((current) =>
        // Rounded and compared before setting: sub-pixel resize noise would
        // otherwise re-render the viewfinder continuously.
        Math.round(box.width) === current.width && Math.round(box.height) === current.height
          ? current
          : { width: Math.round(box.width), height: Math.round(box.height) },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

/**
 * The largest box of ratio `aspect` that fits inside `container`.
 * With no ratio, the frame simply fills the space.
 */
export function fitBox(container: Size, aspect: number | null): Size {
  if (!container.width || !container.height) return { width: 0, height: 0 };
  if (!aspect) return container;
  const byWidth = { width: container.width, height: container.width / aspect };
  return byWidth.height <= container.height
    ? byWidth
    : { width: container.height * aspect, height: container.height };
}
