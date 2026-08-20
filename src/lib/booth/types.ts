/**
 * Photobooth layout model.
 *
 * A template is pure geometry plus styling hints — no drawing code. The
 * compositor knows how to render *any* template, which is what makes the
 * custom-booth designer possible: it edits this data and nothing else.
 *
 * All coordinates are in canvas pixels against the template's own
 * `width`/`height`, so a template scales to any export size by one transform.
 */

export const BOOTH_CATEGORIES = [
  "Classic",
  "Cute",
  "Minimal",
  "Retro",
  "Y2K",
  "Film",
  "Date Night",
  "Friends",
  "Party",
  "Seasonal",
] as const;

export type BoothCategory = (typeof BOOTH_CATEGORIES)[number];

export interface BoothSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees. Used by scrapbook-style layouts. */
  rotate?: number;
  /** Corner radius in canvas pixels. */
  radius?: number;
}

export interface BoothCaption {
  x: number;
  y: number;
  align: CanvasTextAlign;
  /** Font size in canvas pixels. */
  size: number;
  font: "display" | "sans" | "mono";
  placeholder: string;
  maxLength: number;
}

export interface BoothTemplate {
  id: string;
  name: string;
  category: BoothCategory;
  description: string;
  width: number;
  height: number;
  /** Number of photographs the sequence will take. */
  shots: number;
  slots: BoothSlot[];
  /** Hairline drawn around each slot. `null` for borderless layouts. */
  slotBorder: { width: number; color: string } | null;
  caption: BoothCaption | null;
  /** Small sequence numbers in each frame's corner, contact-sheet style. */
  numbered?: boolean;
  /** Default paper for this template; the user can override at export. */
  defaultPaper: PaperId;
}

export type PaperId = "cream" | "white" | "ink" | "blush" | "sage" | "carbon";

export interface Paper {
  id: PaperId;
  name: string;
  background: string;
  /** Text and hairline colour that reads on this paper. */
  ink: string;
  muted: string;
}

export const PAPERS: Record<PaperId, Paper> = {
  cream: { id: "cream", name: "Cream", background: "#f5f0e7", ink: "#241f1d", muted: "#8c8178" },
  white: { id: "white", name: "White", background: "#ffffff", ink: "#1a1a1a", muted: "#8a8a8a" },
  ink: { id: "ink", name: "Ink", background: "#141110", ink: "#f0e9df", muted: "#8a7e75" },
  blush: { id: "blush", name: "Blush", background: "#f7e4e2", ink: "#4a2b2b", muted: "#a97f7c" },
  sage: { id: "sage", name: "Sage", background: "#e4ebe1", ink: "#26332a", muted: "#7d8c7f" },
  carbon: { id: "carbon", name: "Carbon", background: "#0b0908", ink: "#e8e0d6", muted: "#7a6f66" },
};

export const PAPER_IDS = Object.keys(PAPERS) as PaperId[];

/** User-chosen finish applied on top of a template at export time. */
export interface StripStyle {
  paper: PaperId;
  caption: string;
  captionFont: BoothCaption["font"];
  showDate: boolean;
  /** Rounds the outer corners of the print. */
  rounded: boolean;
  /** Adds a fine keyline just inside the paper edge. */
  keyline: boolean;
}

export const DEFAULT_STRIP_STYLE: Omit<StripStyle, "paper"> = {
  caption: "",
  captionFont: "display",
  showDate: true,
  rounded: true,
  keyline: false,
};
