import { describe, expect, it } from "vitest";
import { getCameraBody } from "@/lib/camera/bodies";
import { FILTER_PRESETS } from "@/lib/filters/presets";

/**
 * The camera body is data, so it can be checked as data.
 *
 * Two things are easy to get wrong by eye and invisible in review: text
 * printed on a pale body, and a status lamp that does not read as lit. On a
 * dark body a lamp is brighter than its surroundings; on a pastel one it has
 * to be darker, which is the opposite of the instinct.
 */
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("camera bodies", () => {
  // getCameraBody is keyed by filter id — the dial models are filter presets.
  // The unknown id exercises DEFAULT_BODY, which must pass the same bars.
  const ids = [...FILTER_PRESETS.map((preset) => preset.id), "no-such-model"];

  it("prints legible ink on the lit face of every body", () => {
    for (const id of ids) {
      const body = getCameraBody(id);
      // Text sits on the top two gradient stops, never the deep one.
      expect(contrast(body.ink, body.body[0]), `${id} ink on light stop`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(body.ink, body.body[1]), `${id} ink on mid stop`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives every model a status lamp that reads as lit", () => {
    for (const id of ids) {
      const body = getCameraBody(id);
      expect(contrast(body.accent, body.body[1]), `${id} lamp on body`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the instant-film body the only one that prints a border", () => {
    expect(getCameraBody("polaroid").print).toBe("instant");
    expect(getCameraBody("ccd").print).toBeUndefined();
  });
});
