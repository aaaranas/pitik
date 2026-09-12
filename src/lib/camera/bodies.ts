/**
 * The plastic each camera model is made of.
 *
 * Turning the dial should feel like picking up a different camera, not like
 * relabelling the same one — so every model carries its own body colour, accent
 * light and lens tint. Kept as data next to the filters rather than as branches
 * inside the shell, so adding a model stays a one-object change.
 *
 * Keyed by filter id. Anything without an entry gets the default warm-tan body.
 */
export interface CameraBody {
  /** Gradient stops for the moulding, light to dark. */
  body: [string, string, string];
  /**
   * Status LED and accent trim.
   *
   * On these pale bodies a LIT lamp reads as darker than the moulding, not
   * brighter — a light accent reads as "off". Enforced by
   * tests/unit/camera-bodies.test.ts.
   */
  accent: string;
  /** Ring around the screen bezel. */
  lens: string;
  /**
   * Colour for text printed on the body.
   *
   * Carried per model rather than assumed constant: every body in this set is
   * pale, but the field stays per-model so a future dark or saturated body
   * cannot silently inherit ink that vanishes on it.
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

/**
 * Printed ink for these bodies.
 *
 * Every body in the pastel set is pale, so cocoa is the only ink used. The
 * field stays per-model rather than becoming a constant: it is what stops a
 * future body from being given white text on cream, which is the bug it was
 * added to prevent.
 */
const COCOA_INK = "#2F2823";

const DEFAULT_BODY: CameraBody = {
  body: ["#E9E3DA", "#CFC6B9", "#9A9086"],
  accent: "#A4506C",
  lens: "#F2EDE6",
  ink: COCOA_INK,
};

const BODIES: Record<string, CameraBody> = {
  // Warm butter plastic.
  "2003": { body: ["#FDF2D8", "#F7E3A1", "#B99C4E"], accent: "#B36F4A", lens: "#FFF8E8", ink: COCOA_INK },
  // Powder blue with a mustard flash lamp.
  ccd: { body: ["#E6F0FB", "#C3D9F3", "#7E9AC0"], accent: "#8F7226", lens: "#F4F8FE", ink: COCOA_INK },
  // Baby blue with a deep blue indicator.
  flash: { body: ["#E2ECFA", "#A8C9F0", "#6484B0"], accent: "#3F6E9B", lens: "#EFF5FD", ink: COCOA_INK },
  // Mint, with a green tell.
  "1999": { body: ["#E8F5EE", "#B6E3D4", "#6FA695"], accent: "#3F8664", lens: "#F3FAF7", ink: COCOA_INK },
  // Pale teal slimline.
  "2007": { body: ["#E7F3F6", "#BADCE6", "#74A2AF"], accent: "#3A808F", lens: "#F2F9FB", ink: COCOA_INK },
  // Blush compact with a rose shutter lamp.
  "point-and-shoot": {
    body: ["#FFF1F4", "#F5B8CB", "#B87A90"],
    accent: "#B24A62",
    lens: "#FFF7F9",
    ink: COCOA_INK,
  },
  // Lilac camcorder, rose record lamp.
  camcorder: { body: ["#EFE9FA", "#D4C4EE", "#8E7BB5"], accent: "#A8526E", lens: "#F6F2FD", ink: COCOA_INK },
  // Tape: orchid with a magenta tell.
  "mini-dv": { body: ["#FBEAF6", "#EEC4E4", "#A87BA0"], accent: "#A7558E", lens: "#FDF4FA", ink: COCOA_INK },
  // Cool pearl superzoom.
  superzoom: { body: ["#EDEFF2", "#CFD6DE", "#8C96A3"], accent: "#4D77A6", lens: "#F6F8FA", ink: COCOA_INK },
  // Pale sage plastic.
  webcam: { body: ["#F3F6F0", "#DCE7D5", "#94A78B"], accent: "#608850", lens: "#F9FBF7", ink: COCOA_INK },
  // Peach candy shell.
  "pocket-cam": { body: ["#FFF0EA", "#FAD2BE", "#BE8E76"], accent: "#B56344", lens: "#FFF7F3", ink: COCOA_INK },
  // Instant film: still the white body everyone pictures.
  polaroid: {
    body: ["#FFFFFF", "#F2EEE7", "#B3ABA0"],
    accent: "#4F8AC1",
    lens: "#FFFFFF",
    ink: COCOA_INK,
    print: "instant",
  },
};

export function getCameraBody(filterId: string): CameraBody {
  return BODIES[filterId] ?? DEFAULT_BODY;
}
