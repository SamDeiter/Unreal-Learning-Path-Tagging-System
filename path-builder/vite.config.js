import { defineConfig } from "vite";
import { execSync } from "child_process";

// Build-time constants — safe fallbacks when git is unavailable (CI, fresh clones)
let commitHash = "unknown";
let buildNumber = "0";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
  buildNumber = execSync("git rev-list --count HEAD").toString().trim();
} catch {
  // git unavailable — use defaults
}
const buildTime = new Date().toISOString();
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/Unreal-Learning-Path-Tagging-System/",
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
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

          // Note: Large JSON data files (transcript_segments, search_index,
          // segment_index, doc_links, video_library_enriched) now live in
          // public/data/ and are fetched at runtime via dataLoader.js.
          // Remaining small data files still bundle into a single chunk.
          if (nid.includes("src/data/")) {
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
});
