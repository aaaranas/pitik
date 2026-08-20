import { expect, test } from "@playwright/test";
import { countStore, open } from "./helpers";

/**
 * The flow the whole product exists for: open the app, name a moment, take a
 * photograph, find it in the roll. If this passes, Pitik works.
 */

test("takes a photo and files it under a named roll", async ({ page }) => {
  await open(page, "/");

  await page.getByRole("button", { name: /Start a Roll/i }).click();
  await page.getByLabel("Roll name").fill("Playwright night");
  await page.getByRole("button", { name: "Start shooting" }).click();

  await expect(page).toHaveURL(/\/camera/);
  await expect(page.getByText("Playwright night")).toBeVisible();

  // The permission prompt is pre-granted, but the camera still only starts on a
  // deliberate tap — that is the product behaviour being asserted here.
  await page.getByRole("button", { name: "Turn on the camera" }).click();

  const shutter = page.getByRole("button", { name: "Take a photo" });
  await expect(shutter).toBeVisible({ timeout: 15_000 });

  await shutter.click();
  await expect.poll(() => countStore(page, "captures"), { timeout: 15_000 }).toBe(1);

  // The exposure counter on the camera back is the visible confirmation.
  await expect(page.getByText("1 shot taken")).toBeAttached();
});

test("shoots several frames in a row without blocking", async ({ page }) => {
  await open(page, "/camera");
  await page.getByRole("button", { name: "Turn on the camera" }).click();

  const shutter = page.getByRole("button", { name: "Take a photo" });
  await expect(shutter).toBeVisible({ timeout: 15_000 });

  // Rapid fire: no confirmation screen may appear between shots.
  for (let i = 0; i < 4; i++) {
    await shutter.click();
    await page.waitForTimeout(120);
  }

  await expect.poll(() => countStore(page, "captures"), { timeout: 20_000 }).toBe(4);
  await expect(shutter).toBeVisible();
});

test("files camera photos in the camera library, not an invented roll", async ({ page }) => {
  await open(page, "/camera");
  await page.getByRole("button", { name: "Turn on the camera" }).click();
  const shutter = page.getByRole("button", { name: "Take a photo" });
  await expect(shutter).toBeVisible({ timeout: 15_000 });
  await shutter.click();
  await expect.poll(() => countStore(page, "captures"), { timeout: 15_000 }).toBe(1);

  // Shooting without starting a roll must not create one: a photograph is not
  // a decision to begin a named session.
  await expect
    .poll(() => countStore(page, "rolls"), { timeout: 10_000 })
    .toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Rolls" })).toHaveCount(0);

  await page.getByRole("link", { name: "Open your camera photos" }).click();
  await expect(page).toHaveURL(/\/rolls\?tab=camera/);
  await expect(page.getByRole("tab", { name: "Camera" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const frame = page.getByRole("button", { name: /^Frame 1/ });
  await expect(frame).toBeVisible();

  await frame.click();
  await expect(page.getByRole("button", { name: "Add to favourites" })).toBeVisible();

  await page.getByRole("button", { name: "Add to favourites" }).click();
  await expect(page.getByRole("button", { name: "Remove from favourites" })).toBeVisible();
});

test("keeps photos on the device when there is no network", async ({ page, context }) => {
  await open(page, "/camera");
  await page.getByRole("button", { name: "Turn on the camera" }).click();
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeVisible({
    timeout: 15_000,
  });

  await context.setOffline(true);
  await page.getByRole("button", { name: "Take a photo" }).click();

  await expect.poll(() => countStore(page, "captures"), { timeout: 15_000 }).toBe(1);
  await expect(page.getByText(/Offline — the camera still works/)).toBeVisible();
});
