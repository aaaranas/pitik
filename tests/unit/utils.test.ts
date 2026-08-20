import { describe, expect, it } from "vitest";
import { cn, formatBytes, formatCount, formatTimeUntil, relativeDay, slugify } from "@/lib/utils";
import { extensionFor } from "@/lib/share";
import { isFrameReady } from "@/lib/camera/service";

/**
 * These strings are the app's voice. "Tonight" instead of a date is a product
 * decision, not a formatting detail, so it is pinned by a test.
 */
describe("relativeDay", () => {
  const evening = new Date(2026, 7, 19, 21, 0).getTime();
  const morning = new Date(2026, 7, 19, 9, 0).getTime();

  it("says Tonight after five in the afternoon", () => {
    expect(relativeDay(evening, evening)).toBe("Tonight");
  });

  it("says Today earlier in the day", () => {
    expect(relativeDay(morning, morning)).toBe("Today");
  });

  it("says Yesterday for the previous calendar day", () => {
    const yesterday = new Date(2026, 7, 18, 23, 0).getTime();
    expect(relativeDay(yesterday, morning)).toBe("Yesterday");
  });

  it("counts days within the week", () => {
    const threeDaysAgo = new Date(2026, 7, 16, 12, 0).getTime();
    expect(relativeDay(threeDaysAgo, morning)).toBe("3 days ago");
  });

  it("compares calendar days, not elapsed hours", () => {
    // 02:00 today vs 23:00 yesterday is three hours apart but a day boundary.
    const lateLastNight = new Date(2026, 7, 18, 23, 0).getTime();
    const earlyToday = new Date(2026, 7, 19, 2, 0).getTime();
    expect(relativeDay(lateLastNight, earlyToday)).toBe("Yesterday");
  });
});

describe("formatTimeUntil", () => {
  const now = 1_000_000_000_000;

  it("reports a passed deadline as ready", () => {
    expect(formatTimeUntil(now - 1000, now)).toBe("ready now");
  });

  it("uses minutes under an hour", () => {
    expect(formatTimeUntil(now + 25 * 60_000, now)).toBe("in 25 minutes");
    expect(formatTimeUntil(now + 60_000, now)).toBe("in 1 minute");
  });

  it("uses hours under a day", () => {
    expect(formatTimeUntil(now + 3 * 3_600_000, now)).toBe("in 3 hours");
    expect(formatTimeUntil(now + 3_600_000, now)).toBe("in 1 hour");
  });

  it("uses days beyond that", () => {
    expect(formatTimeUntil(now + 50 * 3_600_000, now)).toBe("in 2 days");
  });
});

describe("formatCount", () => {
  it("pluralises", () => {
    expect(formatCount(1, "photo")).toBe("1 photo");
    expect(formatCount(0, "photo")).toBe("0 photos");
    expect(formatCount(12, "photo")).toBe("12 photos");
  });

  it("accepts an irregular plural", () => {
    expect(formatCount(2, "shelf", "shelves")).toBe("2 shelves");
  });
});

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("drops the decimal once the number is large enough not to need it", () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
  });
});

describe("slugify", () => {
  it("makes a filename-safe slug", () => {
    expect(slugify("Dinner with Bea!")).toBe("dinner-with-bea");
    expect(slugify("  ✨ Beach Day ✨ ")).toBe("beach-day");
  });

  it("falls back rather than producing an empty name", () => {
    expect(slugify("✨✨✨")).toBe("roll");
    expect(slugify("")).toBe("roll");
  });

  it("caps the length so filenames stay reasonable", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});

describe("extensionFor", () => {
  it("picks the extension from the blob's type", () => {
    expect(extensionFor(new Blob([], { type: "image/png" }))).toBe("png");
    expect(extensionFor(new Blob([], { type: "image/webp" }))).toBe("webp");
    expect(extensionFor(new Blob([], { type: "image/jpeg" }))).toBe("jpg");
    // Unknown types default to jpg rather than producing an extensionless file.
    expect(extensionFor(new Blob([]))).toBe("jpg");
  });
});

describe("cn", () => {
  it("lets a later Tailwind class win over an earlier conflicting one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});

/**
 * The readiness predicate behind the shutter.
 *
 * Regression cover for a bug that lost roughly one photo in four: `videoWidth`
 * turns non-zero at HAVE_METADATA, before any pixels have been decoded, and
 * capturing there throws.
 */
describe("isFrameReady", () => {
  const video = (readyState: number, width = 1920, height = 1080) => ({
    videoWidth: width,
    videoHeight: height,
    readyState,
  });

  it("rejects a video that has only reported its dimensions", () => {
    // HAVE_METADATA: size is known, no frame exists yet.
    expect(isFrameReady(video(1))).toBe(false);
  });

  it("rejects a video with nothing loaded at all", () => {
    expect(isFrameReady(video(0))).toBe(false);
    expect(isFrameReady(video(0, 0, 0))).toBe(false);
  });

  it("accepts a video from HAVE_CURRENT_DATA upward", () => {
    expect(isFrameReady(video(2))).toBe(true);
    expect(isFrameReady(video(3))).toBe(true);
    expect(isFrameReady(video(4))).toBe(true);
  });

  it("rejects a decoded video that has no dimensions", () => {
    expect(isFrameReady(video(4, 0, 0))).toBe(false);
  });
});
