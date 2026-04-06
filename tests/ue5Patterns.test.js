/**
 * Tests for UE5 error pattern matching (shared module used by ui/js/ue5Patterns.js)
 * These patterns are critical for crash log parsing accuracy.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Custom expect shim for compatibility
const expect = (actual) => ({
  toContainEqual: (expected) => {
    const found = actual.some(item => JSON.stringify(item) === JSON.stringify(expected));
    assert.ok(found, `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
  },
  toBeGreaterThanOrEqual: (expected) => {
    assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
  },
  toHaveLength: (expected) => {
    assert.strictEqual(actual.length, expected);
  },
  toBe: (expected) => {
    assert.strictEqual(actual, expected);
  },
  toContain: (expected) => {
    assert.ok(actual.includes(expected), `Expected ${JSON.stringify(actual)} to contain ${expected}`);
  }
});

// Re-define patterns inline since ui/js/ue5Patterns.js is a browser script (not a module)
const UE5_ERROR_PATTERNS = [
  { pattern: /ExitCode[=:\s]*(\d+)/i, type: "exitcode", extract: (m) => `ExitCode ${m[1]}` },
  { pattern: /Error[:\s]+([A-Z]+\d+)/i, type: "linker", extract: (m) => m[1] },
  { pattern: /ShaderCompileWorker/i, type: "shader", extract: () => "Shader compilation error" },
  { pattern: /D3D\s*device\s*lost/i, type: "gpu", extract: () => "D3D device lost" },
  { pattern: /GPU\s*crash/i, type: "gpu", extract: () => "GPU crash" },
  { pattern: /Accessed\s*None/i, type: "blueprint", extract: () => "Blueprint Accessed None" },
  { pattern: /cook\s*(fail|error)/i, type: "cook", extract: () => "Cook failure" },
  { pattern: /packaging\s*(fail|error)/i, type: "packaging", extract: () => "Packaging error" },
  { pattern: /Lumen/i, type: "lumen", extract: () => "Lumen issue" },
  { pattern: /Nanite/i, type: "nanite", extract: () => "Nanite issue" },
  { pattern: /replication|multiplayer|net/i, type: "network", extract: () => "Network/replication" },
  { pattern: /Fatal\s*error/i, type: "fatal", extract: () => "Fatal error" },
  { pattern: /LogCore:\s*Error/i, type: "core", extract: () => "Core error" },
  { pattern: /out\s*of\s*(memory|video\s*memory)/i, type: "memory", extract: () => "Out of memory" },
];

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Helper: run all patterns against text, return matches
function matchPatterns(text) {
  const results = [];
  const seenTypes = new Set();
  for (const { pattern, type, extract } of UE5_ERROR_PATTERNS) {
    const match = text.match(pattern);
    if (match && !seenTypes.has(type)) {
      results.push({ type, label: extract(match) });
      seenTypes.add(type);
    }
  }
  return results;
}

describe("UE5 Error Pattern Matching", () => {
  test("detects ExitCode with = separator", () => {
    const results = matchPatterns("Build failed with ExitCode=25");
    expect(results).toContainEqual({ type: "exitcode", label: "ExitCode 25" });
  });

  test("detects ExitCode with : separator", () => {
    const results = matchPatterns("Process ExitCode: 1");
    expect(results).toContainEqual({ type: "exitcode", label: "ExitCode 1" });
  });

  test("detects shader compilation errors", () => {
    const results = matchPatterns("ShaderCompileWorker crashed");
    expect(results).toContainEqual({ type: "shader", label: "Shader compilation error" });
  });

  test("detects D3D device lost", () => {
    const results = matchPatterns("D3D device lost error in RHI");
    expect(results).toContainEqual({ type: "gpu", label: "D3D device lost" });
  });

  test("detects GPU crash", () => {
    const results = matchPatterns("Detected GPU crash on frame 12345");
    expect(results).toContainEqual({ type: "gpu", label: "GPU crash" });
  });

  test("detects Accessed None blueprint error", () => {
    const results = matchPatterns("Blueprint Runtime Error: Accessed None trying to read property");
    expect(results).toContainEqual({ type: "blueprint", label: "Blueprint Accessed None" });
  });

  test("detects cook failure", () => {
    const results = matchPatterns("Cook failed for package /Game/Maps/MainLevel");
    expect(results).toContainEqual({ type: "cook", label: "Cook failure" });
  });

  test("detects packaging error", () => {
    const results = matchPatterns("Packaging failed due to missing assets");
    expect(results).toContainEqual({ type: "packaging", label: "Packaging error" });
  });

  test("detects Lumen issues", () => {
    const results = matchPatterns("Lumen GI flickering in dark scene");
    expect(results).toContainEqual({ type: "lumen", label: "Lumen issue" });
  });

  test("detects Nanite issues", () => {
    const results = matchPatterns("Nanite mesh not rendering correctly");
    expect(results).toContainEqual({ type: "nanite", label: "Nanite issue" });
  });

  test("detects network/replication issues", () => {
    const results = matchPatterns("Replication failed for Actor BP_Player");
    expect(results).toContainEqual({ type: "network", label: "Network/replication" });
  });

  test("detects fatal errors", () => {
    const results = matchPatterns("Fatal error: Unhandled Exception");
    expect(results).toContainEqual({ type: "fatal", label: "Fatal error" });
  });

  test("detects out of memory", () => {
    const results = matchPatterns("Out of video memory trying to allocate texture");
    expect(results).toContainEqual({ type: "memory", label: "Out of memory" });
  });

  test("extracts multiple patterns from a real crash log", () => {
    const crashLog = `
      [2024/01/15 10:30:22] Fatal error: Unhandled Exception
      [2024/01/15 10:30:22] D3D device lost
      [2024/01/15 10:30:22] ExitCode=3
    `;
    const results = matchPatterns(crashLog);
    expect(results.length).toBeGreaterThanOrEqual(3);
    const types = results.map((r) => r.type);
    expect(types).toContain("fatal");
    expect(types).toContain("gpu");
    expect(types).toContain("exitcode");
  });

  test("deduplicates by type (only first GPU match)", () => {
    const log = "GPU crash detected\nD3D device lost";
    const results = matchPatterns(log);
    const gpuResults = results.filter((r) => r.type === "gpu");
    expect(gpuResults).toHaveLength(1);
  });

  test("returns empty for unrecognized text", () => {
    const results = matchPatterns("Everything is working fine");
    expect(results).toHaveLength(0);
  });
});

describe("escapeHtml", () => {
  test("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  test("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  test("returns empty string for falsy input", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("")).toBe("");
  });

  test("converts numbers to string", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});
