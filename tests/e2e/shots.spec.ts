import { test } from "@playwright/test";
import { open } from "./helpers";

test("landing", async ({ page }) => {
  await open(page, "/camera");
  await page.getByRole("button", { name: "Take a photo" }).waitFor({ timeout: 15000 });
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Take a photo" }).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(800);

  await open(page, "/");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".shots/home.png", fullPage: true });
});
