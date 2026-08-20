import {
  clamp,
  FADE_LIFT,
  hexToRgb,
  whiteBalanceGains,
} from "./math";
import type { Adjustments } from "./types";

/**
 * The live-preview renderer.
 *
 * Preview runs at 60fps over a video element, so it must cost the compositor
 * and nothing else — no per-frame JavaScript, no readback, no canvas. Every
 * adjustment is therefore expressed as either a CSS `filter` function or a
 * static overlay layer, both of which the browser can hand straight to the GPU.
 *
 * It is an approximation of {@link renderToCanvas}, not a duplicate of it.
 * Where the two can't agree — spatial effects like bloom and unsharp masking —
 * the preview errs toward *understating* the effect, so the exported frame is
 * never less flattering than what the user was looking at.
 */

export interface OverlayLayer {
  /** CSS `background` shorthand. */
  background: string;
  blendMode: string;
  opacity: number;
  /** Marks the tiled noise layer so consumers can disable it for performance. */
  kind: "cast" | "split" | "fade" | "vignette" | "grain";
}

export interface CssPreview {
  /** Value for the `filter` property on the video/image element. */
  filter: string;
  /** Layers to stack above it, in order, each absolutely positioned. */
  layers: OverlayLayer[];
}

/**
 * A tiled monochrome noise tile. Generated once as a data URI rather than per
 * frame — grain that crawls between frames reads as video compression noise,
 * not film.
 */
export const GRAIN_TILE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
      "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='160' height='160' filter='url(#g)'/></svg>",
  );

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

export function toCssPreview(adj: Adjustments): CssPreview {
  const functions: string[] = [];

  // Exposure and brightness are both linear gains, so they collapse into one
  // CSS brightness() — matching step 1+2 of the canvas pipeline exactly.
  const gain = Math.pow(2, adj.exposure) * adj.brightness;
  if (Math.abs(gain - 1) > 0.001) functions.push(`brightness(${gain.toFixed(3)})`);

  // Shadow/highlight lifts have no CSS equivalent. Fold their *net* effect into
  // contrast so the preview at least moves in the right direction: lifting
  // shadows while pulling highlights flattens the image, and vice versa.
  const tonalFlatten = adj.shadows * 0.18 - adj.highlights * 0.14;
  const contrast = clamp(adj.contrast - tonalFlatten, 0, 4);
  if (Math.abs(contrast - 1) > 0.001) functions.push(`contrast(${contrast.toFixed(3)})`);

  if (Math.abs(adj.saturation - 1) > 0.001) {
    functions.push(`saturate(${adj.saturation.toFixed(3)})`);
  }

  // Bloom is a spatial effect; a sub-pixel blur is the closest the compositor
  // can get for free, and it reads as the same softness at preview size.
  if (adj.bloom > 0.01) {
    functions.push(`blur(${(adj.bloom * 0.7).toFixed(2)}px)`);
  }

  const layers: OverlayLayer[] = [];

  // Step 6 — white balance. `soft-light` shifts hue without flattening the
  // image the way a `multiply` wash would.
  const [rGain, gGain, bGain] = whiteBalanceGains(adj);
  const castStrength = Math.max(
    Math.abs(rGain - 1),
    Math.abs(gGain - 1),
    Math.abs(bGain - 1),
  );
  if (castStrength > 0.005) {
    const cast: [number, number, number] = [
      Math.round(clamp(rGain / 2, 0, 1) * 255),
      Math.round(clamp(gGain / 2, 0, 1) * 255),
      Math.round(clamp(bGain / 2, 0, 1) * 255),
    ];
    layers.push({
      background: rgba(cast, 1),
      blendMode: "soft-light",
      opacity: clamp(castStrength * 4, 0, 0.85),
      kind: "cast",
    });
  }

  // Step 7 — split toning. `multiply` only darkens (so it can only touch the
  // shadow end) and `screen` only lightens (so it can only touch highlights),
  // which is exactly the luma weighting the canvas renderer computes properly.
  if (adj.splitShadow && adj.splitShadow.amount > 0.01) {
    layers.push({
      background: rgba(hexToRgb(adj.splitShadow.color), 1),
      blendMode: "multiply",
      opacity: adj.splitShadow.amount * 0.55,
      kind: "split",
    });
  }
  if (adj.splitHighlight && adj.splitHighlight.amount > 0.01) {
    layers.push({
      background: rgba(hexToRgb(adj.splitHighlight.color), 1),
      blendMode: "screen",
      opacity: adj.splitHighlight.amount * 0.4,
      kind: "split",
    });
  }

  // Step 5 — fade. `lighten` clamps every channel to at least the lift value,
  // which is precisely "the blacks can no longer reach zero".
  if (adj.fade > 0.01) {
    const lift = Math.round(FADE_LIFT * adj.fade * 255);
    layers.push({
      // Warm lift: aged prints fade toward cream, not neutral grey.
      background: `rgb(${lift + 6}, ${lift + 2}, ${lift})`,
      blendMode: "lighten",
      opacity: 1,
      kind: "fade",
    });
  }

  if (adj.vignette > 0.01) {
    const inner = (1 - adj.vignette * 0.45) * 100;
    layers.push({
      background: `radial-gradient(ellipse at center, rgba(255,255,255,1) ${inner.toFixed(0)}%, rgba(${Math.round(
        120 * (1 - adj.vignette),
      )},${Math.round(115 * (1 - adj.vignette))},${Math.round(110 * (1 - adj.vignette))},1) 100%)`,
      blendMode: "multiply",
      opacity: 1,
      kind: "vignette",
    });
  }

  if (adj.grain > 0.01) {
    layers.push({
      background: `url("${GRAIN_TILE}") repeat`,
      blendMode: "overlay",
      opacity: adj.grain * 0.45,
      kind: "grain",
    });
  }

  return { filter: functions.join(" ") || "none", layers };
}

/**
 * Flattens a preview into inline styles for a single element. Used by the
 * filter chips, where stacking six overlay divs per chip would be wasteful.
 */
export function toCssFilterString(adj: Adjustments): string {
  return toCssPreview(adj).filter;
}
