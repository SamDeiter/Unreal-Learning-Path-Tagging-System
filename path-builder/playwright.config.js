// @ts-check
/* global process */
import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E configuration for the Path Builder app.
 * Runs against the Vite dev server with VITE_E2E_BYPASS=true
 * to bypass Firebase AuthGate during testing.
 */
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
    command: "npx vite --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_E2E_BYPASS: "true",
    },
  },
});
