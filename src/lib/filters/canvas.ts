import {
  buildChannelLuts,
  clamp255,
  hexToRgb,
  luma,
  splitWeights,
} from "./math";
import type { Adjustments } from "./types";

/**
 * The export renderer.
 *
 * Unlike {@link toCssPreview}, this runs once per photograph and is allowed to
 * be expensive. It implements the canonical pipeline exactly, including the
 * spatial passes CSS cannot express.
 *
 * Cost control comes from two places: the tone curve is baked into 256-entry
 * lookup tables before the pixel loop starts, and every spatial pass either
 * works on a downscaled copy (bloom) or is skipped entirely when its parameter
 * is zero.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RenderOptions {
  adjustments: Adjustments;
  /** Flip horizontally — front-camera frames arrive mirrored. */
  mirror?: boolean;
  /** Target width/height ratio. `null` keeps the source framing. */
  aspect?: number | null;
  /** Longest edge of the output, in pixels. Guards against 100MP phone sensors. */
  maxDimension?: number;
  /** Burned-in date stamp, drawn last so no grade touches it. */
  timestamp?: string | null;
  /** Fixes the grain pattern so re-exporting a capture is byte-stable. */
  seed?: number;
}

export const DEFAULT_MAX_DIMENSION = 2560;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

export function context2d(canvas: AnyCanvas): AnyContext {
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as AnyContext | null;
  if (!ctx) throw new Error("Canvas 2D is unavailable on this device.");
  return ctx;
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if ("videoWidth" in source && source.videoWidth) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if ("naturalWidth" in source && source.naturalWidth) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  const s = source as { width: number; height: number };
  return { width: Number(s.width), height: Number(s.height) };
}

/**
 * Computes the largest centred crop of `source` matching `aspect`.
 * Cropping rather than letterboxing keeps every stored pixel real — the app
 * never invents padding it would later have to explain.
 */
export function centreCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspect: number | null | undefined,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!aspect || !Number.isFinite(aspect)) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  }
  const sourceAspect = sourceWidth / sourceHeight;
  if (sourceAspect > aspect) {
    const sw = Math.round(sourceHeight * aspect);
    return { sx: Math.round((sourceWidth - sw) / 2), sy: 0, sw, sh: sourceHeight };
  }
  const sh = Math.round(sourceWidth / aspect);
  return { sx: 0, sy: Math.round((sourceHeight - sh) / 2), sw: sourceWidth, sh };
}

/** Deterministic PRNG (mulberry32) so grain is reproducible across renders. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Steps 1-8: tone, white balance, split toning, saturation. In place. */
export function applyColourPipeline(data: Uint8ClampedArray, adj: Adjustments): void {
  const [lutR, lutG, lutB] = buildChannelLuts(adj);

  const shadowCast = adj.splitShadow && adj.splitShadow.amount > 0.001 ? adj.splitShadow : null;
  const highlightCast =
    adj.splitHighlight && adj.splitHighlight.amount > 0.001 ? adj.splitHighlight : null;
  const shadowRgb = shadowCast ? hexToRgb(shadowCast.color) : null;
  const highlightRgb = highlightCast ? hexToRgb(highlightCast.color) : null;
  const saturation = adj.saturation;
  const needsSaturation = Math.abs(saturation - 1) > 0.001;

  for (let i = 0; i < data.length; i += 4) {
    let r = lutR[data[i]];
    let g = lutG[data[i + 1]];
    let b = lutB[data[i + 2]];

    if (shadowRgb || highlightRgb) {
      const l = luma(r, g, b) / 255;
      const weights = splitWeights(l);
      if (shadowRgb) {
        const k = weights.shadow * shadowCast!.amount;
        // Soft-light style blend: the cast tints without dragging the whole
        // frame toward the cast colour's own luminance.
        r += (shadowRgb[0] - r) * k * 0.5;
        g += (shadowRgb[1] - g) * k * 0.5;
        b += (shadowRgb[2] - b) * k * 0.5;
      }
      if (highlightRgb) {
        const k = weights.highlight * highlightCast!.amount;
        r += (highlightRgb[0] - r) * k * 0.5;
        g += (highlightRgb[1] - g) * k * 0.5;
        b += (highlightRgb[2] - b) * k * 0.5;
      }
    }

    if (needsSaturation) {
      const l = luma(r, g, b);
      r = l + (r - l) * saturation;
      g = l + (g - l) * saturation;
      b = l + (b - l) * saturation;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

/**
 * Unsharp mask via a 3×3 kernel. Digicam presets lean on this hard — the
 * over-sharpened edge is most of what makes a 2000s compact look like one.
 */
export function applySharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0.001) return;
  const source = new Uint8ClampedArray(data);
  const centre = 1 + 4 * amount;
  const side = -amount;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const value =
          source[i + c] * centre +
          source[i - 4 + c] * side +
          source[i + 4 + c] * side +
          source[i - width * 4 + c] * side +
          source[i + width * 4 + c] * side;
        data[i + c] = clamp255(value);
      }
    }
  }
}

/** Monochrome grain, added equally to all channels so it never shifts hue. */
export function applyGrain(
  data: Uint8ClampedArray,
  amount: number,
  seed: number,
): void {
  if (amount <= 0.001) return;
  const random = makeRandom(seed);
  const strength = amount * 42;
  for (let i = 0; i < data.length; i += 4) {
    // Grain is most visible in midtones and vanishes in blown highlights,
    // exactly as it does on film.
    const l = luma(data[i], data[i + 1], data[i + 2]) / 255;
    const visibility = 1 - Math.abs(l - 0.45) * 1.3;
    if (visibility <= 0) continue;
    const noise = (random() - 0.5) * strength * visibility;
    data[i] = clamp255(data[i] + noise);
    data[i + 1] = clamp255(data[i + 1] + noise);
    data[i + 2] = clamp255(data[i + 2] + noise);
  }
}

function applyVignette(ctx: AnyContext, width: number, height: number, amount: number): void {
  if (amount <= 0.001) return;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * (1 - amount * 0.55), cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${(amount * 0.75).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Highlight bloom. Isolates the bright end on a quarter-scale copy, blurs it,
 * and screens it back — cheap, and the downscale is itself part of the look.
 */
function applyBloom(
  ctx: AnyContext,
  canvas: AnyCanvas,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0.001) return;
  const scale = 0.25;
  const bw = Math.max(1, Math.round(width * scale));
  const bh = Math.max(1, Math.round(height * scale));
  const temp = createCanvas(bw, bh);
  const tempCtx = context2d(temp);
  if (!("filter" in tempCtx)) return;

  // Threshold: crushing everything but the highlights before blurring is what
  // stops bloom from turning into a flat haze over the whole frame.
  tempCtx.filter = "brightness(1.45) contrast(2.6) saturate(1.1)";
  tempCtx.drawImage(canvas as CanvasImageSource, 0, 0, bw, bh);
  tempCtx.filter = "none";

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = Math.min(0.75, amount * 0.7);
  if ("filter" in ctx) ctx.filter = `blur(${Math.max(2, bw * 0.02).toFixed(1)}px)`;
  ctx.drawImage(temp as CanvasImageSource, 0, 0, width, height);
  if ("filter" in ctx) ctx.filter = "none";
  ctx.restore();
}

/**
 * Date stamp in the corner, in the orange-on-black of a 90s camera back.
 * Drawn after every grade so it stays legible whatever the filter did.
 */
function drawTimestamp(ctx: AnyContext, width: number, height: number, text: string): void {
  const size = Math.max(12, Math.round(width * 0.028));
  const margin = Math.round(width * 0.035);
  ctx.save();
  ctx.font = `${size}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(180, 60, 0, 0.85)";
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = "#ff9a3c";
  ctx.fillText(text, width - margin, height - margin);
  ctx.restore();
}

/** Formats a date the way a camera back would: `'25 08 19 21:04`. */
export function formatCameraTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `'${pad(date.getFullYear() % 100)} ${pad(date.getMonth() + 1)} ${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Renders one frame through the full pipeline.
 *
 * `source` may be a video element (live capture), an ImageBitmap (imported
 * file), or another canvas (re-grading an existing capture).
 */
export function renderCapture(source: CanvasImageSource, options: RenderOptions): AnyCanvas {
  const { width: rawWidth, height: rawHeight } = sourceSize(source);
  if (!rawWidth || !rawHeight) throw new Error("The camera frame was empty.");

  const crop = centreCrop(rawWidth, rawHeight, options.aspect);
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const downscale = Math.min(1, maxDimension / Math.max(crop.sw, crop.sh));
  const width = Math.max(1, Math.round(crop.sw * downscale));
  const height = Math.max(1, Math.round(crop.sh * downscale));

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  if (options.mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  ctx.restore();

  const adj = options.adjustments;
  const image = ctx.getImageData(0, 0, width, height);
  applyColourPipeline(image.data, adj);
  applySharpen(image.data, width, height, adj.sharpness);
  applyGrain(image.data, adj.grain, options.seed ?? 1);
  ctx.putImageData(image, 0, 0);

  applyBloom(ctx, canvas, width, height, adj.bloom);
  applyVignette(ctx, width, height, adj.vignette);

  if (options.timestamp) drawTimestamp(ctx, width, height, options.timestamp);

  return canvas;
}

export async function canvasToBlob(
  canvas: AnyCanvas,
  type = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo."))),
      type,
      quality,
    );
  });
}

/** Small, cheap contact-sheet thumbnail. Never graded twice — the source is
 *  already the finished frame. */
export async function makeThumbnail(source: CanvasImageSource, size = 480): Promise<Blob> {
  const { width, height } = sourceSize(source);
  const scale = Math.min(1, size / Math.max(width, height));
  const canvas = createCanvas(Math.round(width * scale), Math.round(height * scale));
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, "image/jpeg", 0.78);
}
