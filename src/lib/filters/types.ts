/**
 * Filter engine types.
 *
 * A filter is *data*, never code. Every preset in the registry is a plain
 * `Adjustments` object plus metadata, which means both renderers — the cheap
 * CSS one used for live preview and the full-resolution canvas one used at
 * export — consume the exact same description. Adding a preset never requires
 * touching a component.
 */

/** A colour cast applied to one end of the tonal range. */
export interface ToneCast {
  /** Hex colour, `#rrggbb`. */
  color: string;
  /** 0..1 strength. */
  amount: number;
}

/**
 * The complete parameter surface of the engine.
 *
 * Every value is normalised so that the identity filter is
 * `NEUTRAL_ADJUSTMENTS` — presets only declare what they change.
 */
export interface Adjustments {
  /** Stops of exposure. -2..2, 0 = untouched. Applied as `v * 2^exposure`. */
  exposure: number;
  /** Linear multiplier. 0..2, 1 = untouched. */
  brightness: number;
  /** Pivoted at mid-grey. 0..2, 1 = untouched. */
  contrast: number;
  /** -1 recovers highlights, +1 blows them out. 0 = untouched. */
  highlights: number;
  /** -1 crushes shadows, +1 lifts them. 0 = untouched. */
  shadows: number;
  /** 0 = greyscale, 1 = untouched, 2 = doubled. */
  saturation: number;
  /** -1 cool (blue), +1 warm (amber). 0 = untouched. */
  temperature: number;
  /** -1 green, +1 magenta. 0 = untouched. */
  tint: number;
  /** Matte lift of the black point. 0..1, 0 = untouched. */
  fade: number;
  /** Corner falloff. 0..1, 0 = off. */
  vignette: number;
  /** Monochrome film grain. 0..1, 0 = off. */
  grain: number;
  /** Unsharp mask amount. 0..1, 0 = off. */
  sharpness: number;
  /** Highlight bleed. 0..1, 0 = off. */
  bloom: number;
  /** Colour cast pushed into the shadows. */
  splitShadow?: ToneCast;
  /** Colour cast pushed into the highlights. */
  splitHighlight?: ToneCast;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  brightness: 1,
  contrast: 1,
  highlights: 0,
  shadows: 0,
  saturation: 1,
  temperature: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  sharpness: 0,
  bloom: 0,
};

export const FILTER_CATEGORIES = [
  "Natural",
  "Film",
  "Digicam",
  "B&W",
  "Warm",
  "Cool",
  "Dreamy",
  "Experimental",
  "Photobooth",
  "Night",
] as const;

export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

export interface FilterDefinition {
  id: string;
  name: string;
  category: FilterCategory;
  /** One line shown in the filter tray. Keep it evocative, not technical. */
  description: string;
  adjustments: Partial<Adjustments>;
}

/** A resolved filter — registry metadata with a fully-populated parameter set. */
export interface ResolvedFilter extends Omit<FilterDefinition, "adjustments"> {
  adjustments: Adjustments;
}

/**
 * Camera profiles are a *second* stack applied before the filter, representing
 * the body you are shooting with rather than the look you are grading toward.
 * Keeping them separate means "Disposable body + Mono filter" composes.
 */
export interface CameraProfile {
  id: string;
  name: string;
  description: string;
  adjustments: Partial<Adjustments>;
  /** Burns a date into the corner of the exported frame. */
  timestamp: boolean;
  /** Biases the shutter toward the flash-lit look (brightens the near field). */
  flashLook: boolean;
}
