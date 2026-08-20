/**
 * The plastic each camera model is made of.
 *
 * Turning the dial should feel like picking up a different camera, not like
 * relabelling the same one — so every model carries its own body colour, accent
 * light and lens tint. Kept as data next to the filters rather than as branches
 * inside the shell, so adding a model stays a one-object change.
 *
 * Keyed by filter id. Anything without an entry gets the default graphite body.
 */
export interface CameraBody {
  /** Gradient stops for the moulding, light to dark. */
  body: [string, string, string];
  /** Status LED and accent trim. */
  accent: string;
  /** Ring around the screen bezel. */
  lens: string;
  /**
   * Colour for text printed on the body.
   *
   * Carried per model rather than assumed white: the instant-film body is
   * cream, and white-on-cream makes the wordmark and the model name vanish.
   */
  ink: string;
  /**
   * Print format this camera produces.
   *
   * `instant` mounts the photograph in a white frame with a deep chin, because
   * that border is what a Polaroid *is* — a grade alone does not make one.
   */
  print?: "instant";
}

/** Printed ink for a dark body, and for a light one. */
const LIGHT_INK = "#f5f0e7";
const DARK_INK = "#2a2520";

const DEFAULT_BODY: CameraBody = {
  body: ["#6f6660", "#3d3733", "#2e2926"],
  accent: "#ea4f34",
  lens: "#8d8279",
  ink: LIGHT_INK,
};

const BODIES: Record<string, CameraBody> = {
  // Warm champagne silver.
  "2003": { body: ["#a99d8c", "#6d6355", "#3c352d"], accent: "#e0533a", lens: "#cbbfa8", ink: DARK_INK },
  // Cool graphite with a yellow flash lamp.
  ccd: { body: ["#7e858c", "#464c52", "#25292d"], accent: "#f0c419", lens: "#aab3bb", ink: LIGHT_INK },
  // Near-black with a blue indicator.
  flash: { body: ["#5a5e66", "#2f3238", "#15171a"], accent: "#3f9bff", lens: "#8b929c", ink: LIGHT_INK },
  // Retro chrome and green.
  "1999": { body: ["#b9b2a3", "#7b7466", "#403b32"], accent: "#3fae6b", lens: "#d6cfbd", ink: DARK_INK },
  // Slim gunmetal blue.
  "2007": { body: ["#6b7684", "#3a434f", "#1d2229"], accent: "#4fc3d9", lens: "#96a3b2", ink: LIGHT_INK },
  // Cream plastic and a red shutter lamp.
  "point-and-shoot": {
    body: ["#d8cdb4", "#9a8f74", "#4f4838"],
    accent: "#e8453c",
    lens: "#efe6ce",
    ink: DARK_INK,
  },
  // Big black camcorder body, red record lamp.
  camcorder: { body: ["#4a4a4a", "#262626", "#101010"], accent: "#ff3b30", lens: "#7d7d7d", ink: LIGHT_INK },
  // Tape: dark charcoal with a magenta tell.
  "mini-dv": { body: ["#55505c", "#302c36", "#17151b"], accent: "#e26bb0", lens: "#8b8494", ink: LIGHT_INK },
  // Bright silver superzoom.
  superzoom: { body: ["#b7bcc0", "#787d82", "#3c4044"], accent: "#2f7fd0", lens: "#d9dde0", ink: DARK_INK },
  // Matte white plastic.
  webcam: { body: ["#d6d6d2", "#95958f", "#4c4c48"], accent: "#5bb85b", lens: "#eaeae6", ink: DARK_INK },
  // Candy-shell compact.
  "pocket-cam": { body: ["#c9a2a6", "#8b5f66", "#402a2f"], accent: "#ff7a9c", lens: "#e6c4c8", ink: DARK_INK },
  // Instant film: the white body everyone pictures.
  polaroid: {
    body: ["#efe9df", "#b9b1a3", "#5d574d"],
    accent: "#f2a03d",
    lens: "#ffffff",
    ink: DARK_INK,
    print: "instant",
  },
};

export function getCameraBody(filterId: string): CameraBody {
  return BODIES[filterId] ?? DEFAULT_BODY;
}
