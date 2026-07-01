/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    exclude: ["e2e/**", "**/node_modules/**"],
    env: {
      VITE_E2E_BYPASS: "true",
    },
  },
});
