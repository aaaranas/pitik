import { expect, test } from "@playwright/test";
import { countStore, open } from "./helpers";

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
