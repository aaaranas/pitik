/**
 * Recording the booth sequence as a short clip.
 *
 * A booth session produces two things: the printable strip, and a clip of the
 * whole shoot — countdowns, flinches, and all. The strip is what you keep; the
 * clip is what is actually funny, in the way a Live Photo is usually better
 * than the still it was taken from.
 *
 * Non-negotiable: **recording is never allowed to affect the shoot.** If the
 * browser has no usable container, if `MediaRecorder` throws, or if the result
 * is too large to store, the sequence still runs and the strip is still
 * composed. Every function here fails by returning null, never by throwing into
 * the capture path.
 *
 * The clip is **ungraded**. `MediaRecorder` records the raw `MediaStream`, and
 * the live preview's look comes from a CSS filter on the video element, which
 * the stream knows nothing about. Grading the motion would mean rendering every
 * frame through the canvas pipeline and recording *that* — a real feature, and
 * deliberately out of scope here.
 *
 * Sound is requested **only when a booth session starts**, never when the camera
 * is opened. Taking a photograph must not cost you a microphone prompt. If the
 * prompt is declined, or there is no microphone, the clip is simply silent —
 * that path is not an error.
 */

/**
 * Containers to try, best first. **MP4 leads deliberately.**
 *
 * The clip exists to be sent to the people who were in it, and a WebM file
 * recorded on Android does not play on an iPhone. A smaller file that the
 * recipient cannot open is not the better trade — so H.264/MP4, which plays
 * essentially everywhere, wins over VP9's compression.
 *
 * Chromium has recorded MP4 since 2023, so in practice both platforms now
 * converge on the same container and WebM is the fallback for older Chromium
 * rather than the normal path. That convergence is itself worth having: one
 * format means one set of playback bugs.
 */
export const MOTION_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

/**
 * The same preference, for a recording that carries an audio track.
 *
 * Named codec pairs come first: some engines accept `video/mp4` for a
 * video-only recording but reject it once an audio track is attached, so the
 * combination has to be probed explicitly rather than assumed.
 */
export const MOTION_MIME_CANDIDATES_WITH_AUDIO = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/** Candidate list for a recording with or without sound. */
export function motionCandidates(withAudio: boolean): readonly string[] {
  return withAudio ? MOTION_MIME_CANDIDATES_WITH_AUDIO : MOTION_MIME_CANDIDATES;
}

/**
 * Ceiling for a stored clip.
 *
 * The clip lives in IndexedDB next to full-resolution photographs, so this is
 * a real budget rather than a formality — but it has to comfortably fit the
 * longest sequence Pitik offers. Contact Sheet is nine shots, which at an eight
 * second interval runs well over a minute.
 */
export const MOTION_MAX_BYTES = 24 * 1024 * 1024;

/** Bitrate for a short sequence. Long ones are stepped down to fit the budget. */
export const MOTION_BITS_PER_SECOND = 2_500_000;

/**
 * Floor below which the clip stops being worth keeping.
 *
 * Better a slightly soft clip than no clip: the point is the moment, not the
 * resolution.
 */
export const MOTION_MIN_BITS_PER_SECOND = 700_000;

/**
 * Picks a bitrate that keeps a sequence of the given length inside the budget.
 *
 * Without this, a nine-shot booth at a slow interval sails past the ceiling and
 * the finished clip is thrown away — after the app has already promised the
 * shoot was being filmed. Scaling the bitrate to the *planned* duration means
 * the promise can actually be kept for every template Pitik offers.
 *
 * Uses 80% of the budget, because a container carries overhead beyond the
 * nominal video bitrate and the estimate should not sit on the line.
 */
export function motionBitrateFor(
  expectedDurationMs: number,
  maxBytes = MOTION_MAX_BYTES,
): number {
  const seconds = Math.max(1, expectedDurationMs / 1000);
  const affordableBitsPerSecond = (maxBytes * 8 * 0.8) / seconds;
  return Math.round(
    Math.min(MOTION_BITS_PER_SECOND, Math.max(MOTION_MIN_BITS_PER_SECOND, affordableBitsPerSecond)),
  );
}

/**
 * Picks the first container the browser will actually record.
 *
 * Takes the support probe as an argument so the choice can be tested against
 * synthetic browsers rather than whichever one happens to run the suite.
 */
export function pickMotionMimeType(
  isSupported: (type: string) => boolean,
  candidates: readonly string[] = MOTION_MIME_CANDIDATES,
): string | null {
  for (const candidate of candidates) {
    try {
      if (isSupported(candidate)) return candidate;
    } catch {
      // A probe that throws is a probe that said no.
    }
  }
  return null;
}

/**
 * Whether a finished recording is small enough to keep.
 *
 * A zero-byte blob counts as a failure, not as a tiny success — it means the
 * recorder produced nothing usable.
 */
export function isWithinMotionBudget(size: number, max = MOTION_MAX_BYTES): boolean {
  return size > 0 && size <= max;
}

/** True when this browser can record the booth at all. */
export function isMotionSupported(): boolean {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return false;
  }
  return pickMotionMimeType((type) => MediaRecorder.isTypeSupported(type)) !== null;
}

export interface MotionClip {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** Speed baked into the frames. Absent means real time. */
  speed?: number;
}

/**
 * Why a recording produced nothing.
 *
 * Returned rather than swallowed: a clip that disappears without explanation is
 * indistinguishable from a broken feature, and the user has just been told the
 * shoot was being filmed.
 */
export type MotionFailure =
  /** The recorder yielded no data at all. */
  | "empty"
  /** Finished, but too large to store. */
  | "too-large"
  /** The recorder reported an error mid-shoot. */
  | "failed";

export type MotionResult =
  | { ok: true; clip: MotionClip }
  | { ok: false; reason: MotionFailure };

export interface MotionRecording {
  /** Finishes and returns the clip, or the reason there isn't one. */
  stop: () => Promise<MotionResult>;
  /** Abandons the recording and releases the recorder. Never throws. */
  cancel: () => void;
}

/**
 * Starts recording a live stream.
 *
 * Returns null — rather than throwing — when recording is unavailable, so the
 * caller can carry on without a branch for "the camera works but the recorder
 * doesn't".
 */
/**
 * Asks for the microphone, if the caller wants sound.
 *
 * Resolves to an empty list on refusal rather than rejecting: a booth clip
 * without audio is a perfectly good outcome, and much better than a shoot that
 * refuses to start because somebody declined a prompt.
 */
async function requestAudioTracks(withAudio: boolean): Promise<MediaStreamTrack[]> {
  if (!withAudio || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return [];
  }
  try {
    const audio = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    return audio.getAudioTracks();
  } catch {
    return [];
  }
}

export interface StartMotionOptions {
  /**
   * Capture the microphone alongside the picture.
   *
   * On by default for the booth: the laughing between shots is most of what
   * makes booth footage worth keeping.
   */
  withAudio?: boolean;
  /**
   * Roughly how long the sequence will run, used to choose a bitrate that
   * keeps the result inside the storage budget.
   */
  expectedDurationMs?: number;
}

export async function startMotionRecording(
  stream: MediaStream | null,
  options: StartMotionOptions = {},
): Promise<MotionRecording | null> {
  if (!stream || typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return null;
  }

  // These tracks are ours — unlike the camera's video tracks, which `useCamera`
  // owns — so every exit path below has to stop them.
  const audioTracks = await requestAudioTracks(options.withAudio ?? true);
  const stopAudio = () => {
    for (const track of audioTracks) track.stop();
  };

  const mimeType = pickMotionMimeType(
    (type) => MediaRecorder.isTypeSupported(type),
    motionCandidates(audioTracks.length > 0),
  );
  if (!mimeType) {
    stopAudio();
    return null;
  }

  const recorded = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(recorded, {
      mimeType,
      videoBitsPerSecond: motionBitrateFor(
        options.expectedDurationMs ?? 20_000,
      ),
    });
  } catch {
    stopAudio();
    return null;
  }

  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let failed = false;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    failed = true;
  };

  try {
    // One chunk per second rather than one at the end: a recording interrupted
    // by a backgrounded tab still yields the part that was captured.
    recorder.start(1000);
  } catch {
    stopAudio();
    return null;
  }

  const release = () => {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
    // The camera's video tracks belong to `useCamera` and are left alone. The
    // microphone tracks were opened here, so releasing them is our job — miss
    // this and the recording indicator stays lit after the shoot ends.
    stopAudio();
  };

  return {
    stop: () =>
      new Promise<MotionResult>((resolve) => {
        if (recorder.state === "inactive") {
          release();
          resolve({ ok: false, reason: "empty" });
          return;
        }

        recorder.onstop = () => {
          const durationMs = Date.now() - startedAt;
          release();
          if (failed) {
            resolve({ ok: false, reason: "failed" });
            return;
          }
          if (chunks.length === 0) {
            resolve({ ok: false, reason: "empty" });
            return;
          }
          const blob = new Blob(chunks, { type: mimeType });
          // Oversized clips are still dropped rather than stored — but the
          // bitrate was chosen to make that unlikely, and the caller is told
          // why so it never looks like the feature simply did nothing.
          resolve(
            isWithinMotionBudget(blob.size)
              ? { ok: true, clip: { blob, mimeType, durationMs } }
              : { ok: false, reason: "too-large" },
          );
        };

        try {
          recorder.stop();
        } catch {
          release();
          resolve({ ok: false, reason: "failed" });
        }
      }),

    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // Already torn down; nothing to do.
      }
      chunks.length = 0;
      release();
    },
  };
}

/** File extension matching a recorded clip's container. */
export function motionExtension(mimeType: string): string {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}
