#!/usr/bin/env node
/**
 * Renders the Pitik app icons.
 *
 * Written as a build script rather than shipping binary assets so the mark has
 * a single source of truth: change the geometry below and every size —
 * install icon, maskable icon, apple-touch icon, favicon — regenerates in
 * agreement. It draws into a raw RGBA buffer and encodes PNG with nothing but
 * Node's own zlib, which keeps the toolchain free of image dependencies.
 *
 * The colours are **read out of `globals.css`**, not copied here, for the same
 * reason `check-contrast.mjs` reads them: a copy drifts. It already had —
 * these icons shipped a near-black ground and a red-orange iris for a while
 * after the app itself moved to cream and pastels, because the hexes lived in
 * this file where no gate could see them.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");
const APP_DIR = join(ROOT, "src", "app");
const CSS = join(APP_DIR, "globals.css");

// ------------------------------------------------------------------- palette

function readPalette(path) {
  const css = readFileSync(path, "utf8");
  const palette = {};
  for (const [, name, hex] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    palette[name] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
  }
  return palette;
}

const palette = readPalette(CSS);

function colour(name) {
  const value = palette[name];
  if (!value) {
    throw new Error(
      `generate-icons: --color-${name} is not in globals.css. ` +
        `The icon mark is built from the app palette; rename it here too.`,
    );
  }
  return value;
}

/** Ink is the material: the frame, the lens barrel, the viewfinder tick. */
const INK = colour("cocoa-900");
/** The app's own paper, so the installed icon is a chip off the same stock. */
const PAPER = colour("cream-50");
/** The iris. Matches `PitikMark`'s `fill-sky-base` so app and icon agree. */
const IRIS = colour("sky-base");
/**
 * The hard offset. Blush rather than sky — it has to differ in hue from the
 * iris to read as misregistration rather than as a second, blurry ring.
 */
const OFFSET = colour("blush-base");
/**
 * Ground for the full-bleed icons. A maskable cannot keep the ink frame (the
 * mask crops it away), and cream alone has no presence once the frame is gone,
 * so it takes the surface step of the same hue family instead.
 */
const FULL_BLEED_GROUND = colour("sky-tint");

// ------------------------------------------------------------------ drawing

function createBuffer(size, background) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = background[0];
    pixels[i * 4 + 1] = background[1];
    pixels[i * 4 + 2] = background[2];
    pixels[i * 4 + 3] = background[3];
  }
  return pixels;
}

function blend(pixels, index, colour, alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  for (let c = 0; c < 3; c++) {
    pixels[index + c] = pixels[index + c] * (1 - a) + colour[c] * a;
  }
  pixels[index + 3] = Math.max(pixels[index + 3], colour[3] * a);
}

/** Antialiasing width. Held at half a pixel minimum so a 32px favicon still
 *  gets a clean edge rather than a hard-clipped one. */
function feather(size) {
  return Math.max(size * 0.004, 0.5);
}

/**
 * Antialiased annulus, or a disc when `inner` is 0. Coverage is estimated from
 * the distance to each edge, which is accurate to well under a pixel at these
 * sizes and avoids supersampling the whole canvas.
 */
function drawRing(pixels, size, cx, cy, outer, inner, colour) {
  const f = feather(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const outerCoverage = clamp01((outer - distance) / f + 0.5);
      const innerCoverage = clamp01((distance - inner) / f + 0.5);
      blend(pixels, (y * size + x) * 4, colour, Math.min(outerCoverage, inner > 0 ? innerCoverage : 1));
    }
  }
}

/** Rounded rectangle in absolute pixel coordinates, so the frame can be drawn
 *  as one inset inside another. */
function drawRoundedRect(pixels, size, x0, y0, x1, y1, radius, colour) {
  const f = feather(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      const qx = Math.max(x0 + radius - px, px - (x1 - radius), 0);
      const qy = Math.max(y0 + radius - py, py - (y1 - radius), 0);
      const distance = Math.sqrt(qx * qx + qy * qy);
      blend(pixels, (y * size + x) * 4, colour, clamp01((radius - distance) / f + 0.5));
    }
  }
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The mark: a lens barrel in ink with a sky iris and a viewfinder tick at ten
 * o'clock. Proportions are fractions of the icon's edge, so every size is the
 * same drawing.
 *
 * The tick is what stops the icon reading as a generic circle at 16px, and it
 * has to clear the barrel by a real gap — at 32px a proportionally tight gap
 * closes up into a blob, which is why it sits out at 0.435 rather than hugging
 * the ring.
 */
const RING_OUTER = 0.345;
const RING_INNER = 0.215;
const IRIS_RADIUS = 0.133;
const TICK_DISTANCE = 0.435;
const TICK_RADIUS = 0.05;
/** Down-right, the same direction and roughly the same proportion as `.slab`'s
 *  `6px 6px 0` — this is that shadow, drawn at icon scale. */
const OFFSET_DISTANCE = 0.032;

function drawMark(pixels, size, { scale, iris, offset }) {
  const place = (v) => size * (0.5 + (v - 0.5) * scale);
  const span = (v) => size * v * scale;

  const barrel = (dx, dy, colour, withTick) => {
    const cx = place(0.5) + dx;
    const cy = place(0.5) + dy;
    drawRing(pixels, size, cx, cy, span(RING_OUTER), span(RING_INNER), colour);
    if (withTick) {
      const angle = Math.PI * 1.25;
      drawRing(
        pixels,
        size,
        cx + Math.cos(angle) * span(TICK_DISTANCE),
        cy + Math.sin(angle) * span(TICK_DISTANCE),
        span(TICK_RADIUS),
        0,
        colour,
      );
    }
  };

  if (offset) {
    // Barrel only. Offsetting the tick as well reads as two specks of dirt
    // rather than as one mark printed twice.
    const d = span(OFFSET_DISTANCE);
    barrel(d, d, OFFSET, false);
  }
  barrel(0, 0, INK, true);
  drawRing(pixels, size, place(0.5), place(0.5), span(IRIS_RADIUS), 0, iris);
}

/**
 * One icon.
 *
 * `fullBleed` covers the two cases that cannot have transparency or a frame:
 * Android's maskable icons, which may crop 20% off every edge, and iOS, which
 * turns any transparency into a white box.
 */
function drawIcon(size, { fullBleed }) {
  const pixels = createBuffer(size, [0, 0, 0, 0]);

  if (fullBleed) {
    drawRoundedRect(pixels, size, 0, 0, size, size, size * 0.5, FULL_BLEED_GROUND);
  } else {
    // The frame is ink drawn edge to edge with the paper inset on top of it.
    // Nearly square, like `--radius-slab`: a rounded icon reads as a product,
    // a squared one reads as print.
    drawRoundedRect(pixels, size, 0, 0, size, size, size * 0.05, INK);
    const inset = size * 0.07;
    drawRoundedRect(pixels, size, inset, inset, size - inset, size - inset, size * 0.03, PAPER);
  }

  drawMark(pixels, size, {
    // Maskable artwork is pulled into the safe zone; a framed icon can use
    // nearly the whole field because the frame is already the margin.
    scale: fullBleed ? 0.72 : 0.9,
    iris: IRIS,
    // Below about 40px the offset lands on one pixel and reads as a smudge on
    // the barrel rather than as a printed offset, so the favicon goes without.
    offset: size >= 40,
  });

  return pixels;
}

// -------------------------------------------------------------- PNG encoding

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  // Each scanline is prefixed with filter type 0; the deflate pass does the
  // real compression and these icons are flat enough not to need more.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) {
      raw[y * (size * 4 + 1) + 1 + x] = pixels[y * size * 4 + x];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------- ICO encoding

/**
 * `src/app/favicon.ico` has to be generated here too, or the rebrand stops at
 * the browser tab: Next picks that file up by convention and emits it as the
 * *first* icon link in every document, so whatever it holds wins the tab.
 *
 * Small sizes go in as uncompressed DIBs and 256 as PNG, which is the layout
 * real favicons ship and the one this file already had. A DIB inside an ICO is
 * bottom-up BGRA and carries a 1-bit AND mask after the colour data — unused
 * at 32bpp, but structurally required, so it is written as zeroes.
 */
function encodeDib(pixels, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // colour data plus the mask
  header.writeUInt16LE(1, 12); // planes
  header.writeUInt16LE(32, 14); // bits per pixel
  header.writeUInt32LE(size * size * 4, 20);

  const colour = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = ((size - 1 - y) * size + x) * 4; // bottom-up
      const dst = (y * size + x) * 4;
      colour[dst] = pixels[src + 2]; // B
      colour[dst + 1] = pixels[src + 1]; // G
      colour[dst + 2] = pixels[src]; // R
      colour[dst + 3] = pixels[src + 3]; // A
    }
  }

  const maskStride = Math.ceil(size / 8 / 4) * 4;
  return Buffer.concat([header, colour, Buffer.alloc(maskStride * size)]);
}

function encodeIco(entries) {
  const directory = Buffer.alloc(6);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const records = [];
  const payloads = [];

  for (const { size, body } of entries) {
    const record = Buffer.alloc(16);
    record[0] = size >= 256 ? 0 : size; // 0 means 256
    record[1] = size >= 256 ? 0 : size;
    record.writeUInt16LE(1, 4); // planes
    record.writeUInt16LE(32, 6); // bits per pixel
    record.writeUInt32LE(body.length, 8);
    record.writeUInt32LE(offset, 12);
    offset += body.length;
    records.push(record);
    payloads.push(body);
  }

  return Buffer.concat([directory, ...records, ...payloads]);
}

// ------------------------------------------------------------------- output

const TARGETS = [
  { file: "icon-192.png", size: 192, fullBleed: false },
  { file: "icon-512.png", size: 512, fullBleed: false },
  { file: "icon-maskable-192.png", size: 192, fullBleed: true },
  { file: "icon-maskable-512.png", size: 512, fullBleed: true },
  { file: "apple-touch-icon.png", size: 180, fullBleed: true },
  { file: "favicon-32.png", size: 32, fullBleed: false },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const pixels = drawIcon(target.size, { fullBleed: target.fullBleed });
  writeFileSync(join(OUT_DIR, target.file), encodePng(pixels, target.size));
  console.log(`wrote icons/${target.file} (${target.size}px)`);
}

const ICO_SIZES = [16, 32, 48, 256];
const ico = encodeIco(
  ICO_SIZES.map((size) => {
    const pixels = drawIcon(size, { fullBleed: false });
    return { size, body: size >= 256 ? encodePng(pixels, size) : encodeDib(pixels, size) };
  }),
);
writeFileSync(join(APP_DIR, "favicon.ico"), ico);
console.log(`wrote app/favicon.ico (${ICO_SIZES.join(", ")}px)`);
