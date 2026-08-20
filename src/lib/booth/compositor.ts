import { type AnyCanvas, type AnyContext, canvasToBlob, context2d, createCanvas } from "@/lib/filters/canvas";
import { type BoothSlot, type BoothTemplate, PAPERS, type StripStyle } from "./types";

/**
 * Renders a booth template plus a set of frames into one printable image.
 *
 * The compositor is template-agnostic on purpose — it reads geometry, it does
 * not know what "Classic 4" is. Everything that makes a layout distinctive
 * lives in the template data.
 */

export interface ComposeOptions {
  template: BoothTemplate;
  /** One per slot, in shooting order. Fewer than `shots` leaves wells empty. */
  frames: CanvasImageSource[];
  style: StripStyle;
  date?: Date;
  /** Multiplies the template's native size. 2 gives a print-ready export. */
  scale?: number;
}

const FONT_STACKS: Record<StripStyle["captionFont"], string> = {
  display: '"Instrument Serif", ui-serif, Georgia, serif',
  sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
};

function roundedRect(
  ctx: AnyContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Draws one frame into its well, cropped to fill.
 *
 * Cover-fit rather than contain: a booth print with letterboxed photos looks
 * like a bug. The centre of the frame is what people composed for, so that is
 * what survives the crop.
 */
function drawSlot(
  ctx: AnyContext,
  slot: BoothSlot,
  source: CanvasImageSource,
  scale: number,
): void {
  const x = slot.x * scale;
  const y = slot.y * scale;
  const width = slot.width * scale;
  const height = slot.height * scale;
  const radius = (slot.radius ?? 0) * scale;

  const sourceWidth =
    "videoWidth" in source && source.videoWidth
      ? source.videoWidth
      : Number((source as { width: number }).width);
  const sourceHeight =
    "videoHeight" in source && source.videoHeight
      ? source.videoHeight
      : Number((source as { height: number }).height);
  if (!sourceWidth || !sourceHeight) return;

  const slotAspect = width / height;
  const sourceAspect = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceAspect > slotAspect) {
    sw = sourceHeight * slotAspect;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / slotAspect;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.save();
  if (slot.rotate) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((slot.rotate * Math.PI) / 180);
    ctx.translate(-(x + width / 2), -(y + height / 2));
  }
  if (radius > 0) {
    roundedRect(ctx, x, y, width, height, radius);
    ctx.clip();
  }
  ctx.drawImage(source, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
}

/** Empty wells get a faint tone so an abandoned sequence still reads as a print. */
function drawEmptySlot(ctx: AnyContext, slot: BoothSlot, scale: number, ink: string): void {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = ink;
  roundedRect(
    ctx,
    slot.x * scale,
    slot.y * scale,
    slot.width * scale,
    slot.height * scale,
    (slot.radius ?? 0) * scale,
  );
  ctx.fill();
  ctx.restore();
}

function formatStripDate(date: Date): string {
  return date
    .toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export function composeStrip(options: ComposeOptions): AnyCanvas {
  const { template, frames, style } = options;
  const scale = options.scale ?? 2;
  const paper = PAPERS[style.paper] ?? PAPERS[template.defaultPaper];
  const width = Math.round(template.width * scale);
  const height = Math.round(template.height * scale);

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";

  // Paper. Rounded corners are drawn by clipping, so the exported PNG has real
  // transparency outside them rather than a fake white corner.
  if (style.rounded) {
    roundedRect(ctx, 0, 0, width, height, 18 * scale);
    ctx.clip();
  }
  if (paper.gradient) {
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, paper.gradient[0]);
    wash.addColorStop(1, paper.gradient[1]);
    ctx.fillStyle = wash;
  } else {
    ctx.fillStyle = paper.background;
  }
  ctx.fillRect(0, 0, width, height);

  template.slots.forEach((slot, index) => {
    const frame = frames[index];
    if (frame) drawSlot(ctx, slot, frame, scale);
    else drawEmptySlot(ctx, slot, scale, paper.ink);

    if (template.slotBorder) {
      ctx.save();
      ctx.strokeStyle = template.slotBorder.color;
      ctx.lineWidth = template.slotBorder.width * scale;
      roundedRect(
        ctx,
        slot.x * scale,
        slot.y * scale,
        slot.width * scale,
        slot.height * scale,
        (slot.radius ?? 0) * scale,
      );
      ctx.stroke();
      ctx.restore();
    }

    if (template.numbered) {
      const size = Math.max(10, 13 * scale);
      ctx.save();
      ctx.font = `${size}px ${FONT_STACKS.mono}`;
      ctx.fillStyle = paper.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        String(index + 1).padStart(2, "0"),
        slot.x * scale + 6 * scale,
        (slot.y + slot.height) * scale + 4 * scale,
      );
      ctx.restore();
    }
  });

  if (style.keyline) {
    const inset = 14 * scale;
    ctx.save();
    ctx.strokeStyle = paper.muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, scale);
    roundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 10 * scale);
    ctx.stroke();
    ctx.restore();
  }

  const caption = template.caption;
  if (caption && style.caption.trim()) {
    const text = style.caption.trim().slice(0, caption.maxLength);
    ctx.save();
    ctx.font = `${caption.size * scale}px ${FONT_STACKS[style.captionFont]}`;
    ctx.fillStyle = paper.ink;
    ctx.textAlign = caption.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, caption.x * scale, caption.y * scale);
    ctx.restore();
  }

  if (style.showDate) {
    const size = Math.max(11, 15 * scale);
    ctx.save();
    ctx.font = `${size}px ${FONT_STACKS.mono}`;
    ctx.fillStyle = paper.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      formatStripDate(options.date ?? new Date()),
      width / 2,
      height - 18 * scale,
    );
    ctx.restore();
  }

  return canvas;
}

export interface ComposedStrip {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Composes and encodes. PNG keeps the rounded corners' transparency intact. */
export async function exportStrip(
  options: ComposeOptions & { format?: "png" | "jpeg" },
): Promise<ComposedStrip> {
  const canvas = composeStrip(options);
  const format = options.format ?? "png";
  const blob = await canvasToBlob(
    canvas,
    format === "png" ? "image/png" : "image/jpeg",
    0.94,
  );

  const thumbScale = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
  const thumbCanvas = createCanvas(
    Math.round(canvas.width * thumbScale),
    Math.round(canvas.height * thumbScale),
  );
  const thumbCtx = context2d(thumbCanvas);
  thumbCtx.imageSmoothingQuality = "high";
  thumbCtx.drawImage(canvas as CanvasImageSource, 0, 0, thumbCanvas.width, thumbCanvas.height);

  return {
    blob,
    thumb: await canvasToBlob(thumbCanvas, "image/jpeg", 0.8),
    width: canvas.width,
    height: canvas.height,
  };
}
