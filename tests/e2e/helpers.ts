import type { Page } from "@playwright/test";

/**
 * Shared helpers for the end-to-end suite.
 */

/**
 * Navigates and waits for React to take over.
 *
 * Next serves the shell as HTML, so Playwright can find and click a button
 * before any handler is attached — the click lands on a real element, passes
 * every actionability check, and does nothing. A person cannot click within
 * milliseconds of first paint; the test runner can, so it has to wait.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(
    () => document.documentElement.dataset.hydrated === "true",
    undefined,
    { timeout: 15_000 },
  );
}

/** Counts rows in one IndexedDB store, read from the page itself. */
export async function countStore(page: Page, store: string): Promise<number> {
  return page.evaluate(async (name) => {
    const request = indexedDB.open("pitik");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains(name)) return 0;
    return new Promise<number>((resolve) => {
      const count = db.transaction(name).objectStore(name).count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => resolve(-1);
    });
  }, store);
}

export interface StoredStripMotion {
  strips: number;
  hasMotion: boolean;
  size: number;
  mimeType: string | null;
}

/**
 * Reads back the motion clip stored with the most recent strip.
 *
 * Goes through IndexedDB rather than the UI because the point is to prove the
 * bytes were actually persisted, not that a button rendered.
 */
export async function readStripMotion(page: Page): Promise<StoredStripMotion> {
  return page.evaluate(async () => {
    const request = indexedDB.open("pitik");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains("strips")) {
      return { strips: 0, hasMotion: false, size: 0, mimeType: null };
    }
    const all = await new Promise<Record<string, unknown>[]>((resolve) => {
      const read = db.transaction("strips").objectStore("strips").getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => resolve([]);
    });
    const latest = all[all.length - 1] as { motion?: { blob: Blob; mimeType: string } } | undefined;
    const motion = latest?.motion;
    return {
      strips: all.length,
      hasMotion: Boolean(motion),
      size: motion?.blob?.size ?? 0,
      mimeType: motion?.mimeType ?? null,
    };
  });
}
