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
