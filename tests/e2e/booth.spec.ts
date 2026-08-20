import { expect, test } from "@playwright/test";
import { countStore, open, readStripMotion } from "./helpers";

test("runs a booth sequence and composes a strip", async ({ page }) => {
  await open(page, "/booth");
  await expect(page.getByRole("heading", { name: "Choose a booth" })).toBeVisible();

  // Two shots keeps the sequence short; the mechanism is identical for four.
  await page.getByRole("link", { name: /Instant Pair/ }).click();
  await expect(page).toHaveURL(/\/booth\/run/);

  await page.getByRole("button", { name: "Turn on the camera" }).click();
  const start = page.getByRole("button", { name: "Start the booth" });
  await expect(start).toBeVisible({ timeout: 15_000 });

  await start.click();

  // The sequence is autonomous: no per-shot confirmation, and it lands on the
  // editor by itself once the template is full.
  await expect(page.getByRole("heading", { name: "Your strip" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByAltText("Your finished photo strip")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Caption").fill("e2e");
  await page.getByRole("button", { name: "Keep it" }).click();

  await expect(page).toHaveURL(/\/rolls\//, { timeout: 20_000 });
  await expect.poll(() => countStore(page, "strips"), { timeout: 20_000 }).toBe(1);
});

test("offers every booth layout with an honest shot count", async ({ page }) => {
  await open(page, "/booth");
  const cards = page.getByRole("link", { name: /shot/i });
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(8);
});

test("records the whole shoot and saves the clip with the strip", async ({ page }) => {
  await open(page, "/booth");
  await page.getByRole("link", { name: /Instant Pair/ }).click();
  await page.getByRole("button", { name: "Turn on the camera" }).click();

  const start = page.getByRole("button", { name: "Start the booth" });
  await expect(start).toBeVisible({ timeout: 15_000 });

  // The shoot is advertised as filmed before it starts, not after.
  await expect(page.getByText(/The whole shoot is filmed, with sound/)).toBeVisible();
  await start.click();

  // Recording runs for the whole sequence, so the indicator is live mid-shoot.
  // Matched on its announced text rather than the `status` role, which the
  // toast container also uses, and which takes no name from its content.
  await expect(page.getByText("Recording a clip of this shoot")).toBeAttached();

  await expect(page.getByRole("heading", { name: "Your strip" })).toBeVisible({
    timeout: 30_000,
  });

  // A clip exists, so the editor offers it as its own action.
  const clipAction = page.getByTestId("clip-action");
  await expect(clipAction).toBeVisible();
  await expect(page.getByText(/A clip of the shoot is saved with it/)).toBeVisible();

  // The recording is watchable in the app, and — more importantly — the file
  // actually decodes. A stored blob that no player can open would satisfy a
  // size assertion while being worthless.
  await clipAction.click();
  const video = page.getByTestId("clip-video");
  await expect(video).toBeVisible();
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) =>
            (element as HTMLVideoElement).readyState >= 2 &&
            Number.isFinite((element as HTMLVideoElement).duration),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page).toHaveURL(/\/rolls\//, { timeout: 20_000 });
  await expect.poll(() => countStore(page, "strips"), { timeout: 20_000 }).toBe(1);

  // The bytes actually landed in IndexedDB, and are a real clip.
  const motion = await readStripMotion(page);
  expect(motion.hasMotion).toBe(true);
  expect(motion.size).toBeGreaterThan(1000);
  expect(motion.mimeType).toMatch(/^video\/(webm|mp4)/);

  // And it stays reachable once the editor is gone.
  await expect(page.getByRole("tab", { name: "strips" })).toBeVisible();
  await page.getByRole("tab", { name: "strips" }).click();
  await expect(page.getByRole("button", { name: "Watch the clip of this shoot" })).toBeVisible();
});
