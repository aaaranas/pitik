import { describe, expect, it } from "vitest";
import { batched, decideBlobRecord, decideRoll, toEpoch } from "@/lib/sync/merge";
import { backoffDelay } from "@/lib/db/repo";

/**
 * The merge policy decides whether a pull is allowed to touch a local record.
 *
 * These are the rules that stand between a sync round and somebody's
 * photographs, so they are tested as pure functions rather than being trusted
 * to behave correctly inside a network round-trip.
 */

const local = (over: Partial<{ deletedAt: number | null; syncState: string; updatedAt: number }> = {}) => ({
  deletedAt: null,
  syncState: "synced",
  updatedAt: 1000,
  ...over,
});

describe("decideRoll", () => {
  it("inserts a roll this device has never seen", () => {
    expect(decideRoll(undefined, { updatedAt: 5000 })).toBe("insert");
  });

  it("updates when the server copy is newer", () => {
    expect(decideRoll(local({ updatedAt: 1000 }), { updatedAt: 5000 })).toBe("update");
  });

  it("leaves an identical or older server copy alone", () => {
    expect(decideRoll(local({ updatedAt: 5000 }), { updatedAt: 5000 })).toBe("skip");
    expect(decideRoll(local({ updatedAt: 5000 }), { updatedAt: 1000 })).toBe("skip");
  });

  it("never resurrects a roll deleted on this device", () => {
    // Invariant 1. Even a much newer server copy must not undo the deletion.
    expect(decideRoll(local({ deletedAt: 1, updatedAt: 1 }), { updatedAt: 9_999_999 })).toBe(
      "skip",
    );
  });

  it("never clobbers an edit that hasn't been uploaded yet", () => {
    // Invariant 3: a roll renamed offline keeps its new name.
    expect(decideRoll(local({ syncState: "pending" }), { updatedAt: 9999 })).toBe("skip");
    expect(decideRoll(local({ syncState: "local" }), { updatedAt: 9999 })).toBe("skip");
  });

  it("does update a roll whose local copy is confirmed synced", () => {
    expect(decideRoll(local({ syncState: "synced" }), { updatedAt: 9999 })).toBe("update");
  });
});

describe("decideBlobRecord", () => {
  it("downloads a frame this device does not have", () => {
    expect(decideBlobRecord(undefined)).toBe("download");
  });

  it("never re-downloads a frame that is already here", () => {
    // Invariant 2: captures are immutable, so there is nothing to refresh.
    expect(decideBlobRecord(local())).toBe("skip");
  });

  it("never resurrects a frame deleted on this device", () => {
    expect(decideBlobRecord(local({ deletedAt: Date.now() }))).toBe("skip");
  });

  it("leaves a frame that is still waiting to upload", () => {
    expect(decideBlobRecord(local({ syncState: "pending" }))).toBe("skip");
  });
});

describe("toEpoch", () => {
  it("parses a Postgres timestamptz", () => {
    expect(toEpoch("2026-08-19T21:04:00.000Z")).toBe(Date.UTC(2026, 7, 19, 21, 4));
  });

  it("returns null for absent or unparseable values", () => {
    expect(toEpoch(null)).toBeNull();
    expect(toEpoch("not a date")).toBeNull();
  });
});

describe("batched", () => {
  it("splits ids so a filter never overruns a URL length limit", () => {
    const ids = Array.from({ length: 125 }, (_, i) => String(i));
    const batches = batched(ids, 50);
    expect(batches.map((b) => b.length)).toEqual([50, 50, 25]);
    expect(batches.flat()).toEqual(ids);
  });

  it("returns nothing for an empty list rather than one empty batch", () => {
    expect(batched([])).toEqual([]);
  });

  it("keeps a short list in a single batch", () => {
    expect(batched(["a", "b"], 50)).toEqual([["a", "b"]]);
  });
});

describe("backoff", () => {
  it("grows with each attempt and then holds at the cap", () => {
    expect(backoffDelay(1)).toBeLessThan(backoffDelay(2));
    expect(backoffDelay(2)).toBeLessThan(backoffDelay(3));
    expect(backoffDelay(50)).toBe(backoffDelay(99));
  });
});
