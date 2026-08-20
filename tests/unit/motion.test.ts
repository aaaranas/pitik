import { describe, expect, it } from "vitest";
import {
  isWithinMotionBudget,
  MOTION_MAX_BYTES,
  MOTION_MIME_CANDIDATES,
  MOTION_MIME_CANDIDATES_WITH_AUDIO,
  motionCandidates,
  motionExtension,
  pickMotionMimeType,
} from "@/lib/camera/motion";

/**
 * Container choice and the size cap.
 *
 * Both are pure, and both decide whether a booth session produces a usable clip
 * or silently produces nothing — so they are tested against synthetic browsers
 * rather than against whichever engine happens to run the suite.
 */

/** A stand-in for `MediaRecorder.isTypeSupported`. */
const supporting = (...supported: string[]) =>
  (type: string) => supported.includes(type);

describe("pickMotionMimeType", () => {
  it("prefers MP4 wherever it is available", () => {
    // The clip exists to be sent to people. A WebM file that will not open on
    // the recipient's iPhone is the worse trade, whatever it saves in bytes.
    expect(pickMotionMimeType(() => true)).toBe("video/mp4;codecs=avc1");
  });

  it("lands on MP4 for a browser with no WebM recording, as on Safari", () => {
    const chosen = pickMotionMimeType(supporting("video/mp4;codecs=avc1", "video/mp4"));
    expect(chosen).toBe("video/mp4;codecs=avc1");
  });

  it("falls back to WebM only where MP4 recording is unavailable", () => {
    // Older Chromium, which could not record MP4 before 2023.
    const chosen = pickMotionMimeType(
      supporting("video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"),
    );
    expect(chosen).toBe("video/webm;codecs=vp9");
  });

  it("falls back again to VP8 when VP9 is unavailable", () => {
    const chosen = pickMotionMimeType(supporting("video/webm;codecs=vp8", "video/webm"));
    expect(chosen).toBe("video/webm;codecs=vp8");
  });

  it("returns null when nothing is supported, rather than guessing", () => {
    expect(pickMotionMimeType(() => false)).toBeNull();
  });

  it("treats a probe that throws as a refusal", () => {
    // Some engines throw on an unrecognised type instead of returning false.
    const chosen = pickMotionMimeType((type) => {
      if (type.startsWith("video/webm")) throw new TypeError("nope");
      return type === "video/mp4";
    });
    expect(chosen).toBe("video/mp4");
  });

  it("only ever returns a candidate from the list", () => {
    const chosen = pickMotionMimeType(() => true);
    expect(MOTION_MIME_CANDIDATES).toContain(chosen as (typeof MOTION_MIME_CANDIDATES)[number]);
  });
});

describe("motionCandidates", () => {
  it("names both codecs when there is sound to carry", () => {
    // Some engines accept `video/mp4` for video alone but reject it once an
    // audio track is attached, so the pair has to be probed explicitly.
    expect(motionCandidates(true)).toBe(MOTION_MIME_CANDIDATES_WITH_AUDIO);
    expect(motionCandidates(true)[0]).toContain("mp4a");
  });

  it("uses the video-only list for a silent recording", () => {
    expect(motionCandidates(false)).toBe(MOTION_MIME_CANDIDATES);
  });

  it("still prefers MP4 either way", () => {
    expect(motionCandidates(true)[0]).toContain("mp4");
    expect(motionCandidates(false)[0]).toContain("mp4");
  });

  it("offers a silent fallback for every audio container", () => {
    // A browser that refuses every audio pairing must still find a container,
    // otherwise declining the microphone would cost the clip entirely.
    const chosen = pickMotionMimeType(
      (type) => !type.includes("mp4a") && !type.includes("opus"),
      motionCandidates(true),
    );
    expect(chosen).not.toBeNull();
  });
});

describe("isWithinMotionBudget", () => {
  it("accepts an ordinary booth clip", () => {
    expect(isWithinMotionBudget(4 * 1024 * 1024)).toBe(true);
  });

  it("rejects an empty recording rather than storing a zero-byte clip", () => {
    // Nothing was captured; that is a failure, not a very small success.
    expect(isWithinMotionBudget(0)).toBe(false);
  });

  it("rejects a clip over the ceiling", () => {
    expect(isWithinMotionBudget(MOTION_MAX_BYTES + 1)).toBe(false);
    expect(isWithinMotionBudget(60 * 1024 * 1024)).toBe(false);
  });

  it("accepts a clip exactly at the ceiling", () => {
    expect(isWithinMotionBudget(MOTION_MAX_BYTES)).toBe(true);
  });

  it("honours a caller-supplied ceiling", () => {
    expect(isWithinMotionBudget(2000, 1000)).toBe(false);
    expect(isWithinMotionBudget(500, 1000)).toBe(true);
  });
});

describe("motionExtension", () => {
  it("matches the container", () => {
    expect(motionExtension("video/mp4;codecs=avc1")).toBe("mp4");
    expect(motionExtension("video/mp4")).toBe("mp4");
    expect(motionExtension("video/webm;codecs=vp9")).toBe("webm");
    expect(motionExtension("video/webm")).toBe("webm");
  });

  it("defaults to webm for anything unrecognised", () => {
    expect(motionExtension("application/octet-stream")).toBe("webm");
  });
});
