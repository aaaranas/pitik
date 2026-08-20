import { context2d, createCanvas, type AnyCanvas } from "@/lib/filters/canvas";

/**
 * A synthetic photograph, generated rather than shipped.
 *
 * Built to exercise the parts of a grade that matter and that a flat gradient
 * would hide: a full tonal ramp for the tone curve, saturated primaries for
 * saturation and split toning, and a band of skin tones — because skin is what
 * people actually judge a filter by, and a preset that wrecks it is broken no
 * matter how good the sky looks.
 *
 * Development only. Nothing in the shipped app imports this.
 */
export function drawReferenceImage(width = 960, height = 720): AnyCanvas {
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);

  // Sky: a bright gradient that will show highlight recovery and bloom.
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  sky.addColorStop(0, "#7fb2e5");
  sky.addColorStop(0.7, "#cfe0ee");
  sky.addColorStop(1, "#f6efe2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.55);

  // Ground: deep enough to reveal shadow lifts and crushed blacks.
  const ground = ctx.createLinearGradient(0, height * 0.55, 0, height);
  ground.addColorStop(0, "#6b5a45");
  ground.addColorStop(1, "#161210");
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  // Skin-tone band, light to deep.
  const skinTones = ["#f6d5bd", "#e8b895", "#c98d6d", "#9c6444", "#6b3f28", "#3f2417"];
  skinTones.forEach((tone, index) => {
    ctx.fillStyle = tone;
    ctx.fillRect((index * width) / skinTones.length, height * 0.58, width / skinTones.length, height * 0.16);
  });

  // Saturated primaries and secondaries, for saturation and colour casts.
  const chips = ["#e02020", "#e08a20", "#e0d020", "#3fb54a", "#2f6fd0", "#7a3fd0"];
  chips.forEach((chip, index) => {
    ctx.fillStyle = chip;
    ctx.fillRect((index * width) / chips.length, height * 0.74, width / chips.length, height * 0.1);
  });

  // Neutral step wedge: any hue shift here is a white-balance error.
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const value = Math.round((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${value},${value},${value})`;
    ctx.fillRect((i * width) / steps, height * 0.84, width / steps, height * 0.16);
  }

  // A hard edge, so sharpening and bloom have something to act on.
  ctx.fillStyle = "#f8f4ec";
  ctx.beginPath();
  ctx.arc(width * 0.76, height * 0.22, height * 0.11, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}
