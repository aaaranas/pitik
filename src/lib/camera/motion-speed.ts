import {
  isWithinMotionBudget,
  type MotionClip,
  motionBitrateFor,
  motionCandidates,
  pickMotionMimeType,
} from "./motion";

/**
 * Re-encoding a booth clip at a faster speed.
 *
 * A mall photobooth hands you a recap that is already sped up — the file
 * itself, not a player setting. Matching that means genuinely re-encoding,
 * because `MediaRecorder` stamps frames with wall-clock time and there is no
 * way to make a real-time recording come out faster after the fact.
 *
 * The method: play the clip back at speed into a canvas, capture that canvas as
 * a stream, and record it. Audio rides along through a WebAudio graph with
 * `preservesPitch` on, so voices speed up without turning into chipmunks.
 *
 * This costs roughly `duration / rate` seconds of real time, which is why the
 * caller starts it while the user is busy choosing paper and captions rather
 * than making them wait after tapping save.
 *
 * Like everything else in the recording path, it fails by returning null. The
 * original clip is always kept if this cannot run.
 */

/** How much faster the exported clip plays than it was shot. */
export const CLIP_SPEED = 1.5;

/** Frame rate to capture the re-encode at. */
const CAPTURE_FPS = 30;

/**
 * How long to allow before giving up, in ms.
 *
 * The work is inherently real-time — it plays the clip through — so the budget
 * is the playback duration plus a fixed allowance for decode and encode.
 */
export function speedUpTimeoutMs(durationMs: number, rate = CLIP_SPEED): number {
  return Math.round(durationMs / rate) + 10_000;
}

function once(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve) => target.addEventListener(event, () => resolve(), { once: true }));
}

/**
 * Returns a copy of `clip` that plays `rate` times faster.
 *
 * Resolves to null if the browser cannot do it, if the result is unusable, or
 * if it exceeds the storage budget — in every case the caller keeps the
 * original rather than ending up with nothing.
 */
export async function speedUpClip(
  clip: MotionClip,
  rate = CLIP_SPEED,
): Promise<MotionClip | null> {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return null;
  if (rate <= 1) return null;

  const url = URL.createObjectURL(clip.blob);
  const video = document.createElement("video");
  let audioContext: AudioContext | null = null;
  let captured: MediaStream | null = null;

  const cleanup = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    for (const track of captured?.getTracks() ?? []) track.stop();
    void audioContext?.close().catch(() => undefined);
  };

  try {
    video.src = url;
    video.playsInline = true;
    // Without this, speeding the clip up raises every voice a fifth.
    video.preservesPitch = true;
    video.playbackRate = rate;

    await Promise.race([once(video, "loadedmetadata"), once(video, "error")]);
    if (!video.videoWidth || !video.videoHeight) {
      cleanup();
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return null;
    }

    captured = canvas.captureStream(CAPTURE_FPS);

    // Route audio through a graph rather than the speakers: the element is
    // playing at 1.5x purely to be re-recorded, and nobody wants to hear it.
    let hasAudio = false;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        audioContext = new Ctor();
        await audioContext.resume().catch(() => undefined);
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        for (const track of destination.stream.getAudioTracks()) {
          captured.addTrack(track);
          hasAudio = true;
        }
      }
    } catch {
      // A clip with no audio track, or an engine that refuses the graph. The
      // re-encode carries on silently rather than failing.
    }

    const mimeType = pickMotionMimeType(
      (type) => MediaRecorder.isTypeSupported(type),
      motionCandidates(hasAudio),
    );
    if (!mimeType) {
      cleanup();
      return null;
    }

    const targetDurationMs = Math.round(clip.durationMs / rate);
    const recorder = new MediaRecorder(captured, {
      mimeType,
      videoBitsPerSecond: motionBitrateFor(targetDurationMs),
    });

    const chunks: Blob[] = [];
    let failed = false;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      failed = true;
    };

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(500);
    await video.play();

    // Pump frames into the canvas for the whole playback. `captureStream` only
    // emits when something is drawn, so this loop *is* the video track.
    let frameHandle = 0;
    const supportsFrameCallback = "requestVideoFrameCallback" in video;
    const draw = () => {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frameHandle = supportsFrameCallback
        ? (video as HTMLVideoElement & {
            requestVideoFrameCallback: (cb: () => void) => number;
          }).requestVideoFrameCallback(draw)
        : requestAnimationFrame(draw);
    };
    draw();

    // Whichever comes first: the clip runs out, or the budget does.
    await Promise.race([
      once(video, "ended"),
      new Promise<void>((resolve) =>
        setTimeout(resolve, speedUpTimeoutMs(clip.durationMs, rate)),
      ),
    ]);

    if (!supportsFrameCallback) cancelAnimationFrame(frameHandle);
    if (recorder.state !== "inactive") recorder.stop();
    await finished;

    cleanup();

    if (failed || chunks.length === 0) return null;
    const blob = new Blob(chunks, { type: mimeType });
    if (!isWithinMotionBudget(blob.size)) return null;

    return { blob, mimeType, durationMs: targetDurationMs, speed: rate };
  } catch {
    cleanup();
    return null;
  }
}
