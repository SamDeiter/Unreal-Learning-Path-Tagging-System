import { defineConfig } from "vite";
import { execSync } from "child_process";

// Build-time constants injected into the app
const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
const buildTime = new Date().toISOString();
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "/Unreal-Learning-Path-Tagging-System/",
  plugins: [react()],
  define: {
    __BUILD_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
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
            if (nid.includes("search_index") || nid.includes("segment_index")) return "data-search";
            // Transcript data (~4.1MB) — loaded on video playback
            if (nid.includes("transcript_segments")) return "data-transcripts";
            // Embedding vectors (~11.3MB) — loaded on semantic search
            if (nid.includes("embeddings")) return "data-embeddings";
            // Doc links (~4.1MB) — loaded on reading steps / doc search
            if (nid.includes("doc_links")) return "data-docs";
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
});
