@AGENTS.md

# Pitik — engineering and product rules

Read `README.md` first for what the app is and how it is laid out. This file is
the set of decisions that are easy to undo by accident.

## The product in one paragraph

Pitik is a camera people open *during* a moment, not after it. Every design
choice serves that: the shutter is never more than one tap away, nothing blocks
a capture, and the app is useful with no account and no network. If a change
makes the first photo slower or more conditional, it is the wrong change.

## Non-negotiable

**The shutter must never silently do nothing.** Any path where a press can be
dropped is a bug, not an edge case. Two have already been fixed: capturing
before the roll record loaded, and capturing before the video decoded its first
frame (`videoWidth` is non-zero at `HAVE_METADATA`, which is *before* there are
pixels — see `isFrameReady`). Both are covered by tests. If a press cannot be
served immediately, wait for it to become servable; if it truly fails, say so.

**IndexedDB is the source of truth.** A photo exists the moment the shutter
fires, with no account and no network. The server mirrors and delivers other
people's contributions; it never originates, and **nothing it says may delete or
overwrite a local photo**. The three merge invariants in `lib/sync/merge.ts` are
what enforce that — they are pure functions with tests, and they are not to be
relaxed to make a sync case simpler.

**A photograph never creates a roll.** Camera Mode files into the camera
library and the booth into the booth library; a roll is something the user
deliberately starts. Libraries are real roll records with `kind: "library"`,
hidden from `listRolls()` — never sentinel ids, which would break foreign keys
and sync. If you add a third kind of shooting, give it a library rather than
inventing a session on the user's behalf.

**No feature may require an account.** Auth gates exactly three things:
accounts, backup, shared rolls. Everything else works signed out, and
`isSupabaseConfigured() === false` is a fully supported mode, not a broken
install.

**No fake features.** Every switch in Settings is wired. Every capability shown
in the camera has been checked against the actual device. A control that cannot
work is not rendered — that is why `CameraCapabilities` exists.

**No third-party requests.** No analytics, no trackers, no remote fonts at
runtime, no AI services. There is an end-to-end test asserting this; if you add
a dependency that phones home, that test will fail and it is right.

## Typography

The app is dressed as film packaging, not as a product page. Three faces, all
self-hosted through `next/font`, all declared once in `layout.tsx`:

- `font-display` (Bebas Neue) is **caps-only**. It is for our words —
  headings, labels, the wordmark. Never put a user's text in it: a roll named
  "Dinner with Sam" would be shouted back at them as DINNER WITH SAM.
- `font-sans` (Archivo) carries body copy **and everything the user typed**.
  Roll titles, captions, names.
- `font-mono` (Courier Prime) is the typewritten furniture — spec lines, dates,
  frame numbers, counters. Tracked out wide and uppercase.

next/font hashes its family names, so it publishes them as `--font-*-face` and
the Tailwind theme keys point at those. Keep the two names distinct — a
self-referential custom property silently resolves to nothing. Canvas cannot
read a CSS variable at all, so `compositor.ts` resolves the stack off the
document and falls back to generics in workers and tests.

Vintage print utilities (`rule-double`, `perforated-y`, `halftone`, `stamp`,
`film-edge`) live in `globals.css`. Reach for those before inventing a new
rounded card.

## Filters

- Filters are **data**. Add presets to `src/lib/filters/presets.ts`; never put
  grading maths in a component.
- Preview (`css.ts`) and export (`canvas.ts`) consume the same `Adjustments`
  object and must obey the same order of operations. Where CSS cannot express an
  effect, the preview **understates** it — the saved photo may exceed the
  preview, never disappoint it.
- Any change to the maths: run `/dev/render-check` and look at it. The unit
  tests catch monotonicity, range, and preset distinctiveness; they cannot tell
  you a grade has become ugly.
- Names describe a feeling or a process, never a brand. Nothing is named after
  another company's product or film stock.
- Skin tone is the judgement criterion. A grade that wrecks midtones is rejected
  regardless of how good the landscape test looks.

## Camera Mode

- The screen is a camera body, edge to edge. Controls live inside the moulding
  as slots; nothing floats underneath it.
- **The model dial is the only look control.** Do not reintroduce a filter tray
  here — two controls for one property will disagree, and a camera is not a
  filter stacked on another filter.
- **No aspect-ratio control.** The camera shoots the sensor's framing and the
  viewfinder is shaped from `frameAspect`, so preview and photograph match. A
  preview cropped differently from the capture is a lie.
- A model may produce a *print* rather than a bare frame (`CameraBody.print`).
  Polaroid is a white border with a chin; a grade alone does not make one. The
  print keeps the sensor framing — cropping it would make one camera quietly
  throw pixels away and break the preview/capture match.
- The camera opens on arrival (`autoStart`). A browser that cannot open one must
  land on the error state, never on a spinner that never resolves.
- Flash is one control that does whichever flash exists: the torch where the
  track reports one, the screen otherwise. Never render both.
- A screen flash must give the sensor time to meter (`SCREEN_FLASH_SETTLE_MS`).
  Firing immediately yields the dark exposure with the light arriving too late.
- 0.5x is a separate camera module, not `zoom: 0.5`. Detect it by device label
  (`findUltraWide`) and hide the control when there is none — most phones and
  every laptop.
- Body furniture is scenery: `aria-hidden`, no button semantics. Anything on the
  readout must be a real value.
- Zero-padded camera-back numerals read as gibberish to a screen reader. State
  the count plainly in an `sr-only` companion.

## Booth

- Templates are geometry. Positions are **computed** by the grid builder, not
  typed out, so padding changes cannot drift a layout apart.
- The compositor must stay template-agnostic. If it needs to know a template's
  id to render it correctly, the template model is missing a field.
- Every new template must pass the layout tests (inside canvas, no overlap, slot
  count matches shots, caption below the photos).

## React

ESLint's React Compiler rules are **correctness requirements**, not style. In
practice this means:

- No `setState` synchronously in an effect body. Put the work in an async
  callback or a timer callback — see `useQuery` and the self-timer.
- No reading or writing `ref.current` during render.
- No impure calls during render. `Date.now()` goes through `useMinute()`;
  browser capability checks go through `useCapability()`. Both are
  `useSyncExternalStore` so the value is stable within a render and hydration
  cannot mismatch.
- Destructure hook results before using them in dependency arrays; optional
  chaining in a dep list defeats memoisation.

## Booth clips

- Recording is **never** allowed to affect the shoot. Every function in
  `lib/camera/motion.ts` fails by returning null, never by throwing into the
  capture path. A browser that cannot record still runs the sequence and still
  composes the strip.
- If the device cannot record, **no clip control is rendered**. Same rule as
  every other capability.
- A recorder must not outlive its session: cancelled on unmount, on retake, and
  when leaving mid-sequence.
- Clips carry sound, but the microphone is requested **only** when a booth
  session starts. Never widen the camera's own `getUserMedia` to include audio:
  taking a photograph must not cost a mic prompt.
- The recorder owns the microphone tracks it opened and must stop them; the
  camera's video tracks belong to `useCamera` and must be left alone.
- MP4 is preferred over WebM on purpose — a clip that will not open on the
  recipient's phone is a broken feature. Don't reorder for file size.
- Clips are ungraded. Grading motion means rendering every frame through the
  canvas pipeline and recording that — a real feature, not a tweak.
- The 1.5x speed-up is **baked into the file**, never left to the player. A clip
  is shared far more often than it is watched in-app, and a player setting does
  not travel with the file. `MotionAttachment.speed` records what the frames
  already carry; the player multiplies up only what is missing, so a clip whose
  re-encode failed still *looks* right in-app.
- The re-encode is real-time work. Run it while the user is occupied, never as
  a wait after they tap save, and always fall back to the original.
- Anything stored must stay reachable. A clip the user can save but never get
  back out is worse than no clip.

## Performance

The capture pipeline runs on the main thread, so pixel count is the budget.

- The sensor is asked for **1920x1080, never 4K**. Raising it multiplies the
  cost of every preview frame *and* every capture; 4K measured at ~3s per photo
  against ~0.9s at 1080p. Measure before changing it.
- `DEFAULT_MAX_DIMENSION` must not exceed what the stream delivers — upscaling
  past the sensor costs the whole pipeline proportionally and adds no detail.
- Booth frames are graded at a lower ceiling again: they land in slots a few
  hundred pixels wide, and the cost shows up as a freeze between shots.
- The live preview must not run JavaScript per frame. Blended overlay layers are
  GPU work on every paint, so keep them few — grain is deliberately export-only.

## Memory

A camera app leaks megabytes per mistake.

- `createObjectURL` is called **only** by `useObjectUrl` / `useObjectUrls`.
- Every `ImageBitmap` is `close()`d, including on unmount and on retake.
- The camera stream is released on unmount and when the page is hidden.
- Full-resolution work happens once per photo, never per frame.

## Testing

- `pnpm check` must pass before anything is considered done.
- Unit tests target pure logic — colour maths, geometry, the repository,
  formatting. They run against a real IndexedDB (`fake-indexeddb`), not a mock.
- E2E runs against a **production build** with Chromium's synthetic camera, so
  the real capture path executes. Do not mock the camera to make a test pass.
- Tests must be deterministic. Two records created in the same millisecond tie;
  pass explicit timestamps rather than relying on ordering.
- Playwright can click a server-rendered button before hydration. Navigate with
  the `open()` helper, which waits for React to take over.

## Writing

Interface copy is plain, warm, and specific. Errors state what happened in one
sentence and offer the single thing the user can try. Empty states carry the
product's promise rather than apologising. Never use a technical term where a
human one exists — "That frame didn't save", not "Capture pipeline error".

## Quality gates

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
# or
pnpm check
```
