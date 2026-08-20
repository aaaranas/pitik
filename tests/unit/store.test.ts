import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "@/lib/db/repo";
import { resetDBHandle } from "@/lib/db/schema";
import { isShareCode, newId, newShareCode } from "@/lib/ids";

/**
 * The local store is the whole product's foundation: if a photo doesn't land
 * here, it doesn't exist. These tests run against a real IndexedDB
 * implementation rather than a mock, so index definitions, key ranges, and
 * transaction boundaries are all exercised for real.
 */

function fakeBlob(bytes = 8): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

/** `thumbSize` gives each photo a distinguishable thumbnail — records come back
 *  from IndexedDB as structural clones, so tests compare content, not identity. */
async function addPhoto(rollId: string, createdAt?: number, thumbSize = 4) {
  return repo.addCapture({
    rollId,
    blob: fakeBlob(),
    thumb: fakeBlob(thumbSize),
    width: 1200,
    height: 900,
    filterId: "natural",
    profileId: "everyday",
    aspect: "4:3",
    source: "camera",
    mirrored: false,
    createdAt,
  });
}

beforeEach(() => {
  // A fresh database per test — otherwise ordering assertions depend on which
  // test ran first, which is exactly the kind of flake that erodes trust.
  globalThis.indexedDB = new IDBFactory();
  resetDBHandle();
});

describe("rolls", () => {
  it("creates a roll with sane defaults", async () => {
    const roll = await repo.createRoll({ title: "Dinner with Sam" });
    expect(roll.title).toBe("Dinner with Sam");
    expect(roll.mode).toBe("standard");
    expect(roll.shotLimit).toBeNull();
    expect(roll.syncState).toBe("local");
    expect(roll.shareCode).toBeNull();
  });

  it("falls back to a title rather than storing an empty one", async () => {
    const roll = await repo.createRoll({ title: "   " });
    expect(roll.title).toBe("Untitled roll");
  });

  it("gives a disposable roll a shot limit and a reveal time", async () => {
    const roll = await repo.createRoll({
      title: "Beach day",
      mode: "disposable",
      shotLimit: 12,
      developHours: 12,
    });
    expect(roll.shotLimit).toBe(12);
    expect(roll.revealAt).toBeGreaterThan(Date.now());
    expect(roll.developedAt).toBeNull();
  });

  it("lists rolls with the most recently active first", async () => {
    const first = await repo.createRoll({ title: "First" });
    const second = await repo.createRoll({ title: "Second" });
    await repo.updateRoll(second.id, { updatedAt: 1000 });
    await repo.updateRoll(first.id, { title: "First, touched", updatedAt: 2000 });

    const rolls = await repo.listRolls();
    expect(rolls.map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it("bumps a roll's activity time when it is edited", async () => {
    const roll = await repo.createRoll({ title: "A" });
    await repo.updateRoll(roll.id, { updatedAt: 1000 });
    const touched = await repo.updateRoll(roll.id, { title: "A, renamed" });
    expect(touched!.updatedAt).toBeGreaterThan(1000);
  });

  it("reorders a roll to the top when a photo is added to it", async () => {
    const older = await repo.createRoll({ title: "Older" });
    const newer = await repo.createRoll({ title: "Newer" });
    // Explicit timestamps: two rolls created in the same millisecond would
    // otherwise tie, and the assertion would depend on insertion order.
    await repo.updateRoll(newer.id, { updatedAt: 2000 });
    await repo.updateRoll(older.id, { updatedAt: 1000 });
    await addPhoto(older.id, 3000);

    const rolls = await repo.listRolls();
    expect(rolls[0].id).toBe(older.id);
    expect(rolls[1].id).toBe(newer.id);
  });
});

describe("share codes", () => {
  it("mints a code only on demand", async () => {
    const roll = await repo.createRoll({ title: "Trip" });
    expect(roll.shareCode).toBeNull();

    const code = await repo.ensureShareCode(roll.id);
    expect(code).toBeTruthy();
    expect(isShareCode(code!)).toBe(true);
  });

  it("returns the same code on a second call", async () => {
    const roll = await repo.createRoll({ title: "Trip" });
    const first = await repo.ensureShareCode(roll.id);
    const second = await repo.ensureShareCode(roll.id);
    expect(second).toBe(first);
  });

  it("resolves a roll by its code, case-insensitively", async () => {
    const roll = await repo.createRoll({ title: "Trip" });
    const code = (await repo.ensureShareCode(roll.id))!;
    const found = await repo.getRollByShareCode(code.toLowerCase());
    expect(found?.id).toBe(roll.id);
  });

  it("excludes characters that are ambiguous when read aloud", () => {
    for (let i = 0; i < 200; i++) {
      expect(newShareCode()).not.toMatch(/[O0IL1UV]/);
    }
  });

  it("mints distinct ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});

describe("captures", () => {
  it("returns a roll's frames in shooting order", async () => {
    const roll = await repo.createRoll({ title: "Night out" });
    await addPhoto(roll.id, 3000);
    await addPhoto(roll.id, 1000);
    await addPhoto(roll.id, 2000);

    const captures = await repo.listCaptures(roll.id);
    expect(captures.map((c) => c.createdAt)).toEqual([1000, 2000, 3000]);
  });

  it("keeps rolls isolated from each other", async () => {
    const a = await repo.createRoll({ title: "A" });
    const b = await repo.createRoll({ title: "B" });
    await addPhoto(a.id);
    await addPhoto(a.id);
    await addPhoto(b.id);

    expect(await repo.countCaptures(a.id)).toBe(2);
    expect(await repo.countCaptures(b.id)).toBe(1);
  });

  it("toggles a favourite both ways", async () => {
    const roll = await repo.createRoll({ title: "A" });
    const capture = await addPhoto(roll.id);

    expect((await repo.toggleFavorite(capture.id))?.favorite).toBe(true);
    expect(await repo.listFavorites()).toHaveLength(1);
    expect((await repo.toggleFavorite(capture.id))?.favorite).toBe(false);
    expect(await repo.listFavorites()).toHaveLength(0);
  });

  it("hides deleted frames but keeps the tombstone for sync", async () => {
    const roll = await repo.createRoll({ title: "A" });
    const capture = await addPhoto(roll.id);
    await repo.deleteCapture(capture.id);

    expect(await repo.listCaptures(roll.id)).toHaveLength(0);
    expect(await repo.getCapture(capture.id)).toBeUndefined();
  });

  it("returns the newest frames across every roll", async () => {
    const a = await repo.createRoll({ title: "A" });
    const b = await repo.createRoll({ title: "B" });
    await addPhoto(a.id, 1000);
    await addPhoto(b.id, 3000);
    await addPhoto(a.id, 2000);

    const recent = await repo.listRecentCaptures(2);
    expect(recent.map((c) => c.createdAt)).toEqual([3000, 2000]);
  });

  it("returns a cover for a roll with photos and none for an empty one", async () => {
    const shot = await repo.createRoll({ title: "Shot" });
    const empty = await repo.createRoll({ title: "Empty" });
    await addPhoto(shot.id);

    const covers = await repo.rollCovers([shot.id, empty.id]);
    expect(Object.keys(covers)).toEqual([shot.id]);
  });
});

/**
 * Cover selection is tested on its own because fake-indexeddb's structured
 * clone does not preserve Blob identity or size, so a round-tripped thumbnail
 * cannot be told apart from any other. Real IndexedDB does preserve them; the
 * rule itself is what matters here.
 */
describe("pickCover", () => {
  const capture = (id: string, createdAt: number, deletedAt: number | null = null) =>
    ({ id, createdAt, deletedAt }) as never;

  it("picks the most recent frame", () => {
    const chosen = repo.pickCover([
      capture("a", 1000),
      capture("c", 5000),
      capture("b", 3000),
    ]);
    expect(chosen?.id).toBe("c");
  });

  it("ignores deleted frames", () => {
    const chosen = repo.pickCover([capture("a", 1000), capture("b", 9000, Date.now())]);
    expect(chosen?.id).toBe("a");
  });

  it("returns nothing for an empty or fully deleted roll", () => {
    expect(repo.pickCover([])).toBeUndefined();
    expect(repo.pickCover([capture("a", 1, Date.now())])).toBeUndefined();
  });
});

describe("deleting a roll", () => {
  it("takes its photos and strips with it", async () => {
    const roll = await repo.createRoll({ title: "A" });
    await addPhoto(roll.id);
    await repo.addStrip({
      rollId: roll.id,
      templateId: "classic-4",
      blob: fakeBlob(),
      thumb: fakeBlob(4),
      width: 800,
      height: 2400,
      captureIds: [],
      caption: null,
    });

    await repo.deleteRoll(roll.id);

    expect(await repo.getRoll(roll.id)).toBeUndefined();
    expect(await repo.listCaptures(roll.id)).toHaveLength(0);
    expect(await repo.listStrips(roll.id)).toHaveLength(0);
    expect(await repo.listRolls()).toHaveLength(0);
  });
});

describe("outbox", () => {
  it("collapses duplicate enqueues of the same work", async () => {
    await repo.enqueue("capture.upload", "abc");
    await repo.enqueue("capture.upload", "abc");
    expect(await repo.countOutbox()).toBe(1);
  });

  it("keeps different kinds of work for the same entity apart", async () => {
    await repo.enqueue("capture.upload", "abc");
    await repo.enqueue("capture.delete", "abc");
    expect(await repo.countOutbox()).toBe(2);
  });

  it("backs off further after each failure, up to a cap", async () => {
    expect(repo.backoffDelay(1)).toBe(10_000);
    expect(repo.backoffDelay(2)).toBe(20_000);
    expect(repo.backoffDelay(99)).toBe(30 * 60 * 1000);
  });

  it("stops offering a failed item until its backoff has elapsed", async () => {
    await repo.enqueue("capture.upload", "abc");
    const [item] = await repo.dueOutboxItems();
    await repo.failOutboxItem(item.id, "network down");

    expect(await repo.dueOutboxItems()).toHaveLength(0);
    expect(await repo.countOutbox()).toBe(1);
  });

  it("drops an item once it completes", async () => {
    await repo.enqueue("roll.upsert", "abc");
    const [item] = await repo.dueOutboxItems();
    await repo.completeOutboxItem(item.id);
    expect(await repo.countOutbox()).toBe(0);
  });
});

describe("settings", () => {
  it("creates a device id once and keeps it", async () => {
    const first = await repo.getSettings();
    const second = await repo.getSettings();
    expect(first.deviceId).toBe(second.deviceId);
    expect(first.deviceId).toBeTruthy();
  });

  it("defaults sync to off", async () => {
    expect((await repo.getSettings()).syncEnabled).toBe(false);
  });

  it("merges a patch without dropping other fields", async () => {
    await repo.updateSettings({ shutterSound: false });
    const settings = await repo.getSettings();
    expect(settings.shutterSound).toBe(false);
    expect(settings.haptics).toBe(true);
  });
});

describe("housekeeping", () => {
  it("erases everything on request", async () => {
    const roll = await repo.createRoll({ title: "A" });
    await addPhoto(roll.id);
    await repo.enqueue("capture.upload", "abc");

    await repo.eraseAllData();

    expect(await repo.listRolls()).toHaveLength(0);
    expect(await repo.listRecentCaptures()).toHaveLength(0);
    expect(await repo.countOutbox()).toBe(0);
  });

  it("purges tombstones that are not waiting to sync", async () => {
    const roll = await repo.createRoll({ title: "A" });
    const capture = await addPhoto(roll.id);
    await repo.deleteCapture(capture.id);

    expect(await repo.purgeDeleted()).toBeGreaterThan(0);
    expect(await repo.storageReport()).toMatchObject({ captures: 0 });
  });

  it("leaves a pending tombstone alone so the deletion can still propagate", async () => {
    const roll = await repo.createRoll({ title: "A" });
    const capture = await addPhoto(roll.id);
    await repo.updateCapture(capture.id, { syncState: "pending", deletedAt: Date.now() });

    await repo.purgeDeleted();
    expect((await repo.storageReport()).captures).toBe(1);
  });
});

describe("change feed", () => {
  it("announces the store that changed", async () => {
    const seen: string[] = [];
    const unsubscribe = repo.subscribe((scope) => seen.push(scope));

    const roll = await repo.createRoll({ title: "A" });
    await addPhoto(roll.id);
    unsubscribe();
    await repo.createRoll({ title: "After unsubscribe" });

    expect(seen).toContain("rolls");
    expect(seen).toContain("captures");
    expect(seen.filter((s) => s === "rolls")).toHaveLength(2); // create + touch
  });
});
