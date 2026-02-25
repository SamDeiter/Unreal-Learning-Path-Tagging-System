/**
 * Performance & Bundle Regression Tests
 *
 * Guards against:
 *   1. Build breakage (vite build must succeed)
 *   2. Bundle bloat (total output must stay under size cap)
 *   3. Critical chunk presence (code-split chunks must exist)
 *   4. Entry point size (index.html must be reasonable)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../../dist");

describe("Production Build", () => {
  // Run build once before all tests
  beforeAll(() => {
    execSync("npx vite build", {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "pipe",
      timeout: 60_000,
    });
  }, 90_000);

  it("should produce a dist directory", () => {
    expect(fs.existsSync(DIST)).toBe(true);
  });

  it("should produce an index.html", () => {
    const indexPath = path.join(DIST, "index.html");
    expect(fs.existsSync(indexPath)).toBe(true);

    const html = fs.readFileSync(indexPath, "utf8");
    expect(html).toContain("<script");
    expect(html).toContain('type="module"');
  });

  it("should produce JS and CSS assets", () => {
    const assets = path.join(DIST, "assets");
    expect(fs.existsSync(assets)).toBe(true);

    const files = fs.readdirSync(assets);
    const jsFiles = files.filter((f) => f.endsWith(".js"));
    const cssFiles = files.filter((f) => f.endsWith(".css"));

    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
  });
});

describe("Bundle Size Regression", () => {
  it("total bundle should be under 55 MB (data-heavy app with embeddings)", () => {
    const assets = path.join(DIST, "assets");
    if (!fs.existsSync(assets)) return;

    const files = fs.readdirSync(assets);
    let totalBytes = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(assets, f));
      totalBytes += stat.size;
    }

    const totalMB = totalBytes / (1024 * 1024);
    expect(totalMB).toBeLessThan(55);
  });

  it("no individual JS chunk should exceed 5 MB (excluding data chunks)", () => {
    const assets = path.join(DIST, "assets");
    if (!fs.existsSync(assets)) return;

    const files = fs.readdirSync(assets);
    const jsFiles = files.filter((f) => f.endsWith(".js"));

    const oversized = [];
    for (const f of jsFiles) {
      // Skip data chunks (search indices, embeddings, transcripts)
      if (f.includes("data-")) continue;

      const stat = fs.statSync(path.join(assets, f));
      const sizeMB = stat.size / (1024 * 1024);
      if (sizeMB > 5) {
        oversized.push(`${f}: ${sizeMB.toFixed(1)} MB`);
      }
    }

    expect(oversized).toEqual([]);
  });
});

describe("Code Splitting Verification", () => {
  it("should have vendor chunks for heavy libraries", () => {
    const assets = path.join(DIST, "assets");
    if (!fs.existsSync(assets)) return;

    const files = fs.readdirSync(assets);
    const jsFiles = files.filter((f) => f.endsWith(".js"));
    const names = jsFiles.join("|");

    // Verify code splitting produced separate vendor chunks
    expect(names).toMatch(/vendor-|chunk-/i);
  });

  it("should have data chunks for lazy-loaded data", () => {
    const assets = path.join(DIST, "assets");
    if (!fs.existsSync(assets)) return;

    const files = fs.readdirSync(assets);
    const names = files.join("|");

    // Verify data is code-split into separate chunks
    expect(names).toMatch(/data-/);
  });
});
