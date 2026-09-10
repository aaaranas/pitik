# Pastel UI redesign

**Date:** 2026-09-10
**Status:** Approved, ready for implementation planning
**Scope:** Visual layer only. No behaviour changes.

---

## Goal

Re-dress Pitik as something soft, bright and cute — a pastel toy-camera set —
in place of the current "darkroom + paper" identity. Every function stays
exactly as it is.

Four decisions were made up front and are settled:

1. **Light everywhere**, including the camera body. No dark-mode holdout for
   the viewfinder or the running booth.
2. **Soft minimal.** Charm comes from colour, roundness and spacing. No
   stickers, doodles, sparkles, mascots or gradient blobs.
3. **Fredoka / Plus Jakarta Sans / DM Mono**, replacing Bebas Neue / Archivo /
   Courier Prime.
4. **Multi-pastel with baby blue as the single primary accent.**

## Non-goals

Explicitly out of scope. Touching any of these means the change has escaped
this spec:

- Filter grading maths — `lib/filters/{presets,math,canvas,css}.ts`
- Booth template geometry and the compositor's layout logic
- The 16 `PAPERS` in `lib/booth/types.ts` — these are baked into saved strips,
  so changing them alters user output rather than the interface
- `lib/db`, `lib/sync`, `lib/camera/{service,capture,motion}.ts`
- `isFrameReady`, `SCREEN_FLASH_SETTLE_MS`, the shutter queue
- Capability gating, the signed-out path, the offline path
- The performance ceilings (1080p sensor, `DEFAULT_MAX_DIMENSION`, booth
  grading ceiling)

---

## 1. Token layer

The current `@theme` block is a dark ramp (`ink-950` → `ink-100`) plus one
accent. It is **replaced, not inverted** — redefining `ink-950` to mean "the
lightest colour" would be a lie that outlives this change. Every consumer is
rewritten; that rewrite is the refactor.

### Ground and ink

```
cream-50   #FDFBF7   milk — the app ground
cream-100  #F9F5EF   subtle banding
cream-200  #F3ECE2   raised surface, cards
cream-300  #E8DED0   decorative dividers, inset wells

cocoa-400  #A8998A   DECORATIVE / DISABLED ONLY — never live text
cocoa-600  #756658   muted and secondary text
cocoa-800  #4A4038   body text
cocoa-900  #2F2823   headings
```

### Pastels

Every hue carries three steps. This is the load-bearing part of the palette:

- **tint** — surface fills and chip backgrounds
- **base** — solid fills, camera bodies, active states
- **deep** — the *only* step allowed to be small text

```
sky     #E4EEFA / #A8C9F0 / #3A6A9C   ← primary accent
blush   #FCEAF0 / #F5B8CB / #A64A6E
butter  #FDF6E0 / #F7E3A1 / #856825
mint    #E6F5EF / #B6E3D4 / #2C7660
lilac   #F1EBFB / #D4C4EE / #6752A0

blush-lamp   #C96284   record indicator
edge-strong  #979088   control boundaries (not decorative dividers)
```

### The contrast rule

**Pastel is for fills, tints and borders. Pastel is never small text unless it
is the `deep` step.** Text sitting on a pastel fill is `cocoa-900`.

These values are not eyeballed. They were solved against WCAG and all 24 pairs
pass:

| Pair | Ratio | Requirement |
|---|---|---|
| `cocoa-900` on `cream-50` | 14.03:1 | 4.5 |
| `cocoa-800` on `cream-50` | 9.76:1 | 4.5 |
| `cocoa-600` on `cream-200` | 4.72:1 | 4.5 |
| `sky-deep` on `sky-tint` | 4.81:1 | 4.5 |
| `blush-deep` on `blush-tint` | 4.75:1 | 4.5 |
| `butter-deep` on `butter-tint` | 4.85:1 | 4.5 |
| `mint-deep` on `mint-tint` | 4.83:1 | 4.5 |
| `lilac-deep` on `lilac-tint` | 5.47:1 | 4.5 |
| `cocoa-900` on `sky-base` | 8.48:1 | 4.5 |
| `sky-deep` focus ring on `cream-50` | 5.46:1 | 3.0 |
| `blush-lamp` on `cream-200` | 3.22:1 | 3.0 |
| `edge-strong` on `cream-50` | 3.05:1 | 3.0 |

The chip pairs (`*-deep` on `*-tint`) are the tightest and the reason the deep
steps are darker than they first look on paper. An earlier, prettier draft of
this palette failed 10 of these 24.

**Deliverable:** the solver becomes `scripts/check-contrast.mjs`, run as part
of the work and available afterwards, so a future palette tweak cannot quietly
break a pair.

### Shape, depth, motion

```
--radius-pill   999px     buttons, chips, tabs
--radius-card   1.5rem    cards, sheets, panels
--radius-slot   1rem      wells, inputs, thumbnails
--radius-frame  0.75rem   photographs
```

`--radius-frame` was `0.125rem` — deliberately sharp, because film is sharp.
Photographs keep the *smallest* new radius so they still read as photographs
rather than as stickers.

Hard offset shadows (`0 10px 0 -4px rgba(0,0,0,0.45)`, a printed-ticket
device) are replaced by two-layer pillow shadows in cocoa at 4–8% opacity.

Motion keeps `--ease-shutter`, `shutter-flash` and `rise`. It adds
`--ease-squish: cubic-bezier(.34,1.56,.64,1)` for a gentle overshoot on press.
`develop` — a contrast/brightness ramp imitating a print coming up in a tray —
is replaced by `pop` (0.96 → 1 with fade), because the darkroom metaphor is
what we are removing. The `prefers-reduced-motion` block stays exactly as is.

---

## 2. Utility layer

Usage was counted before deciding, not assumed. Most of the vintage kit is
already close to dead:

| Removed | Live uses | Replaced by |
|---|---|---|
| `perforated-y` | 0 | — |
| `rule-double` | 1 | spacing |
| `halftone` | 1 | — |
| `sprockets` | 1 | — |
| `film-edge` | 1 | rounded frame |
| `stamp` | 1 | `.chip` |
| `paper-grain` | 3 | `.soft-grain` |
| `hairline` | 5 | kept, recoloured to cocoa 8% |

New utilities:

- `.pillow` — the standard raised card surface
- `.tint-{sky,blush,butter,mint,lilac}` — surface, border and text colour as
  one coherent set, so a tinted region can never be assembled wrongly
- `.chip` — pill badge, pastel tint with matching deep text
- `.soft-grain` — the existing SVG turbulence trick at roughly a third of the
  opacity, so milk surfaces do not read as flat CSS rectangles
- `.squish` — press animation on `--ease-squish`

---

## 3. Typography

Three roles, three faces, all self-hosted through `next/font/google`. The
`--font-*-face` → theme-key indirection documented in CLAUDE.md is **load
bearing and unchanged** — a self-referential custom property silently resolves
to nothing, which is a bug this project has already paid for once.

| Role | Was | Becomes | Carries |
|---|---|---|---|
| `font-display` | Bebas Neue | **Fredoka** | headings, wordmark, our words |
| `font-sans` | Archivo | **Plus Jakarta Sans** | body copy, all user text |
| `font-mono` | Courier Prime | **DM Mono** | counters, frame numbers, timers, timestamps |

### Two rule changes, on the record

**`font-display` stops being caps-only.** Mixed-case Fredoka is the entire
point. The `uppercase tracking-[0.28em]` treatment is doing most of the
"vintage" work across 20 files and all of it comes off.

**User text stays in `font-sans` — same rule, new reason.** The old
justification (a roll named "Dinner with Sam" gets shouted back as DINNER WITH
SAM) dies with caps-only. The rule survives on a different ground: Fredoka's
character coverage is narrower than Plus Jakarta's, so an emoji or CJK roll
title would fall back mid-string and break the line. Roll titles, captions and
names remain `font-sans`.

`font-mono` keeps only the jobs where digits must align — the frame counter,
the self-timer, roll counts, timestamps — and loses the wide-tracked uppercase
treatment everywhere else. Reducing typewriter furniture is most of what makes
the app stop looking like a film carton.

### Canvas

`lib/booth/compositor.ts` resolves font stacks off the document at runtime, so
the swap flows through automatically. One correction is needed: its
`FONT_FALLBACKS.display` currently falls back to `ui-serif, Georgia, serif`,
which is wrong for a rounded sans and would produce a visibly different strip
in workers and tests. It becomes a sans stack.

---

## 4. Camera bodies

All 11 entries in `lib/camera/bodies.ts` get pastel gradients and cocoa ink,
each a distinct hue so the dial still reads as eleven different cameras rather
than one camera in five shades.

**Accepted trade-off:** the dial names real makers and exact models on purpose
(commit `a5a4bfc`). A pastel body no longer matches what the real camera looked
like. Names, dial order, `print` behaviour and every grade are untouched — only
the moulding colour changes.

`accent` stays a step deeper than its body. A status LED at `*-base` on a
pastel body reads as *off*, which would be a functional regression on an
indicator; the same reasoning gives the record lamp its own `blush-lamp` value.

`ink` per body stays a real per-model decision — a pale body needs cocoa text,
and white-on-pastel is exactly the bug the `ink` field was added to prevent.

---

## 5. Consequences of going light

Two changes in `app/layout.tsx` follow from the light ground and are not
cosmetic:

- `colorScheme` and `themeColor` flip to light / milk. `:root { color-scheme }`
  in `globals.css` flips with them.
- **`appleWebApp.statusBarStyle` moves from `"black-translucent"` to
  `"default"`.** Translucent forces *white* status-bar text, which is invisible
  on a pastel camera body. The cost is that installed-app content no longer
  runs under the status bar. Readability wins; this is a visible change to how
  the installed app frames itself.

---

## 6. Surface inventory

**41 files** reference the colour tokens and every one is restyled. Behaviour,
props and accessible names are preserved. The list below is the output of
grepping for token usage, not a guess:

**Foundation** — `app/globals.css`, `app/layout.tsx`, `components/ui/{button,
sheet,slider}.tsx`

**Shell** — `shell/{app-frame,tab-bar,offline-banner,wordmark}.tsx`,
`providers/toast-provider.tsx`, `pwa/service-worker-bridge.tsx` (the update
toast)

**Camera** — `camera/{camera-screen,digicam-shell,profile-dial,shutter-button,
filtered-preview,filter-tray,focus-reticle,grid-overlay,permission-gate,
camera-route}.tsx`, `lib/camera/bodies.ts`

**Booth** — `booth/{booth-picker,booth-runner,strip-editor,template-thumb,
clip-dialog,booth-route}.tsx`

**Rolls** — `roll/{library-screen,roll-detail,roll-card,contact-sheet,
strip-grid,capture-viewer,new-roll-sheet,share-sheet,join-screen,
library-route}.tsx`

**Home / settings / edges** — `home/home-screen.tsx`,
`settings/{settings-screen,account-panel,camera-report}.tsx`,
`app/{error,not-found}.tsx`, `app/offline/page.tsx`,
`components/dev/render-check.tsx`

Route files under `app/` other than those three are thin wrappers that carry no
tokens and need no change.

`camera-screen.tsx` is 607 lines and the largest file in the app. It is
restyled in place. The readout and control cluster get split out **only if**
the styling pass makes that obviously cleaner — no speculative refactoring of
capture logic under cover of a visual change.

### Button variants

`primary` becomes a `sky-base` fill with `cocoa-900` text (a pastel fill
demands dark text) and a pillow shadow. `paper` becomes `soft` (milk fill).
`subtle` moves to `cream-200`. `outline` uses `edge-strong`. `danger` uses
`blush-deep`. All sizes move to pill or large radii and **every size keeps its
44px touch floor** — these get tapped one-handed.

---

## 7. Preserved contracts

The end-to-end suite selects on accessible names. These are preserved verbatim:

`"Take a photo"`, `"Start a Roll"`, `"Start shooting"`, `"Start the booth"`,
`"Choose a booth"`, `"Watch the clip of this shoot"`, `"Add to favourites"`,
`"Remove from favourites"`, `"Keep it"`, `"Close"`, `"Rolls"`, `"Your strip"`,
`"Camera"`, `"Open your camera photos"`, `"Instant Pair"`, `/^Frame 1/`, the
`navigation`/`tab` roles, and the `clip-action` / `clip-video` test ids.

Also preserved: the `data-hydrated` marker in `app-frame.tsx` that the e2e
`open()` helper waits on, the `sr-only` companions that state camera-back
counts plainly, and `aria-hidden` on body furniture.

---

## 8. Documentation

The redesign contradicts rules that CLAUDE.md records as deliberate. Those
rules are rewritten to describe the new system rather than left contradicting
the code:

- **Typography** — rewritten for the three new faces; the caps-only rule is
  removed; the user-text rule is kept with its new justification; the
  `--font-*-face` indirection warning is kept verbatim.
- **Vintage print utilities** — the paragraph naming `rule-double`,
  `perforated-y`, `halftone`, `stamp` and `film-edge` is replaced by the new
  soft kit.
- **The product paragraph** — "dressed as film packaging" no longer describes
  the app.
- `globals.css` design-intent comment block, and the README prose describing
  the camera body and home screen.

Every non-negotiable in CLAUDE.md that is not about appearance — the shutter
rule, IndexedDB as source of truth, no roll from a photograph, no account
required, no fake features, no third-party requests — stays untouched and
still governs.

---

## 9. Testing

`pnpm check` (lint, typecheck, unit, build) plus `pnpm test:e2e` against the
production build with Chromium's synthetic camera.

Specific gates:

- **"never sends a request to a third party"** (`tests/e2e/pwa.spec.ts`) is the
  proof that the new faces are genuinely self-hosted. `next/font/google` fetches
  at *build* time and serves from origin, so this passes — but it is the check
  that matters most in this change and it gets run explicitly.
- **React Compiler ESLint rules** are correctness requirements here as
  everywhere. A restyle should not introduce effects or refs, but any component
  that gets restructured must still obey them.
- **Unit tests target pure logic** and should not move. If any test asserts on
  a class name, the test is corrected to assert behaviour — not loosened to
  pass.
- `/dev/render-check` still renders. The filter maths is untouched, so its
  output should be pixel-identical; that makes it a useful canary for having
  accidentally reached into the grading pipeline.

### The compiler will not find stragglers

Tailwind v4 does not error on a utility whose theme token no longer exists — it
simply generates nothing. A file still saying `bg-ink-800` after the ramp is
removed will **lint clean, typecheck clean and build clean**, then render
unstyled.

So "no old tokens remain" is a grep, not a build result. The completion check
is:

```bash
grep -rnE "\b(ink-[0-9]|safelight|amber-warm|signal-|text-paper|bg-paper)" src \
  --include=*.tsx --include=*.ts
```

Expected output: nothing. Note that a bare `paper` also matches `PaperId` and
prose in `lib/booth/*` and `lib/camera/motion-speed.ts`, which are unrelated to
the token layer — hence the anchored pattern above.

---

## Risks

| Risk | Mitigation |
|---|---|
| A missed file renders unstyled and every gate still passes | Tailwind v4 drops unknown utilities silently — completion is verified by grep, not by `pnpm check` (§9) |
| Pastel-on-pastel drifts below contrast as components are built | `scripts/check-contrast.mjs` ships with the work |
| A restyle silently changes capture behaviour | Non-goals list is explicit; `/dev/render-check` is the canary |
| The camera body loses legibility in the dark | Per-body `ink` stays a real decision; 44px touch floors kept |
| Scope creep into "while I'm here" refactors | `camera-screen.tsx` split is conditional, everything else is styling only |
