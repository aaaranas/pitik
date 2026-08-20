import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PITIK_E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The important part is the fake media stream: Chromium can synthesise a video
 * device, which means the whole camera path — permission, preview, shutter,
 * grading, IndexedDB write — runs for real in CI, on a machine with no webcam.
 * Without it, the most important flow in the product would be untestable and
 * would therefore go untested.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Granted up front so specs exercise the app rather than the browser's own
    // permission dialogs, which Playwright cannot click. The microphone is
    // needed because a booth session records the shoot with sound.
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        // Supplies a synthetic camera *and* microphone, so the whole recording
        // path runs on a machine with neither.
        "--use-fake-device-for-media-stream",
        // A moving synthetic scene, so frames differ between captures.
        "--allow-file-access-from-files",
      ],
    },
  },

  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Tested against a production build: the service worker and the static
    // shell only exist there, and those are the offline guarantees.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
