# Pitik

**Made for moments together.**

A nostalgic digital camera and photobooth that runs in the browser. Pitik is
built to be opened *during* something — a dinner, a trip, an ordinary Tuesday —
rather than afterwards. You name the moment, shoot a roll into it, and the
photos stay on your device unless you decide otherwise.

It is a Progressive Web App: installable, offline-capable, and local-first.
Nothing is uploaded, tracked, or sent to an AI service.

---

## Contents

- [Quick start](#quick-start)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [The filter engine](#the-filter-engine)
- [The photobooth](#the-photobooth)
- [Local-first storage](#local-first-storage)
- [PWA and offline](#pwa-and-offline)
- [Supabase (optional)](#supabase-optional)
- [Testing](#testing)
- [Quality gates](#quality-gates)
- [Browser support](#browser-support)

---

## Quick start

Requires **Node 20+** and **pnpm**.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

That is the whole setup. There is no backend to run and no environment file to
create — Pitik works completely without one. See
[Supabase (optional)](#supabase-optional) if you want accounts and backup.

> **Cameras need a secure context.** `localhost` counts, so `pnpm dev` is fine.
> To test on a phone over your LAN you will need HTTPS — the browser refuses
> `getUserMedia` over plain `http://192.168.x.x`.

### Commands

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint over `src`, `scripts`, `tests` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright, real capture) |
| `pnpm icons` | Regenerate app icons from `scripts/generate-icons.mjs` |
| `pnpm check` | lint + typecheck + test + build |

---

## What it does

### Camera Mode — `/camera`

The whole screen is one instrument: a compact camera body, edge to edge, with
the shutter moulded into it rather than sitting underneath as a web button. Each
model on the dial is a different camera — its own grade, body colour, accent
lamp and lens ring.

Three decisions shape it:

- **The dial is the only look control.** A camera is not a filter you layer on
  another filter, so there is no separate tray to disagree with it.
- **No aspect ratios.** The camera shoots the sensor's own framing and the
  viewfinder is shaped to match, so what is on screen is the photograph.
- **No confirmation screen, and no button to press first.** The camera opens on
  arrival; the shutter fires, the frame is snapshotted immediately, and grading
  plus encoding happen off the critical path.

**Polaroid is a print, not a grade.** Selecting it mounts the photograph in a
white instant frame with a deep chin. The frame keeps the sensor's own framing
rather than cropping square, so it is the only thing that changes.

**Flash means whatever the camera can actually do.** One control: the rear lamp
where the hardware exposes one, and on the front camera a screen flash — the
display goes warm white for a moment before the shutter so the sensor has time
to meter for it. Off by default.

**0.5x appears only on phones that have an ultra-wide.** It is a separate camera
module rather than a zoom level, so the control reopens the stream on that lens
and is hidden entirely where none exists.

Also here: rear/front switching, a self-timer, a composition grid, a horizon
level, tap-to-focus, zoom where the hardware exposes it, gallery import, and an
optional vintage date stamp.

### Resolution, deliberately

The sensor is asked for **1920x1080, not 4K**. A 3840x2160 track is 8.3
megapixels arriving sixty times a second, and every one of them has to be scaled
for the preview and pushed through the grading pipeline on capture — which
measured at roughly three seconds per photograph. Dropping to 1920 cuts that to
under a second.

It is also the honest resolution for this product: the compacts these filters
imitate shot between two and five megapixels.

### Camera profiles

A second, orthogonal stack to filters — the *body* rather than the *grade*:
Everyday, Digicam, Disposable, Flashback, Soft, and Night Out. Two of them burn
a date stamp into the corner. They compose with any filter.

### Photobooth Mode — `/booth`

Ten data-driven layouts across Classic, Minimal, Cute, Y2K, Film, Friends,
Party, and Date Night. Pick one, choose an interval, press start, and the booth
takes over: it counts you in and fires on its own schedule until the strip is
full. Then you finish it — paper, caption, typeface, date, corners, keyline —
and export a PNG with no watermark. Sixteen papers, five of them gradients.

The whole shoot is also **recorded as a short clip, with sound** — countdowns,
flinches and all — so a session produces both a printable strip and something
shareable with motion in it, the way a Live Photo pairs the two. Clips play
in-app and can be shared or saved from there.

Three things worth knowing:

- **Recording never affects the shoot.** If the browser cannot record, the
  sequence runs anyway and no clip control is shown at all.
- **The microphone is requested only when a booth session starts**, never when
  the camera opens — taking a photograph should not cost you a mic prompt. If
  the prompt is declined, the clip is simply silent.
- **MP4 is preferred over WebM**, deliberately. A clip exists to be sent to the
  people in it, and WebM does not play on iOS; H.264 plays essentially
  everywhere. Chromium has recorded MP4 since 2023, so both platforms now
  converge on one container, with WebM as the fallback for older Chromium.

Clips come out at **1.5x**, the way a mall photobooth hands you a recap that is
already fast — the dead air during a countdown is not interesting, and the
speed-up makes the whole thing read as a highlight rather than as footage.

The speed is **baked into the file**, not applied by the player, so a clip you
share or download is fast for whoever receives it. `MediaRecorder` stamps frames
with wall-clock time, so this is a genuine re-encode: the clip is played back at
speed into a canvas and re-recorded, with audio riding through a WebAudio graph
so voices speed up without rising in pitch. It runs in the background while you
are choosing paper and captions, which is time you were spending anyway. If it
cannot run, the original is kept and the player makes up the difference — so
what you watch matches what you would share either way.

Clips are ungraded (`MediaRecorder` sees the raw stream, not the preview's CSS
filter). Bitrate is scaled to the planned length of the sequence so that even a
nine-shot Contact Sheet fits the 24 MB storage ceiling, and if a clip still
cannot be kept the app says so rather than dropping it silently. Clips are
**not synced** — see [Supabase](#supabase-optional).

### Your photos — `/rolls`

Three shelves. **Camera** holds everything shot in Camera Mode, **Booth** holds
every strip with its clip, and **Rolls** holds the moments you deliberately
started.

Taking a photograph never creates a roll. Most shooting is not a named session,
and filing it under an invented "Thursday night" was a lie about what the user
did — so the two libraries exist and a roll stays something you choose to begin.
Start one from the home screen and the camera files into it until you tap the ×
beside its name; after that, photos go back to the camera shelf.

Libraries are ordinary roll records marked `kind: "library"` and hidden from the
list, rather than sentinel ids — which keeps every query, foreign key and sync
path working unchanged.

Rolls render as contact sheets with frame numbers, and can be renamed, favourited
from, shared by code or QR, and deleted.

### Shared rolls

Share a roll by code or QR. Anyone who joins can add their own photos, and both
devices pull each other's frames in — contributed frames are marked so you can
tell what arrived from someone else. Requires an account on both sides; see
[Supabase](#supabase-optional).

### Disposable rolls

A roll can be created with a fixed shot limit and a develop time. Until it
develops, the frames are hidden — you shoot without chimping and see the whole
evening at once. You can develop early; the app gently suggests you don't.

### Guest by default

No account is required, and none is offered until you ask for something that
genuinely needs a server. There is no sign-in wall in front of the shutter.

---

## Architecture

```
src/
  app/                 Routes (App Router). Thin — every page is a shell.
  components/
    camera/            Viewfinder, shutter, filter tray, profile dial
    booth/             Template picker, sequence runner, strip editor
    roll/              Cards, contact sheet, viewer, share sheet
    settings/          Settings and the account panel
    shell/             App frame, tab bar, wordmark
    providers/         Session and toast context
    ui/                Button, sheet, slider
  hooks/               Camera, store queries, object URLs, sizing, time
  lib/
    camera/            MediaDevices wrapper, capture pipeline, error mapping
    filters/           Filter engine (see below)
    booth/             Templates and the canvas compositor
    db/                IndexedDB schema and repository
    supabase/          Optional client and hand-maintained types
    sync/              Outbox-driven upload engine
```

Three rules hold the structure together:

1. **The device is the source of truth.** IndexedDB owns every photo. Supabase
   mirrors; it never originates.
2. **Rendering logic lives in `lib/`, never in components.** No component
   contains grading maths or layout geometry.
3. **Capability is checked, never assumed.** Torch, zoom, manual focus and
   exposure are wildly inconsistent across devices, so a control that cannot
   work is not shown.

---

## The filter engine

`src/lib/filters/`

Filters are **data**, not code. A preset is a plain object; the registry is the
only thing components talk to. Adding a look never means touching a component.

```ts
{
  id: "disposable",
  name: "Disposable",
  category: "Film",
  description: "Twenty-seven exposures, no take-backs.",
  adjustments: {
    temperature: 0.24, contrast: 1.1, shadows: 0.22,
    grain: 0.45, vignette: 0.35, fade: 0.14,
    splitShadow: { color: "#3a2c22", amount: 0.3 },
  },
}
```

**37 presets** ship across Natural, Film, Digicam, B&W, Warm, Cool, Dreamy,
Experimental, Photobooth, and Night. Every one is checked by a test that it is
visibly distinct from Natural.

### Two renderers, one description

| | Live preview (`css.ts`) | Export (`canvas.ts`) |
|---|---|---|
| Runs | every frame, on the GPU | once per photo |
| Cost | one CSS `filter` plus blended overlay divs | per-pixel, full resolution |
| Spatial effects | approximated | real |

The canonical pipeline order is obeyed by both:

```
exposure -> brightness -> contrast -> highlights/shadows -> fade
         -> temperature/tint -> split toning -> saturation
         -> sharpen -> bloom -> vignette -> grain
```

The first six steps are baked into three 256-entry lookup tables before the
pixel loop starts, which is what keeps a 12-megapixel export fast. Grain is
seeded, so re-exporting a capture is byte-stable.

Where CSS cannot express something (bloom, unsharp masking), the preview
deliberately *understates* it — so the saved photo is never less flattering than
what you were looking at.

**Available parameters:** exposure, brightness, contrast, highlights, shadows,
saturation, temperature, tint, fade, vignette, grain, sharpness, bloom, plus
shadow and highlight split-tone casts. Not all are surfaced in the MVP
interface; the engine supports all of them today.

### Looking at the output

In development, visit **`/dev/render-check`**. It runs every filter through both
renderers side by side, and every booth template through the compositor, against
a generated reference image containing a tonal ramp, skin tones, saturated
primaries, and a neutral step wedge. It is the fastest way to spot a regression
in the colour maths. The route 404s in production.

---

## The photobooth

`src/lib/booth/`

A template is geometry plus styling hints — no drawing code:

```ts
{
  id: "classic-4", name: "Classic 4", category: "Classic",
  width: 800, height: 2412, shots: 4,
  slots: [ { x, y, width, height, radius } ],
  caption: { x, y, align, size, font, placeholder, maxLength },
  defaultPaper: "cream",
}
```

Slot positions are *computed* by a grid builder from intent ("four 4:3 frames
stacked, with room for a caption") rather than typed out, so a padding change
cannot drift the layout apart. The compositor renders any template without
knowing what any of them are — which is what makes a custom-booth designer a
data problem rather than a rewrite.

Tests assert, for every template, that slots stay inside the canvas, never
overlap, match the declared shot count, and that captions print below the photos
and on the paper.

---

## Local-first storage

`src/lib/db/`

IndexedDB (via `idb`), four stores plus settings:

| Store | Holds |
|---|---|
| `rolls` | Sessions, with mode, shot limit, reveal time, share code |
| `captures` | Full-resolution JPEG and thumbnail, per frame |
| `strips` | Composed booth prints, plus the optional clip of the shoot |
| `outbox` | Pending sync work, with exponential backoff |

Everything is soft-deleted so a deletion made offline can still propagate later;
`purgeDeleted()` reclaims the space once it has. `repo.ts` is the only module
that touches IndexedDB, and mutations announce themselves through a small change
feed that the React hooks subscribe to.

Memory discipline matters more than usual here. Object URLs are created and
revoked exclusively by `useObjectUrl`, and every `ImageBitmap` is explicitly
closed — a camera app leaks megabytes per mistake, not kilobytes.

---

## PWA and offline

- **Manifest** generated by `src/app/manifest.ts`, with `any` and `maskable`
  icons plus shortcuts straight to the camera and the booth.
- **Icons** are generated, not committed as opaque binaries:
  `scripts/generate-icons.mjs` draws the mark and encodes PNG using only Node's
  `zlib`. Change the constants, run `pnpm icons`, and every size agrees.
- **Service worker** (`public/sw.js`) is hand-written and small: network-first
  for navigations with an `/offline` fallback, cache-first for hashed static
  assets, stale-while-revalidate for the rest. It never caches anything
  user-generated and never touches a cross-origin request.
- **Updates never apply silently.** A new build waits behind a visible prompt,
  because the app can be mid-capture when one lands.

Everything except sync works with the radio off. This is covered by tests, not
just claimed.

---

## Supabase (optional)

Without configuration, Pitik is a complete local-only camera. Supabase adds
exactly three things: accounts, backup, and shared rolls.

```bash
cp .env.example .env.local     # then fill in URL and anon key
supabase db push               # applies supabase/migrations/0001_init.sql
```

The migration creates `profiles`, `rolls`, `roll_members`, `captures` and
`strips`, plus a private `captures` storage bucket.

**Row Level Security is on for every table, with no exceptions.** Policies are
written against a single `is_roll_member()` helper so there is one place to audit
"who can see this roll". Storage objects are keyed
`<user_id>/<roll_id>/<capture_id>.jpg`: writes are checked against the first path
segment (so a forged path is impossible) and reads against the second (so
co-members can see each other's photos and nothing else). Joining a roll goes
through `join_roll_by_code()`, which grants `contributor` and nothing more.

Sync is **opt-in and additive**. It is off even after you sign in. Uploads move
through the outbox, so an upload interrupted by a dead tunnel resumes on its own;
pulls bring in what other people added to rolls you share.

The merge policy (`src/lib/sync/merge.ts`) is three invariants, tested as pure
functions:

1. **A local deletion is never undone by a pull.** A tombstone on this device
   outranks any remote record, however new. Resurrecting a photo somebody
   deliberately deleted is the worst thing sync can do.
2. **Local photo bytes are never overwritten.** Captures are immutable; if a
   frame is already here there is nothing to fetch.
3. **Unpushed work is never clobbered.** A roll renamed offline keeps its new
   name until it has been uploaded.

Only roll *metadata* is ever refreshed from the server, and only when the local
copy is confirmed synced. A background loop runs a round every five minutes
while sync is on, the user is signed in, and the browser is online.

**Booth clips are excluded from sync.** The `strips` table has no column for
one, a clip is an order of magnitude larger than the strip it accompanies and
would dominate a free storage tier within a few sessions, and unlike a
photograph it is a by-product rather than the thing the user asked to keep. The
consequence is worth knowing: a clip lives only on the device that recorded it,
and pulling a shared roll brings the strip without the motion behind it.

---

## Testing

```bash
pnpm test        # 207 unit tests
pnpm test:e2e    # 24 end-to-end tests, mobile and desktop
```

**Unit** (Vitest) covers the parts where correctness is invisible to the eye:
the tone curve and LUT construction, the colour pipeline, split-tone weighting,
grain determinism, crop geometry, CSS/canvas agreement, every booth template's
layout, the repository against a real IndexedDB implementation, the sync merge
invariants, and the formatting that carries the product's voice.

**End-to-end** (Playwright) runs against a **production build** with Chromium's
synthetic camera (`--use-fake-device-for-media-stream`), so the entire capture
path — permission, preview, shutter, grading, IndexedDB write — executes for real
on a machine with no webcam. It covers naming a roll and shooting into it, rapid
shooting, the favourite and contact-sheet flow, capturing while offline, a
complete booth sequence through to a saved strip, manifest installability,
service worker registration and offline reload, and an assertion that the app
makes **no third-party requests at all**.

---

## Quality gates

```bash
pnpm check
```

Runs lint, typecheck, unit tests and a production build. All four must pass.
TypeScript is `strict`; ESLint includes the React Compiler rules, which are
treated as correctness requirements rather than suggestions.

---

## Browser support

| | Camera | Booth | Offline | Install |
|---|---|---|---|---|
| Chrome / Edge (Android, desktop) | full | yes | yes | yes |
| Safari (iOS 16.4+, macOS) | full | yes | yes | yes |
| Firefox | capture works; torch, zoom and manual focus unavailable | yes | yes | no |

Optional camera controls are detected at runtime and hidden when the device
cannot honour them. A camera failure is always reported as a plain sentence with
the one thing you can actually try.
