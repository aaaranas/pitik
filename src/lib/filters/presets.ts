import type { CameraProfile, FilterDefinition } from "./types";

/**
 * The shipped filter set.
 *
 * Rules for adding to this list:
 *  - Every preset must be visibly distinct from its neighbours at thumbnail
 *    size. If two presets are hard to tell apart, one of them should not exist.
 *  - Names describe a feeling or a process, never a brand. Nothing here is
 *    named after another company's product or film stock.
 *  - Skin tone is the thing people actually judge. Grades that wreck midtones
 *    stay out no matter how good the landscape test looks.
 */
export const FILTER_PRESETS: FilterDefinition[] = [
  // ---------------------------------------------------------------- Natural
  {
    id: "natural",
    name: "Natural",
    category: "Natural",
    description: "Exactly what the sensor saw.",
    adjustments: {},
  },
  {
    id: "vivid",
    name: "Vivid",
    category: "Natural",
    description: "Colour turned up, contrast held.",
    adjustments: { saturation: 1.35, contrast: 1.08, sharpness: 0.3 },
  },
  {
    id: "muted",
    name: "Muted",
    category: "Natural",
    description: "Colour pulled back to a whisper.",
    adjustments: { saturation: 0.7, contrast: 0.96, fade: 0.1 },
  },
  {
    id: "low-contrast",
    name: "Low Contrast",
    category: "Natural",
    description: "Flat and forgiving. Nothing clips.",
    adjustments: { contrast: 0.82, shadows: 0.18, highlights: -0.16 },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    category: "Natural",
    description: "Hard light, deep blacks.",
    adjustments: { contrast: 1.32, shadows: -0.15, saturation: 1.08 },
  },

  // ------------------------------------------------------------------- Warm
  {
    id: "warm-memory",
    name: "Warm Memory",
    category: "Warm",
    description: "The way you'll remember it, not how it looked.",
    adjustments: {
      temperature: 0.32,
      saturation: 1.08,
      shadows: 0.14,
      fade: 0.12,
      splitHighlight: { color: "#ffd9a3", amount: 0.3 },
    },
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    category: "Warm",
    description: "Late sun, long shadows.",
    adjustments: {
      temperature: 0.45,
      exposure: 0.12,
      contrast: 1.06,
      saturation: 1.15,
      splitHighlight: { color: "#ffb54d", amount: 0.42 },
      splitShadow: { color: "#4a2f1c", amount: 0.2 },
      bloom: 0.22,
    },
  },
  {
    id: "summer",
    name: "Summer",
    category: "Warm",
    description: "Chlorine, sunscreen, too bright.",
    adjustments: {
      exposure: 0.18,
      temperature: 0.22,
      saturation: 1.3,
      highlights: 0.14,
      contrast: 1.05,
    },
  },
  {
    id: "sepia",
    name: "Sepia",
    category: "Warm",
    description: "One colour, gently aged.",
    adjustments: {
      saturation: 0.12,
      temperature: 0.3,
      contrast: 1.05,
      fade: 0.16,
      splitHighlight: { color: "#e8c08a", amount: 0.6 },
      splitShadow: { color: "#3d2a1a", amount: 0.45 },
    },
  },
  {
    id: "pinkish",
    name: "Pinkish",
    category: "Warm",
    description: "A blush over everything.",
    adjustments: {
      tint: 0.22,
      saturation: 1.05,
      fade: 0.14,
      splitHighlight: { color: "#ffc4d6", amount: 0.38 },
      splitShadow: { color: "#4a2b3a", amount: 0.18 },
    },
  },

  // ------------------------------------------------------------------- Cool
  {
    id: "cool-morning",
    name: "Cool Morning",
    category: "Cool",
    description: "Before anyone has spoken yet.",
    adjustments: {
      temperature: -0.28,
      contrast: 0.94,
      shadows: 0.16,
      saturation: 0.92,
      splitShadow: { color: "#2b3a4a", amount: 0.28 },
    },
  },
  {
    id: "blue-hour",
    name: "Blue Hour",
    category: "Cool",
    description: "The twenty minutes after sunset.",
    adjustments: {
      temperature: -0.45,
      exposure: -0.15,
      contrast: 1.12,
      saturation: 0.95,
      splitShadow: { color: "#1b2b4d", amount: 0.5 },
      splitHighlight: { color: "#c9d8ff", amount: 0.25 },
    },
  },
  {
    id: "green-tint",
    name: "Green Tint",
    category: "Cool",
    description: "Fluorescent light, honestly rendered.",
    adjustments: {
      tint: -0.3,
      contrast: 1.04,
      saturation: 0.95,
      splitShadow: { color: "#243a2c", amount: 0.32 },
    },
  },
  {
    id: "silver",
    name: "Silver",
    category: "Cool",
    description: "Colour drained to almost nothing.",
    adjustments: {
      saturation: 0.28,
      temperature: -0.12,
      contrast: 1.16,
      highlights: 0.08,
    },
  },

  // ------------------------------------------------------------------- Film
  {
    id: "disposable",
    name: "Disposable",
    category: "Film",
    description: "Twenty-seven exposures, no take-backs.",
    adjustments: {
      temperature: 0.24,
      contrast: 1.1,
      shadows: 0.22,
      saturation: 1.12,
      grain: 0.45,
      vignette: 0.35,
      fade: 0.14,
      splitShadow: { color: "#3a2c22", amount: 0.3 },
    },
  },
  {
    id: "vintage",
    name: "Vintage",
    category: "Film",
    description: "Found at the back of a drawer.",
    adjustments: {
      temperature: 0.2,
      saturation: 0.82,
      contrast: 0.95,
      fade: 0.3,
      grain: 0.3,
      vignette: 0.28,
      splitHighlight: { color: "#e6d3ac", amount: 0.35 },
      splitShadow: { color: "#463527", amount: 0.35 },
    },
  },
  {
    id: "fade",
    name: "Fade",
    category: "Film",
    description: "Matte blacks, nothing shouts.",
    adjustments: { fade: 0.42, contrast: 0.9, saturation: 0.9 },
  },
  {
    id: "grain",
    name: "Grain",
    category: "Film",
    description: "Pushed two stops in the dark.",
    adjustments: { grain: 0.8, contrast: 1.14, saturation: 0.88, sharpness: 0.2 },
  },
  {
    id: "dust",
    name: "Dust",
    category: "Film",
    description: "Scanned without cleaning the negative.",
    adjustments: {
      grain: 0.55,
      fade: 0.24,
      temperature: 0.14,
      saturation: 0.85,
      vignette: 0.4,
      contrast: 1.05,
      splitShadow: { color: "#4a3c2a", amount: 0.3 },
    },
  },
  {
    id: "cinema",
    name: "Cinema",
    category: "Film",
    description: "Teal shadows, warm faces.",
    adjustments: {
      contrast: 1.15,
      saturation: 1.05,
      shadows: 0.1,
      splitShadow: { color: "#12333d", amount: 0.45 },
      splitHighlight: { color: "#ffd2a8", amount: 0.3 },
      vignette: 0.22,
    },
  },
  {
    id: "sunday",
    name: "Sunday",
    category: "Film",
    description: "Slow light through a window.",
    adjustments: {
      exposure: 0.08,
      contrast: 0.9,
      saturation: 0.92,
      temperature: 0.14,
      fade: 0.2,
      bloom: 0.18,
    },
  },

  // ---------------------------------------------------------------- Digicam
  {
    id: "2003",
    name: "2003",
    category: "Digicam",
    description: "Four megapixels and proud of it.",
    adjustments: {
      temperature: -0.1,
      contrast: 1.2,
      saturation: 1.22,
      sharpness: 0.7,
      highlights: 0.1,
      vignette: 0.12,
    },
  },
  {
    id: "ccd",
    name: "CCD",
    category: "Digicam",
    description: "Cool whites, crunchy detail.",
    adjustments: {
      temperature: -0.18,
      contrast: 1.14,
      saturation: 1.1,
      sharpness: 0.85,
      shadows: -0.08,
      splitShadow: { color: "#1e2a38", amount: 0.22 },
    },
  },
  {
    id: "flash",
    name: "Flash",
    category: "Digicam",
    description: "Bright subject, world falls away.",
    adjustments: {
      exposure: 0.28,
      contrast: 1.25,
      shadows: -0.3,
      saturation: 1.05,
      vignette: 0.5,
      sharpness: 0.4,
    },
  },

  // ------------------------------------------------------------------ Night
  {
    id: "night-out",
    name: "Night Out",
    category: "Night",
    description: "Loud room, good company.",
    adjustments: {
      contrast: 1.28,
      exposure: 0.12,
      saturation: 1.1,
      grain: 0.4,
      temperature: 0.08,
      splitShadow: { color: "#1d2740", amount: 0.42 },
      splitHighlight: { color: "#ffdcc2", amount: 0.25 },
      vignette: 0.3,
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "Night",
    description: "Signage, wet asphalt, neon spill.",
    adjustments: {
      contrast: 1.35,
      saturation: 1.32,
      exposure: -0.1,
      grain: 0.3,
      splitShadow: { color: "#2a1b52", amount: 0.5 },
      splitHighlight: { color: "#8ff0ff", amount: 0.3 },
      bloom: 0.35,
      vignette: 0.35,
    },
  },

  // ----------------------------------------------------------------- Dreamy
  {
    id: "soft-date",
    name: "Soft Date",
    category: "Dreamy",
    description: "Everything a little kinder.",
    adjustments: {
      contrast: 0.88,
      exposure: 0.12,
      saturation: 0.96,
      temperature: 0.16,
      bloom: 0.4,
      fade: 0.2,
      splitHighlight: { color: "#ffe4d0", amount: 0.3 },
    },
  },
  {
    id: "dream",
    name: "Dream",
    category: "Dreamy",
    description: "Half-remembered, entirely glowing.",
    adjustments: {
      contrast: 0.82,
      exposure: 0.2,
      saturation: 1.08,
      bloom: 0.65,
      fade: 0.28,
      splitHighlight: { color: "#ffd8f0", amount: 0.35 },
      splitShadow: { color: "#3a3a6a", amount: 0.25 },
    },
  },
  {
    id: "milk",
    name: "Milk",
    category: "Dreamy",
    description: "Overexposed on purpose.",
    adjustments: {
      exposure: 0.35,
      contrast: 0.8,
      saturation: 0.82,
      highlights: 0.2,
      fade: 0.3,
      bloom: 0.3,
    },
  },
  {
    id: "pastel",
    name: "Pastel",
    category: "Dreamy",
    description: "Chalk colours, soft edges.",
    adjustments: {
      exposure: 0.18,
      contrast: 0.85,
      saturation: 0.78,
      fade: 0.26,
      splitHighlight: { color: "#ffe9f2", amount: 0.35 },
      splitShadow: { color: "#c9d4e8", amount: 0.3 },
    },
  },

  // -------------------------------------------------------------------- B&W
  {
    id: "mono",
    name: "Mono",
    category: "B&W",
    description: "Colour removed. Nothing else.",
    adjustments: { saturation: 0, contrast: 1.08 },
  },
  {
    id: "mono-hard",
    name: "High Contrast Mono",
    category: "B&W",
    description: "Black is black.",
    adjustments: { saturation: 0, contrast: 1.55, shadows: -0.2, highlights: 0.12 },
  },
  {
    id: "mono-film",
    name: "Mono Grain",
    category: "B&W",
    description: "Pushed monochrome, heavy texture.",
    adjustments: {
      saturation: 0,
      contrast: 1.25,
      grain: 0.7,
      fade: 0.14,
      vignette: 0.25,
    },
  },

  // ----------------------------------------------------------- Experimental
  {
    id: "redscale",
    name: "Redscale",
    category: "Experimental",
    description: "Loaded backwards. Everything burns.",
    adjustments: {
      temperature: 0.75,
      saturation: 1.25,
      contrast: 1.12,
      splitHighlight: { color: "#ff9a2e", amount: 0.7 },
      splitShadow: { color: "#5c0f0a", amount: 0.6 },
      vignette: 0.3,
      grain: 0.25,
    },
  },
  {
    id: "crossed",
    name: "Crossed",
    category: "Experimental",
    description: "Wrong chemistry, right result.",
    adjustments: {
      contrast: 1.4,
      saturation: 1.35,
      highlights: 0.15,
      splitShadow: { color: "#0f4a52", amount: 0.6 },
      splitHighlight: { color: "#fff2a8", amount: 0.5 },
      grain: 0.2,
    },
  },

  // ------------------------------------------------------------- Photobooth
  {
    id: "booth-classic",
    name: "Booth",
    category: "Photobooth",
    description: "Warm strip-print look.",
    adjustments: {
      contrast: 1.18,
      temperature: 0.16,
      saturation: 1.05,
      grain: 0.3,
      vignette: 0.28,
      fade: 0.1,
    },
  },
  {
    id: "booth-mono",
    name: "Booth Mono",
    category: "Photobooth",
    description: "The strip your parents have.",
    adjustments: {
      saturation: 0,
      contrast: 1.3,
      grain: 0.35,
      vignette: 0.35,
      fade: 0.12,
    },
  },
];

export const DEFAULT_FILTER_ID = "natural";

/**
 * Camera profiles model the *body*, not the grade — they stack underneath
 * whichever filter is selected. Deliberately few: more than a handful and the
 * choice stops being fun and starts being a settings screen.
 */
export const CAMERA_PROFILES: CameraProfile[] = [
  {
    id: "everyday",
    name: "Everyday",
    description: "No character added.",
    adjustments: {},
    timestamp: false,
    flashLook: false,
  },
  {
    id: "digicam",
    name: "Digicam",
    description: "Cool, crisp, slightly over-sharpened.",
    adjustments: {
      temperature: -0.14,
      contrast: 1.12,
      saturation: 1.12,
      sharpness: 0.6,
      highlights: 0.08,
    },
    timestamp: true,
    flashLook: false,
  },
  {
    id: "disposable",
    name: "Disposable",
    description: "Warm, grainy, imperfect.",
    adjustments: {
      temperature: 0.2,
      shadows: 0.2,
      grain: 0.4,
      vignette: 0.3,
      contrast: 1.06,
    },
    timestamp: false,
    flashLook: false,
  },
  {
    id: "flashback",
    name: "Flashback",
    description: "Direct flash. Subject wins.",
    adjustments: {
      exposure: 0.22,
      contrast: 1.2,
      shadows: -0.25,
      vignette: 0.45,
    },
    timestamp: true,
    flashLook: true,
  },
  {
    id: "soft",
    name: "Soft",
    description: "Bloomed highlights, low contrast.",
    adjustments: {
      contrast: 0.88,
      bloom: 0.35,
      temperature: 0.12,
      exposure: 0.08,
    },
    timestamp: false,
    flashLook: false,
  },
  {
    id: "night-out",
    name: "Night Out",
    description: "Contrast for dark rooms.",
    adjustments: {
      contrast: 1.22,
      grain: 0.3,
      exposure: 0.1,
      splitShadow: { color: "#1d2740", amount: 0.35 },
    },
    timestamp: false,
    flashLook: true,
  },
];

export const DEFAULT_PROFILE_ID = "everyday";
