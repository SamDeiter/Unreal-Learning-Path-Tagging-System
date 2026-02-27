// @ts-check
/* global process */
import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E configuration for the Path Builder app.
 * Runs against the Vite dev server with VITE_E2E_BYPASS=true
 * to bypass Firebase AuthGate during testing.
 *
 * On Linux/CI: env var is inlined in the shell command (most reliable).
 * On Windows: relies on webServer.env + the .env file written by CI.
 */

const isWindows = process.platform === "win32";

// Inline the env var on Linux/Mac so it's guaranteed to reach the Vite
// process regardless of how Playwright passes webServer.env variables.
const viteCommand = isWindows
  ? "npx vite --port 5174"
  : "VITE_E2E_BYPASS=true npx vite --port 5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:5174/Unreal-Learning-Path-Tagging-System/",
    viewport: { width: 1280, height: 720 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  /* Start a separate Vite dev server with auth bypass on a different port */
  webServer: {
    command: viteCommand,
    url: "http://localhost:5174/Unreal-Learning-Path-Tagging-System/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Belt-and-suspenders: also set via env for Windows local dev
    env: {
      VITE_E2E_BYPASS: "true",
    },
  },
});
