# Y2K Zine identity, and strip caption typography

**Date:** 2026-09-19
**Status:** Awaiting user review
**Branch:** `pastel-v2` (base `ecf2727`)
**Supersedes the visual layer of:** `2026-09-10-pastel-ui-design.md` (palette and gates survive)

---

## Why this exists

The pastel redesign shipped to `main` and was rejected on sight: *"the whole ui is not
newjeans coded. it's just plain."* Every gate passed — 29/29 contrast, 304 unit tests,
26/26 e2e — and the result was still generic.

The diagnosis, from the shipped home screen:

1. **Ink is only ever text.** `cocoa-900` never appears as a rule, a block or a shape.
   Pastel without ink reads washy.
2. **No scale drama.** One 4rem heading against 14px body, and nothing else.
3. **No vocabulary.** The old film kit (sprockets, perforation, halftone, film-edge) was
   deleted and replaced with `chip` and `pillow` — a generic vocabulary, not a different
   one. The dark version had more character than the pastel one.
4. **Photos are thumbnails in a scroller**, not objects — in a camera app.

Direction A ("Y2K Zine") was chosen from a rendered direction board rather than from
adjectives, because adjectives are what produced the rejected build.

## What this is not

A second rebuild. The palette, the contrast gate, every behaviour and every test survive
untouched. This is a **personality layer**: ink as a graphic material, a real type scale,
an ornament kit, and photographs treated as objects.

## Non-goals

Unchanged, and out of bounds:

- `lib/filters/*` grading maths
- `lib/booth/templates.ts` geometry and the compositor's layout logic
- `lib/db/*`, `lib/sync/*`, `lib/camera/{service,capture,motion}.ts`
- `isFrameReady`, `SCREEN_FLASH_SETTLE_MS`, the shutter queue, `findUltraWide`
- The five pastel hues and the cream/cocoa ramps — **no hex changes**
- The two deliberately dark surfaces: the photo viewer and the running booth
- Capability gating, the signed-out path, the offline path, the performance ceilings

---

## Part 1 — The Y2K Zine system

### 1.1 Ink becomes a material

`cocoa-900` stops being only text and becomes the system's structural element:

- **Rules.** 3px solid ink, used to separate masthead from content. Not hairlines.
- **Blocks.** Solid `cocoa-900` fills with `cream-50` text (14.03:1, already gated) for
  primary actions and micro-labels.
- **Outlines.** 2px ink borders on panels, replacing the soft card edge.

This is the single biggest change, and the one that makes pastel read as designed rather
than as default.

### 1.2 Hard shadows replace soft ones

`.pillow`'s two-layer blurred shadow is the visual signature of every soft app since
2020. It is replaced by a **hard offset shadow in a pastel hue** — no blur:

```
box-shadow: 6px 6px 0 var(--color-sky-base);
```

`.pillow` is **not** redefined in place — the name would then lie. A new `.slab` utility
is introduced and card usages migrate to it; `.pillow` is deleted once nothing uses it,
the same additive-then-subtractive pattern the previous refactor proved.

### 1.3 Typography

| Role | Now | Becomes | Carries |
|---|---|---|---|
| `font-display` | Fredoka | **Archivo 800** | headings, wordmark, CTA blocks |
| `font-sans` | Plus Jakarta Sans | **unchanged** | body copy, all user text |
| `font-mono` | DM Mono | **unchanged**, promoted | tracked-caps micro-labels, counters |

Archivo at 800 with `-0.04em` tracking at large sizes is the zine voice. Fredoka is
retired from the interface — it is the rounded-toy face that made the build read as
generic-cute rather than as anything specific.

**The user-text rule survives:** roll titles, captions and names stay `font-sans`.
Archivo's coverage is narrower and a CJK or emoji title would fall back mid-string.

`font-mono` gets promoted from "counters only" to carrying the zine's micro-labels —
`REC ●`, `36 EXP`, `NO. 001`, `01 / 02` — in tracked caps. This is a documented change
to the Typography rule in CLAUDE.md, which currently says mono is "only where digits
must align; it is not decoration."

### 1.4 The ornament kit

Replacing `chip` and `pillow`, added to `globals.css`:

| Utility | What it is |
|---|---|
| `.rule-ink` | 3px solid ink rule |
| `.blk` | solid ink block, cream tracked-caps mono text |
| `.slab` | 2px ink border + hard pastel offset shadow |
| `.sticker` | rotated, ink-bordered, pastel-filled badge |
| `.tape` | translucent pastel tape strip (pseudo-element) |
| `.polaroid` | cream frame, ink border, deep chin; tiltable |
| `.counter` | mono tracked-caps exposure counter |

`.chip` is kept but restyled as a **square** ink-bordered tag, not a soft lozenge.
`.soft-grain`, `.squish`, `.hairline` and the `tint-*` set survive unchanged.

Migration scope, measured rather than estimated: `.pillow` has **10** consuming files,
`.chip` has **2**, and `font-display` (the Fredoka → Archivo swap) touches **19**.

### 1.5 Photographs become objects

The contact strip stops being a scroller of rounded thumbnails and becomes **overlapping,
tilted polaroids with tape**. Roll cards become slabs with ink borders. This is both more
on-reference and more appropriate for a camera app.

`--radius-frame` drops from `0.75rem` toward `0.25rem`: a photograph in this language is
a rectangle with a border, not a rounded sticker.

Note the difference from last time: when the pastel refactor changed this token it had
**zero** users and the change was inert. It now has **6**, so this is a visible change to
photo corners in six places, not a token edit. Verified by
`grep -rn "rounded-frame" src --include=*.tsx`.

### 1.6 Layout

The single centred `max-w-2xl` column with even `mt-*` gaps is the other half of why it
reads generic. Home gains a **masthead**: a mono topline (`REC ●` / `36 EXP · 2026`), the
wordmark at ~52px, a 3px rule, a tracked-caps kicker. Panels become numbered (`01 CAMERA`,
`02 BOOTH`) — numbering that encodes real order, not decoration.

### 1.7 Contrast consequences

Every new pairing must be gated. The ones this introduces:

- `cream-50` on `cocoa-900` (ink blocks) — 14.03:1, **already gated**
- `cocoa-900` on each pastel `base` (stickers) — 8.48–11.36:1, **already gated**
- `cocoa-600` on `cream-50` (mono micro-labels) — 5.35:1, **already gated**

Hard offset shadows and tape are decorative and carry no text, so they need no pair. If
implementation introduces a pairing not in the list above, it is added to
`scripts/check-contrast.mjs` before it ships. The gate never drops below 29 pairs.

---

## Part 2 — Strip caption typography

### 2.1 The existing defect

`strip-editor.tsx` labels the `display` option **"Serif"**. `display` is Fredoka, a
rounded sans — the label has been wrong since the face changed. The strip has no serif
today despite offering a button that says it does.

### 2.2 The new set

`BoothCaption["font"]` goes from three members to six:

| Value | Face | Label |
|---|---|---|
| `display` | Archivo 800 | Bold |
| `sans` | Plus Jakarta Sans | Sans |
| `mono` | DM Mono | Mono |
| `serif` | **Cormorant Garamond** | Serif |
| `hand` | **Caveat** | Handwritten |
| `script` | **Dancing Script** | Script |

All three new faces are self-hosted through `next/font/google`. The no-third-party e2e
test is the proof.

The union is **additive**: every saved strip keeps its `captionFont` and keeps rendering.
`FONT_FALLBACKS` is a `Record` over the union, so TypeScript forces an entry for each new
member — a missing fallback cannot compile.

### 2.3 The canvas font trap

**This is the part that silently breaks.** The compositor draws captions to canvas, and
canvas falls back to a generic when a face is not yet loaded — with no error. The current
three faces are safe only because the whole interface uses them constantly. A
caption-only face downloads lazily, so the first strip composed could render in the wrong
font and nothing would report it.

Two defences, both required:

1. The picker renders **each label in its own face**, which puts every face in the DOM and
   triggers its download. This is also better UX — you see what you are choosing.
2. `compose` awaits `document.fonts.load(...)` for the selected face before drawing, and
   the existing `fontStack` fallback covers workers and tests where there is no document.

### 2.4 Optical sizing

These faces have very different x-heights: Cormorant Garamond and Dancing Script set far
smaller than Archivo at the same pixel size. Without correction, choosing "Script" would
visibly shrink the caption.

Each face gets a **size multiplier** applied in the compositor, so a caption looks the
same weight on the strip whatever face is chosen. `BoothCaption.size` keeps its meaning;
the multiplier is a rendering detail beside `FONT_FALLBACKS`.

---

## Surface inventory

Everything below is restyled. Behaviour, props and accessible names are preserved.

**Foundation** — `app/globals.css` (ornament kit, hard shadows, radii), `app/layout.tsx`
(Archivo display + three caption faces), `components/ui/{button,sheet,slider}.tsx`

**Shell** — `shell/{app-frame,tab-bar,offline-banner,wordmark}.tsx`,
`providers/toast-provider.tsx`, `pwa/service-worker-bridge.tsx`

**Home** — `home/home-screen.tsx` (masthead, ink CTA block, numbered panels, polaroid strip)

**Rolls** — the ten under `components/roll/` (roll cards → slabs, contact sheet → objects)

**Booth** — the six under `components/booth/`, plus the caption picker in `strip-editor.tsx`

**Camera** — the ten under `components/camera/` (body furniture in zine mono, ink readout)

**Settings / edges** — `settings/*`, `app/{error,not-found}.tsx`, `app/offline/page.tsx`,
`components/dev/render-check.tsx`

**Data** — `lib/booth/types.ts` (font union), `lib/booth/compositor.ts` (fallbacks,
multipliers, font loading)

---

## Preserved contracts

Accessible names the e2e suite selects on, verbatim: `"Take a photo"`, `"Start a Roll"`,
`"Start shooting"`, `"Start the booth"`, `"Choose a booth"`,
`"Watch the clip of this shoot"`, `"Add to favourites"`, `"Remove from favourites"`,
`"Keep it"`, `"Close"`, `"Rolls"`, `"Your strip"`, `"Camera"`,
`"Open your camera photos"`, `"Instant Pair"`, `/^Frame 1/`, the `navigation` (`"Main"`)
and `tab` roles, and the `clip-action` / `clip-video` test ids.

Also preserved: the `data-hydrated` marker, every `sr-only` companion, `aria-hidden` on
body furniture, and the dark-ground inversion rule in `capture-viewer.tsx`,
`booth-runner.tsx`, `clip-dialog.tsx` and `PermissionGate tone="dark"`.

---

## Testing

`pnpm check` (lint, typecheck, **contrast ≥29/29**, unit, build) plus `pnpm test:e2e`.

Specific gates:

- **"never sends a request to a third party"** proves the four new faces (Archivo plus
  three caption faces) are genuinely self-hosted. This is the most important check in
  Part 2.
- **`fontStack` unit tests extend to the three new kinds** — each must return a stack
  whose generic matches its class (serif for `serif`, cursive for `hand` and `script`).
- **Tailwind v4 emits nothing for a deleted token**, so removing `.pillow` and `.chip`'s
  old form is proved by a word-bounded grep, never by a green build.
- `/dev/render-check` stays pixel-identical — the grading maths is out of bounds and this
  page is the canary.

---

## Documentation

CLAUDE.md is rewritten where this contradicts it:

- **Typography** — Archivo replaces Fredoka as `font-display`; the mono rule changes from
  "not decoration" to "tracked-caps micro-labels are part of the system."
- **Colour** — gains the ink-as-material rule. The three-step pastel contract, the
  lit-lamp rule and the dark-ground inversion all survive verbatim.
- A new short **Ornament** section naming the kit, so the next contributor reaches for
  `.slab` rather than inventing a card.

---

## Risks

| Risk | Mitigation |
|---|---|
| A caption face isn't loaded when canvas draws; strip silently renders wrong | Picker renders each label in its own face **and** `document.fonts.load` before compose (§2.3) |
| "Bold everything" becomes noise rather than personality | Ink is structural — rules, blocks, outlines. Body copy stays `font-sans` at normal weight |
| Ink-heavy chrome fights the photographs | Photos sit in cream polaroid frames; ink is the frame, never the image |
| A third redesign that still misses | Direction was chosen from a rendered board, and this lands on `pastel-v2` as one reviewable branch |
| Stale `.pillow`/`.chip` usages render unstyled | Additive-then-subtractive, closed by a word-bounded grep (`\b` — `shrink-0` falsely matches `ink-0`) |
