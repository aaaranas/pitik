import { readFileSync } from "node:fs";

/**
 * WCAG contrast gate for the pastel palette.
 *
 * The palette is read out of globals.css rather than duplicated here: a copy
 * would drift, and the point is to check what the app actually ships. An
 * earlier hand-picked draft of this palette failed 10 of these 24 pairs, which
 * is why the check exists at all.
 *
 * Run: pnpm check:contrast
 */
const CSS = process.argv[2] ?? "src/app/globals.css";

function readPalette(path) {
  const css = readFileSync(path, "utf8");
  const palette = {};
  for (const [, name, hex] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    palette[name] = hex;
  }
  return palette;
}

const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const HUES = ["sky", "blush", "butter", "mint", "lilac"];
const TEXT = 4.5;
const UI = 3;

/** Every pair the design actually puts on screen. */
function pairs() {
  const out = [];
  for (const fg of ["cocoa-900", "cocoa-800", "cocoa-600"]) {
    for (const bg of ["cream-50", "cream-200"]) out.push([fg, bg, TEXT]);
  }
  for (const hue of HUES) {
    // Pastel as text on the app ground, and as a chip on its own tint.
    out.push([`${hue}-deep`, "cream-50", TEXT]);
    out.push([`${hue}-deep`, `${hue}-tint`, TEXT]);
    // Dark ink on a pastel fill — every button, every camera body label.
    out.push(["cocoa-900", `${hue}-base`, TEXT]);
  }
  out.push(["sky-deep", "cream-50", UI]); // focus ring
  out.push(["blush-lamp", "cream-200", UI]); // record indicator
  out.push(["edge-strong", "cream-50", UI]); // control boundary
  return out;
}

const palette = readPalette(CSS);
let failed = 0;
let missing = 0;

for (const [fg, bg, min] of pairs()) {
  if (!palette[fg] || !palette[bg]) {
    console.log(`MISSING  ${!palette[fg] ? fg : bg} is not defined in ${CSS}`);
    missing++;
    continue;
  }
  const r = ratio(palette[fg], palette[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${fg} on ${bg}`,
  );
}

const total = pairs().length;
console.log(`\n${total - failed - missing}/${total} pass`);

if (failed || missing) {
  console.error(`\nContrast check failed: ${failed} below minimum, ${missing} undefined.`);
  process.exit(1);
}
