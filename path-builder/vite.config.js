import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
          }
          // Split JSON data files
          if (nid.includes("src/data/video_library_enriched")) return "course-data";
          if (nid.endsWith("tags.json") && nid.includes("src/data")) return "course-data";
          if (nid.endsWith("edges.json") && nid.includes("src/data")) return "course-data";
        },
      },
    },
  },
});
