import type { BoothSlot, BoothTemplate } from "./types";

/**
 * Layout maths, then the shipped templates.
 *
 * Slot positions are computed rather than typed out so that a template is
 * described by its *intent* — "four 4:3 frames stacked, with room for a
 * caption" — instead of thirty-two magic numbers that drift apart the first
 * time someone adjusts the padding.
 */

interface GridOptions {
  columns: number;
  rows: number;
  /** Width/height of each photo well. */
  slotAspect: number;
  /** Canvas width. Height is derived from the grid. */
  width: number;
  padding: number;
  gap: number;
  /** Extra space below the grid, for a caption or the classic strip footer. */
  footer: number;
  radius?: number;
}

function buildGrid(options: GridOptions): {
  slots: BoothSlot[];
  width: number;
  height: number;
} {
  const { columns, rows, slotAspect, width, padding, gap, footer } = options;
  const usableWidth = width - padding * 2 - gap * (columns - 1);
  const slotWidth = usableWidth / columns;
  const slotHeight = slotWidth / slotAspect;
  const height = padding * 2 + rows * slotHeight + gap * (rows - 1) + footer;

  const slots: BoothSlot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      slots.push({
        x: padding + column * (slotWidth + gap),
        y: padding + row * (slotHeight + gap),
        width: slotWidth,
        height: slotHeight,
        radius: options.radius ?? 0,
      });
    }
  }
  return { slots, width, height: Math.round(height) };
}

const hairline = (color: string) => ({ width: 2, color });

export const BOOTH_TEMPLATES: BoothTemplate[] = [
  (() => {
    // The archetype: 2×6 inch strip, four landscape frames, signature footer.
    const grid = buildGrid({
      columns: 1,
      rows: 4,
      slotAspect: 4 / 3,
      width: 800,
      padding: 40,
      gap: 22,
      footer: 150,
    });
    return {
      id: "classic-4",
      name: "Classic 4",
      category: "Classic",
      description: "Four frames, one long strip. The one everybody knows.",
      width: grid.width,
      height: grid.height,
      shots: 4,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 62,
        align: "center",
        size: 46,
        font: "display",
        placeholder: "us, tonight",
        maxLength: 28,
      },
      defaultPaper: "cream",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 1,
      rows: 3,
      slotAspect: 1,
      width: 760,
      padding: 34,
      gap: 18,
      footer: 120,
    });
    return {
      id: "slim-3",
      name: "Slim 3",
      category: "Minimal",
      description: "Three squares. Nothing else on the paper.",
      width: grid.width,
      height: grid.height,
      shots: 3,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 48,
        align: "center",
        size: 30,
        font: "mono",
        placeholder: "",
        maxLength: 24,
      },
      defaultPaper: "white",
    } satisfies BoothTemplate;
  })(),

  (() => {
    // Horizontal strip: portrait frames side by side, made for a table shot.
    const grid = buildGrid({
      columns: 4,
      rows: 1,
      slotAspect: 3 / 4,
      width: 2200,
      padding: 44,
      gap: 22,
      footer: 130,
    });
    return {
      id: "wide-4",
      name: "Wide 4",
      category: "Friends",
      description: "Four upright frames, shoulder to shoulder.",
      width: grid.width,
      height: grid.height,
      shots: 4,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 48,
        align: "center",
        size: 44,
        font: "display",
        placeholder: "the whole group",
        maxLength: 32,
      },
      defaultPaper: "cream",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 2,
      rows: 2,
      slotAspect: 1,
      width: 1200,
      padding: 44,
      gap: 22,
      footer: 130,
      radius: 8,
    });
    return {
      id: "grid-2x2",
      name: "Quad",
      category: "Classic",
      description: "Two by two. Balanced, easy to post.",
      width: grid.width,
      height: grid.height,
      shots: 4,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 50,
        align: "center",
        size: 42,
        font: "display",
        placeholder: "",
        maxLength: 30,
      },
      defaultPaper: "cream",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 3,
      rows: 2,
      slotAspect: 4 / 3,
      width: 1500,
      padding: 40,
      gap: 18,
      footer: 120,
    });
    return {
      id: "grid-3x2",
      name: "Six Up",
      category: "Party",
      description: "Six frames. Room for everyone to be ridiculous.",
      width: grid.width,
      height: grid.height,
      shots: 6,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 46,
        align: "center",
        size: 38,
        font: "display",
        placeholder: "",
        maxLength: 34,
      },
      defaultPaper: "cream",
    } satisfies BoothTemplate;
  })(),

  (() => {
    // Instant-film proportions: square image high on the paper, deep chin
    // below it. The asymmetry is the whole point, so it's set by hand.
    const width = 1500;
    const padding = 46;
    const gap = 40;
    const slotWidth = (width - padding * 2 - gap) / 2;
    const chin = slotWidth * 0.34;
    const height = Math.round(padding * 2 + slotWidth + chin + 70);
    return {
      id: "polaroid-pair",
      name: "Instant Pair",
      category: "Cute",
      description: "Two instant frames with a chin to write on.",
      width,
      height,
      shots: 2,
      slots: [
        { x: padding, y: padding, width: slotWidth, height: slotWidth },
        { x: padding + slotWidth + gap, y: padding, width: slotWidth, height: slotWidth },
      ],
      slotBorder: null,
      caption: {
        x: width / 2,
        y: padding + slotWidth + chin * 0.72,
        align: "center",
        size: 52,
        font: "display",
        placeholder: "date night",
        maxLength: 26,
      },
      defaultPaper: "white",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 1,
      rows: 1,
      slotAspect: 4 / 5,
      width: 1200,
      padding: 52,
      gap: 0,
      footer: 190,
    });
    return {
      id: "single-frame",
      name: "One Shot",
      category: "Minimal",
      description: "A single frame, framed properly.",
      width: grid.width,
      height: grid.height,
      shots: 1,
      slots: grid.slots,
      slotBorder: hairline("rgba(0,0,0,0.12)"),
      caption: {
        x: grid.width / 2,
        y: grid.height - 84,
        align: "center",
        size: 58,
        font: "display",
        placeholder: "",
        maxLength: 30,
      },
      defaultPaper: "cream",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 3,
      rows: 3,
      slotAspect: 3 / 2,
      width: 1600,
      padding: 36,
      gap: 10,
      footer: 96,
    });
    return {
      id: "contact-sheet",
      name: "Contact Sheet",
      category: "Film",
      description: "Nine frames, numbered, like a proof sheet.",
      width: grid.width,
      height: grid.height,
      shots: 9,
      slots: grid.slots,
      slotBorder: null,
      numbered: true,
      caption: {
        x: 36,
        y: grid.height - 38,
        align: "left",
        size: 26,
        font: "mono",
        placeholder: "",
        maxLength: 40,
      },
      defaultPaper: "carbon",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 2,
      rows: 2,
      slotAspect: 1,
      width: 1200,
      padding: 66,
      gap: 30,
      footer: 150,
      radius: 34,
    });
    return {
      id: "y2k-quad",
      name: "Y2K Quad",
      category: "Y2K",
      description: "Fat rounded frames on candy paper.",
      width: grid.width,
      height: grid.height,
      shots: 4,
      slots: grid.slots,
      slotBorder: { width: 8, color: "rgba(0,0,0,0.18)" },
      caption: {
        x: grid.width / 2,
        y: grid.height - 58,
        align: "center",
        size: 48,
        font: "sans",
        placeholder: "★ best night ★",
        maxLength: 26,
      },
      defaultPaper: "blush",
    } satisfies BoothTemplate;
  })(),

  (() => {
    const grid = buildGrid({
      columns: 1,
      rows: 2,
      slotAspect: 3 / 2,
      width: 900,
      padding: 44,
      gap: 24,
      footer: 156,
    });
    return {
      id: "date-night",
      name: "Date Night",
      category: "Date Night",
      description: "Two wide frames on dark paper.",
      width: grid.width,
      height: grid.height,
      shots: 2,
      slots: grid.slots,
      slotBorder: null,
      caption: {
        x: grid.width / 2,
        y: grid.height - 66,
        align: "center",
        size: 50,
        font: "display",
        placeholder: "just us",
        maxLength: 24,
      },
      defaultPaper: "ink",
    } satisfies BoothTemplate;
  })(),
];

export function getTemplate(id: string | undefined): BoothTemplate {
  return BOOTH_TEMPLATES.find((template) => template.id === id) ?? BOOTH_TEMPLATES[0];
}

export function listTemplateCategories(): string[] {
  const seen: string[] = [];
  for (const template of BOOTH_TEMPLATES) {
    if (!seen.includes(template.category)) seen.push(template.category);
  }
  return seen;
}

/**
 * The framing each slot wants, so the camera can shoot to the right shape
 * instead of cropping a mismatched frame after the fact.
 */
export function templateAspect(template: BoothTemplate): number {
  const slot = template.slots[0];
  return slot.width / slot.height;
}
