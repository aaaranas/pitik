#!/usr/bin/env node
/**
 * Renders the Pitik app icons.
 *
 * Written as a build script rather than shipping binary assets so the mark has
 * a single source of truth: change the constants below and every size —
 * install icon, maskable icon, apple-touch icon, favicon — regenerates in
 * agreement. It draws into a raw RGBA buffer and encodes PNG with nothing but
 * Node's own zlib, which keeps the toolchain free of image dependencies.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const INK = [11, 9, 8, 255];
const PAPER = [245, 240, 231, 255];
const SAFELIGHT = [234, 79, 52, 255];

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

/**
 * Antialiased annulus. Coverage is estimated from the distance to each edge,
 * which is accurate to well under a pixel for circles this size and avoids
 * supersampling the whole canvas.
 */
function drawRing(pixels, size, cx, cy, outer, inner, colour) {
  const feather = size * 0.004;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const outerCoverage = clamp01((outer - distance) / feather + 0.5);
      const innerCoverage = clamp01((distance - inner) / feather + 0.5);
      const coverage = Math.min(outerCoverage, inner > 0 ? innerCoverage : 1);
      blend(pixels, (y * size + x) * 4, colour, coverage);
    }
  }
}

function drawRoundedSquare(pixels, size, radius, colour) {
  const feather = size * 0.004;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const qx = Math.max(radius - px, px - (size - radius), 0);
      const qy = Math.max(radius - py, py - (size - radius), 0);
      const distance = Math.sqrt(qx * qx + qy * qy);
      blend(pixels, (y * size + x) * 4, colour, clamp01((radius - distance) / feather + 0.5));
    }
  }
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The mark: a paper lens ring with a safelight iris.
 *
 * `inset` shrinks the artwork toward the centre for maskable icons, where
 * Android may crop up to 20% off every edge.
 */
function drawMark(pixels, size, inset = 1) {
  const centre = size / 2;
  const scale = inset;
  drawRing(pixels, size, centre, centre, size * 0.345 * scale, size * 0.255 * scale, PAPER);
  drawRing(pixels, size, centre, centre, size * 0.145 * scale, 0, SAFELIGHT);
  // Viewfinder tick at 10 o'clock, clear of the ring so it reads as a separate
  // mark rather than a defect in the annulus. The asymmetry is what stops the
  // icon reading as a generic circle at 16px.
  const angle = Math.PI * 1.25;
  drawRing(
    pixels,
    size,
    centre + Math.cos(angle) * size * 0.415 * scale,
    centre + Math.sin(angle) * size * 0.415 * scale,
    size * 0.045 * scale,
    0,
    PAPER,
  );
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

// ------------------------------------------------------------------- output

const TARGETS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-192.png", size: 192, maskable: true },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
  { file: "favicon-32.png", size: 32, maskable: false },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const pixels = createBuffer(target.size, [0, 0, 0, 0]);
  if (target.maskable) {
    // Maskable and Apple icons must be full-bleed: any transparency becomes a
    // white box on iOS and an odd halo inside Android's mask.
    drawRoundedSquare(pixels, target.size, target.size * 0.5, INK);
    drawMark(pixels, target.size, 0.78);
  } else {
    drawRoundedSquare(pixels, target.size, target.size * 0.22, INK);
    drawMark(pixels, target.size, 1);
  }
  writeFileSync(join(OUT_DIR, target.file), encodePng(pixels, target.size));
  console.log(`wrote icons/${target.file} (${target.size}px)`);
}
