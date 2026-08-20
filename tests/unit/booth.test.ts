import { describe, expect, it } from "vitest";
import {
  BOOTH_TEMPLATES,
  getTemplate,
  listTemplateCategories,
  templateAspect,
} from "@/lib/booth/templates";
import { PAPERS, PAPER_IDS } from "@/lib/booth/types";

/**
 * Templates are data, so they can be checked as data. These tests are the
 * guardrail on the layout builder: a slot that escapes the canvas or a caption
 * printed off the bottom of the paper is invisible in code review and obvious
 * in an exported strip.
 */
describe("booth templates", () => {
  it("ships a template for a useful spread of occasions", () => {
    expect(BOOTH_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(listTemplateCategories().length).toBeGreaterThanOrEqual(6);
  });

  it("has no duplicate ids", () => {
    const ids = BOOTH_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to the classic strip for an unknown id", () => {
    expect(getTemplate("nope").id).toBe(BOOTH_TEMPLATES[0].id);
    expect(getTemplate(undefined).id).toBe(BOOTH_TEMPLATES[0].id);
  });

  it.each(BOOTH_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s has one slot per shot",
    (_name, template) => {
      expect(template.slots).toHaveLength(template.shots);
    },
  );

  it.each(BOOTH_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s keeps every slot inside the canvas",
    (_name, template) => {
      for (const slot of template.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.height).toBeGreaterThan(0);
        expect(slot.x + slot.width).toBeLessThanOrEqual(template.width + 0.5);
        expect(slot.y + slot.height).toBeLessThanOrEqual(template.height + 0.5);
      }
    },
  );

  it.each(BOOTH_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s never overlaps two slots",
    (_name, template) => {
      const slots = template.slots;
      for (let a = 0; a < slots.length; a++) {
        for (let b = a + 1; b < slots.length; b++) {
          const overlapX =
            slots[a].x < slots[b].x + slots[b].width && slots[b].x < slots[a].x + slots[a].width;
          const overlapY =
            slots[a].y < slots[b].y + slots[b].height && slots[b].y < slots[a].y + slots[a].height;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    },
  );

  it.each(BOOTH_TEMPLATES.filter((t) => t.caption).map((t) => [t.name, t] as const))(
    "%s prints its caption on the paper, below the photos",
    (_name, template) => {
      const caption = template.caption!;
      expect(caption.y).toBeLessThanOrEqual(template.height);
      expect(caption.x).toBeGreaterThanOrEqual(0);
      expect(caption.x).toBeLessThanOrEqual(template.width);
      const lowestSlot = Math.max(...template.slots.map((s) => s.y + s.height));
      expect(caption.y).toBeGreaterThan(lowestSlot);
    },
  );

  it.each(BOOTH_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s uses a paper that exists",
    (_name, template) => {
      expect(PAPER_IDS).toContain(template.defaultPaper);
    },
  );

  it("reports the slot aspect the camera should shoot to", () => {
    const classic = getTemplate("classic-4");
    expect(templateAspect(classic)).toBeCloseTo(4 / 3, 4);
    expect(templateAspect(getTemplate("slim-3"))).toBeCloseTo(1, 4);
  });

  it("gives the classic strip roughly 2:6 print proportions", () => {
    const classic = getTemplate("classic-4");
    expect(classic.height / classic.width).toBeGreaterThan(2.6);
    expect(classic.height / classic.width).toBeLessThan(3.4);
  });
});

describe("papers", () => {
  it("defines ink and muted colours for every paper", () => {
    for (const id of PAPER_IDS) {
      const paper = PAPERS[id];
      expect(paper.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(paper.ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(paper.muted).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
