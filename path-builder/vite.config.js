/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Use the function form so we can call loadEnv() and guarantee
// VITE_E2E_BYPASS reaches import.meta.env in every environment.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "/Unreal-Learning-Path-Tagging-System/",
    plugins: [react()],
    // Explicitly define VITE_E2E_BYPASS from both process.env (CI step-level)
    // and .env file (written by CI before npx playwright test).
    define: {
      "import.meta.env.VITE_E2E_BYPASS": JSON.stringify(
        process.env.VITE_E2E_BYPASS || env.VITE_E2E_BYPASS || ""
      ),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Normalize Windows backslashes for matching
            const nid = id.replace(/\\/g, "/");

            // Isolate large vendor libraries into cacheable chunks
            if (nid.includes("node_modules/")) {
              if (nid.includes("cytoscape")) return "vendor-cytoscape";
              if (nid.includes("recharts") || nid.includes("/d3-")) return "vendor-charts";
              if (nid.includes("firebase")) return "vendor-firebase";
              if (nid.includes("jszip") || nid.includes("file-saver")) return "vendor-export";
            }

            // Split JSON data files into parallel-loadable chunks
            if (nid.includes("src/data/")) {
              // Search indices (~8.6MB) — loaded on first search
              if (nid.includes("search_index") || nid.includes("segment_index"))
                return "data-search";
              // Transcript data (~4.1MB) — loaded on video playback
              if (nid.includes("transcript_segments")) return "data-transcripts";
              // Embedding vectors (~11.3MB) — loaded on semantic search
              if (nid.includes("embeddings")) return "data-embeddings";
              // Core course data (~1.3MB) — loaded on app init
              return "data-courses";
            }
          },
        },
      },
    },
    test: {
      include: ["src/**/*.{test,spec}.{js,jsx}"],
      exclude: ["e2e/**", "**/node_modules/**"],
    },
  };
});
