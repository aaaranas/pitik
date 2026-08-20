/**
 * Pure colour maths shared by both renderers.
 *
 * Nothing in here touches the DOM, which keeps the visual core unit-testable
 * and makes it possible to move the pipeline into a worker or a WASM module
 * later without rewriting the maths.
 *
 * The canonical operation order — obeyed by the canvas renderer and
 * approximated by the CSS renderer — is:
 *
 *   1. exposure           (linear gain)
 *   2. brightness         (linear gain)
 *   3. contrast           (pivot at mid-grey)
 *   4. highlights/shadows (tonal-weighted lift)
 *   5. fade               (black-point lift)
 *   6. temperature/tint   (per-channel gain)
 *   7. split toning       (luma-weighted colour cast)
 *   8. saturation         (luma-preserving lerp)
 *   9. sharpness -> bloom -> vignette -> grain  (spatial, canvas only)
 */

import { type Adjustments, NEUTRAL_ADJUSTMENTS } from "./types";

export const LUT_SIZE = 256;

export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/** Rec. 709 luma. Used for saturation and split-tone weighting. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function resolveAdjustments(...layers: Partial<Adjustments>[]): Adjustments {
  const out: Adjustments = { ...NEUTRAL_ADJUSTMENTS };
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer) as [
      keyof Adjustments,
      Adjustments[keyof Adjustments],
    ][]) {
      if (value === undefined) continue;
      switch (key) {
        // Multiplicative parameters compose by multiplying.
        case "brightness":
        case "contrast":
        case "saturation":
          (out[key] as number) *= value as number;
          break;
        // Additive parameters compose by summing.
        case "exposure":
        case "highlights":
        case "shadows":
        case "temperature":
        case "tint":
          (out[key] as number) += value as number;
          break;
        // Intensities take the stronger of the two.
        case "fade":
        case "vignette":
        case "grain":
        case "sharpness":
        case "bloom":
          (out[key] as number) = Math.max(out[key] as number, value as number);
          break;
        // Tone casts: the later layer wins outright.
        default:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (out as any)[key] = value;
      }
    }
  }
  return out;
}

/** The tone-curve half of the pipeline: steps 1-5, identical for every channel. */
export function toneCurve(v: number, adj: Adjustments): number {
  // 1 + 2: exposure and brightness are both linear gains.
  let out = v * Math.pow(2, adj.exposure) * adj.brightness;

  // 3: contrast pivots at mid-grey so it darkens and brightens symmetrically.
  out = (out - 0.5) * adj.contrast + 0.5;

  // 4: weight each lift toward its own end of the range, so lifting shadows
  // leaves the highlights alone (unlike a plain brightness change).
  const shadowWeight = Math.pow(1 - clamp(out), 2.5);
  const highlightWeight = Math.pow(clamp(out), 2.5);
  out += adj.shadows * 0.45 * shadowWeight;
  out += adj.highlights * 0.45 * highlightWeight;

  // 5: fade compresses the range upward, lifting blacks off zero the way an
  // aged print does. FADE_LIFT is mirrored by the CSS renderer's lift layer.
  if (adj.fade > 0) {
    out = out * (1 - adj.fade * FADE_COMPRESS) + adj.fade * FADE_LIFT;
  }

  return clamp(out);
}

/** Black point that `fade: 1` lifts to, in 0..1. Shared with the CSS renderer. */
export const FADE_LIFT = 0.22;
/** How much `fade: 1` compresses the overall range. */
export const FADE_COMPRESS = 0.25;

/** Per-channel gains for step 6. */
export function whiteBalanceGains(adj: Adjustments): [number, number, number] {
  const t = adj.temperature;
  const i = adj.tint;
  return [
    1 + t * 0.12 + i * 0.05,
    1 - i * 0.1,
    1 - t * 0.12 + i * 0.05,
  ];
}

/**
 * Bakes steps 1-6 into three 256-entry lookup tables.
 *
 * This is what keeps full-resolution export fast: the expensive per-pixel maths
 * runs 768 times instead of once per subpixel of a 12-megapixel frame.
 */
export function buildChannelLuts(adj: Adjustments): [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] {
  const gains = whiteBalanceGains(adj);
  const luts: [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] = [
    new Uint8ClampedArray(LUT_SIZE),
    new Uint8ClampedArray(LUT_SIZE),
    new Uint8ClampedArray(LUT_SIZE),
  ];
  for (let i = 0; i < LUT_SIZE; i++) {
    const toned = toneCurve(i / 255, adj);
    for (let c = 0; c < 3; c++) {
      luts[c][i] = Math.round(clamp(toned * gains[c]) * 255);
    }
  }
  return luts;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Split toning weight for a given luma (0..1).
 *
 * Shadow casts peak at black and vanish by mid-grey; highlight casts do the
 * mirror. The `^2` falloff keeps midtones — and therefore skin — clean, which
 * is the difference between a stylish grade and a muddy one.
 */
export function splitWeights(lumaNorm: number): { shadow: number; highlight: number } {
  const l = clamp(lumaNorm);
  return {
    shadow: Math.pow(1 - l, 2),
    highlight: Math.pow(l, 2),
  };
}
