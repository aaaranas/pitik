import { expect, test } from "@playwright/test";
import { open } from "./helpers";

/**
 * Installability and offline resilience.
 *
 * These run against a production build, which is the only place the service
 * worker exists — asserting them in dev would prove nothing about what ships.
 */

test("serves an installable manifest", async ({ page }) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toContain("Pitik");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");

  // Chromium requires a 192px and a 512px icon before it offers installation.
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(
    true,
  );

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(icon.src);
    expect(iconResponse.ok(), `${icon.src} is missing`).toBe(true);
  }
});

test("registers a service worker and caches the offline shell", async ({ page }) => {
  await open(page, "/");

  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 20_000,
    })
    .toBe(true);

  const cachedOffline = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      if (await cache.match("/offline")) return true;
    }
    return false;
  });
  expect(cachedOffline).toBe(true);
});

test("still opens when the network is gone", async ({ page, context }) => {
  await open(page, "/");
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 20_000,
    })
    .toBe(true);

  await context.setOffline(true);
  await page.reload();

  // Either the cached home screen or the offline fallback is acceptable — what
  // must not appear is the browser's own error page. Pitik's navigation is the
  // unambiguous tell that the service worker answered.
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  // And the camera has to be reachable from wherever we landed, because that is
  // the thing that still works with the radio off.
  await expect(page.getByRole("link", { name: "Camera" }).first()).toBeVisible();
});

test("never sends a request to a third party", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Google Fonts is the one allowed origin: `next/font` self-hosts the files
    // at build time, so this should stay empty in a production build.
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      external.push(request.url());
    }
  });

  await open(page, "/");
  await open(page, "/booth");
  await open(page, "/rolls");
  await open(page, "/settings");

  expect(external, `unexpected third-party requests: ${external.join(", ")}`).toEqual([]);
});

test("keeps the development render check out of production", async ({ page }) => {
  // The route exists in the build output but must refuse to render, so the
  // reference-image tooling never ships to users.
  const response = await page.request.get("/dev/render-check");
  expect(response.status()).toBe(404);
});
