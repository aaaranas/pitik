import { describe, expect, it } from "vitest";
import {
  applyColourPipeline,
  applyGrain,
  applySharpen,
  centreCrop,
  formatCameraTimestamp,
} from "@/lib/filters/canvas";
import { toCssPreview } from "@/lib/filters/css";
import {
  buildChannelLuts,
  luma,
  resolveAdjustments,
  splitWeights,
  toneCurve,
} from "@/lib/filters/math";
import { FILTER_PRESETS } from "@/lib/filters/presets";
import {
  composeAdjustments,
  getFilter,
  listFilters,
  listFiltersForProfile,
} from "@/lib/filters/registry";
import { NEUTRAL_ADJUSTMENTS, type Adjustments } from "@/lib/filters/types";

function adjust(patch: Partial<Adjustments>): Adjustments {
  return resolveAdjustments(patch);
}

/** Four pixels spanning the tonal range, as RGBA. */
function samplePixels(): Uint8ClampedArray {
  return new Uint8ClampedArray([
    10, 10, 10, 255, // near black
    90, 70, 60, 255, // shadow with warmth
    180, 150, 130, 255, // skin-ish midtone
    245, 245, 245, 255, // near white
  ]);
}

describe("tone curve", () => {
  it("is the identity for neutral adjustments", () => {
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      expect(toneCurve(value, NEUTRAL_ADJUSTMENTS)).toBeCloseTo(value, 6);
    }
  });

  it("treats one stop of exposure as a doubling", () => {
    expect(toneCurve(0.25, adjust({ exposure: 1 }))).toBeCloseTo(0.5, 6);
  });

  it("pivots contrast at mid-grey", () => {
    const high = adjust({ contrast: 1.5 });
    expect(toneCurve(0.5, high)).toBeCloseTo(0.5, 6);
    expect(toneCurve(0.25, high)).toBeLessThan(0.25);
    expect(toneCurve(0.75, high)).toBeGreaterThan(0.75);
  });

  it("lifts shadows without moving highlights", () => {
    const lifted = adjust({ shadows: 0.5 });
    // 0.5 * 0.45 * (1 - 0.05)^2.5 ≈ 0.198 of lift at the bottom of the range.
    expect(toneCurve(0.05, lifted)).toBeGreaterThan(0.05 + 0.19);
    // The weighting is (1-v)^2.5, so the top end is left essentially alone.
    expect(toneCurve(0.95, lifted)).toBeCloseTo(0.95, 2);
  });

  it("recovers highlights without crushing shadows", () => {
    const recovered = adjust({ highlights: -0.5 });
    expect(toneCurve(0.95, recovered)).toBeLessThan(0.95 - 0.15);
    expect(toneCurve(0.05, recovered)).toBeCloseTo(0.05, 2);
  });

  it("lifts the black point when faded", () => {
    expect(toneCurve(0, adjust({ fade: 1 }))).toBeCloseTo(0.22, 5);
  });

  it("never leaves the 0..1 range, however extreme the input", () => {
    const extreme = adjust({
      exposure: 2,
      brightness: 2,
      contrast: 2,
      shadows: 1,
      highlights: 1,
    });
    for (const value of [0, 0.1, 0.5, 0.9, 1]) {
      const result = toneCurve(value, extreme);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

describe("channel LUTs", () => {
  it("produce 256 entries per channel", () => {
    const luts = buildChannelLuts(NEUTRAL_ADJUSTMENTS);
    expect(luts).toHaveLength(3);
    for (const lut of luts) expect(lut).toHaveLength(256);
  });

  it("are the identity for a neutral grade", () => {
    const [r, g, b] = buildChannelLuts(NEUTRAL_ADJUSTMENTS);
    for (const index of [0, 64, 128, 192, 255]) {
      expect(r[index]).toBe(index);
      expect(g[index]).toBe(index);
      expect(b[index]).toBe(index);
    }
  });

  it("push red up and blue down when warmed", () => {
    const [r, , b] = buildChannelLuts(adjust({ temperature: 1 }));
    expect(r[128]).toBeGreaterThan(128);
    expect(b[128]).toBeLessThan(128);
  });

  it("are monotonic, so no grade ever inverts tones", () => {
    const [r] = buildChannelLuts(adjust({ contrast: 1.4, shadows: 0.3, highlights: -0.2 }));
    for (let i = 1; i < 256; i++) {
      expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
    }
  });
});

describe("colour pipeline", () => {
  it("leaves pixels untouched with neutral adjustments", () => {
    const pixels = samplePixels();
    const before = [...pixels];
    applyColourPipeline(pixels, NEUTRAL_ADJUSTMENTS);
    expect([...pixels]).toEqual(before);
  });

  it("preserves alpha", () => {
    const pixels = samplePixels();
    applyColourPipeline(pixels, adjust({ contrast: 1.6, saturation: 0.2, temperature: 0.5 }));
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255);
  });

  it("makes every channel equal at zero saturation", () => {
    const pixels = samplePixels();
    applyColourPipeline(pixels, adjust({ saturation: 0 }));
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(pixels[i + 1]);
      expect(pixels[i + 1]).toBe(pixels[i + 2]);
    }
  });

  it("applies a shadow cast to shadows and leaves highlights alone", () => {
    const pixels = samplePixels();
    const highlightBefore = pixels[12];
    applyColourPipeline(pixels, adjust({ splitShadow: { color: "#0000ff", amount: 1 } }));
    // The dark pixel gains blue…
    expect(pixels[2]).toBeGreaterThan(10);
    // …while the near-white one is essentially untouched.
    expect(Math.abs(pixels[12] - highlightBefore)).toBeLessThanOrEqual(2);
  });
});

describe("split tone weighting", () => {
  it("peaks at the matching end and vanishes at the other", () => {
    expect(splitWeights(0).shadow).toBe(1);
    expect(splitWeights(0).highlight).toBe(0);
    expect(splitWeights(1).highlight).toBe(1);
    expect(splitWeights(1).shadow).toBe(0);
  });

  it("keeps midtones mostly clean", () => {
    const mid = splitWeights(0.5);
    expect(mid.shadow).toBeLessThan(0.3);
    expect(mid.highlight).toBeLessThan(0.3);
  });
});

describe("grain", () => {
  it("is deterministic for a given seed", () => {
    const a = samplePixels();
    const b = samplePixels();
    applyGrain(a, 0.8, 42);
    applyGrain(b, 0.8, 42);
    expect([...a]).toEqual([...b]);
  });

  it("differs between seeds", () => {
    const a = samplePixels();
    const b = samplePixels();
    applyGrain(a, 0.8, 1);
    applyGrain(b, 0.8, 2);
    expect([...a]).not.toEqual([...b]);
  });

  it("does nothing at zero", () => {
    const pixels = samplePixels();
    const before = [...pixels];
    applyGrain(pixels, 0, 7);
    expect([...pixels]).toEqual(before);
  });
});

describe("sharpen", () => {
  it("does nothing at zero amount", () => {
    const pixels = new Uint8ClampedArray(9 * 4).fill(128);
    const before = [...pixels];
    applySharpen(pixels, 3, 3, 0);
    expect([...pixels]).toEqual(before);
  });

  it("increases local contrast at an edge", () => {
    // 3x3 with a bright centre pixel on a dark field.
    const pixels = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) {
      const value = i === 4 ? 200 : 100;
      pixels.set([value, value, value, 255], i * 4);
    }
    applySharpen(pixels, 3, 3, 1);
    expect(pixels[4 * 4]).toBeGreaterThan(200);
  });
});

describe("centreCrop", () => {
  it("returns the full frame when no aspect is requested", () => {
    expect(centreCrop(4000, 3000, null)).toEqual({ sx: 0, sy: 0, sw: 4000, sh: 3000 });
  });

  it("crops the sides of a wide source for a square target", () => {
    const crop = centreCrop(4000, 3000, 1);
    expect(crop).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
  });

  it("crops the top and bottom of a tall source for a wide target", () => {
    const crop = centreCrop(1000, 2000, 16 / 9);
    expect(crop.sw).toBe(1000);
    expect(crop.sh).toBe(563);
    expect(crop.sy).toBe(719);
  });

  it("never produces a crop larger than the source", () => {
    for (const aspect of [1, 4 / 3, 3 / 2, 16 / 9]) {
      const crop = centreCrop(1200, 1600, aspect);
      expect(crop.sw).toBeLessThanOrEqual(1200);
      expect(crop.sh).toBeLessThanOrEqual(1600);
    }
  });
});

describe("CSS preview", () => {
  it("emits no filter for a neutral grade", () => {
    const preview = toCssPreview(NEUTRAL_ADJUSTMENTS);
    expect(preview.filter).toBe("none");
    expect(preview.layers).toHaveLength(0);
  });

  it("collapses exposure and brightness into one brightness()", () => {
    const preview = toCssPreview(adjust({ exposure: 1, brightness: 1.5 }));
    expect(preview.filter).toContain("brightness(3.000)");
  });

  it("moves in the same direction as the canvas renderer", () => {
    // A brighter grade must read brighter in both paths.
    const bright = adjust({ exposure: 0.5 });
    expect(toCssPreview(bright).filter).toContain("brightness");
    expect(toneCurve(0.5, bright)).toBeGreaterThan(0.5);
  });

  it("uses multiply for shadow casts and screen for highlight casts", () => {
    const preview = toCssPreview(
      adjust({
        splitShadow: { color: "#123456", amount: 0.8 },
        splitHighlight: { color: "#ffddaa", amount: 0.8 },
      }),
    );
    const modes = preview.layers.filter((l) => l.kind === "split").map((l) => l.blendMode);
    expect(modes).toEqual(["multiply", "screen"]);
  });

  it("keeps every layer opacity within range", () => {
    for (const preset of FILTER_PRESETS) {
      const preview = toCssPreview(resolveAdjustments(preset.adjustments));
      for (const layer of preview.layers) {
        expect(layer.opacity).toBeGreaterThanOrEqual(0);
        expect(layer.opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("registry", () => {
  it("exposes every shipped preset", () => {
    expect(listFilters().length).toBe(FILTER_PRESETS.length);
    expect(listFilters().length).toBeGreaterThanOrEqual(30);
  });

  it("has no duplicate ids or names", () => {
    const ids = FILTER_PRESETS.map((f) => f.id);
    const names = FILTER_PRESETS.map((f) => f.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("falls back to Natural for an unknown id", () => {
    expect(getFilter("does-not-exist").id).toBe("natural");
    expect(getFilter(undefined).id).toBe("natural");
  });

  it("composes profile under filter, with overrides winning", () => {
    const composed = composeAdjustments({
      profileId: "disposable",
      filterId: "mono",
      overrides: { saturation: 1 },
    });
    // The profile's grain survives…
    expect(composed.grain).toBeGreaterThan(0);
    // …but the explicit override beats the filter's desaturation.
    expect(composed.saturation).toBe(1);
  });

  it("gives every preset a visibly different result from Natural", () => {
    const neutralPixels = samplePixels();
    applyColourPipeline(neutralPixels, NEUTRAL_ADJUSTMENTS);

    for (const preset of FILTER_PRESETS) {
      if (preset.id === "natural") continue;
      const pixels = samplePixels();
      applyColourPipeline(pixels, resolveAdjustments(preset.adjustments));
      const distance = pixels.reduce(
        (sum, value, index) => sum + Math.abs(value - neutralPixels[index]),
        0,
      );
      expect(distance, `${preset.name} is indistinguishable from Natural`).toBeGreaterThan(12);
    }
  });
});

describe("misc", () => {
  it("weights luma the Rec.709 way", () => {
    expect(luma(255, 0, 0)).toBeCloseTo(54.213, 2);
    expect(luma(255, 255, 255)).toBeCloseTo(255, 5);
  });

  it("formats a camera-back timestamp", () => {
    expect(formatCameraTimestamp(new Date(2026, 7, 19, 21, 4))).toBe("'26 08 19 21:04");
  });
});

/**
 * Profiles as sections.
 *
 * Camera Mode is a digicam, so its dial lists camera models rather than grades.
 * That mapping lives in the profile data, and a regression here would put the
 * wrong shelf in front of the shutter.
 */
describe("listFiltersForProfile", () => {
  it("gives the digicam section the camera models and nothing else", () => {
    const models = listFiltersForProfile("digicam");
    expect(models.length).toBeGreaterThanOrEqual(10);
    for (const model of models) expect(model.category).toBe("Digicam");
  });

  it("includes the model the camera opens on", () => {
    // `DEFAULT_SETTINGS.defaultFilterId` — a digicam must boot holding a camera.
    expect(listFiltersForProfile("digicam").map((f) => f.id)).toContain("2003");
  });

  it("gives a profile with no declared categories the whole shelf", () => {
    expect(listFiltersForProfile("everyday")).toHaveLength(FILTER_PRESETS.length);
  });

  it("restricts the other sections to their own categories", () => {
    for (const filter of listFiltersForProfile("disposable")) {
      expect(filter.category).toBe("Film");
    }
    for (const filter of listFiltersForProfile("soft")) {
      expect(filter.category).toBe("Dreamy");
    }
  });

  it("never returns an empty shelf, even for an unknown profile", () => {
    // An empty tray would leave the user nothing to select at all.
    expect(listFiltersForProfile("does-not-exist").length).toBeGreaterThan(0);
  });
});
