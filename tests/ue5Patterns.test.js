/**
 * Tests for UE5 error pattern matching (shared module used by ui/js/ue5Patterns.js)
 * These patterns are critical for crash log parsing accuracy.
 */

const { describe, it: test } = require('node:test');
const assert = require('node:assert/strict');
const { UE5_ERROR_PATTERNS, escapeHtml } = require('../ui/js/ue5Patterns.js');

// Custom expect shim to provide Vitest-like assertions for Node.js native test runner
const expect = (actual) => ({
  toBe: (expected) => assert.strictEqual(actual, expected),
  toEqual: (expected) => assert.deepStrictEqual(actual, expected),
  toHaveLength: (expected) => assert.strictEqual(actual.length, expected),
  toContainEqual: (expected) => {
    const found = actual.some((item) => {
      try {
        assert.deepStrictEqual(item, expected);
        return true;
      } catch {
        return false;
      }
    });
    if (!found) {
      throw new Error("Expected item not found in array");
    }
  },
  toBeGreaterThanOrEqual: (expected) => assert.ok(actual >= expected),
  toContain: (expected) => assert.ok(actual.includes(expected)),
});

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
    const crashLog = "Fatal error: Unhandled Exception\nD3D device lost\nExitCode=3";
    const results = matchPatterns(crashLog);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.map((r) => r.type)).toContain("fatal");
    expect(results.map((r) => r.type)).toContain("gpu");
    expect(results.map((r) => r.type)).toContain("exitcode");
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
    expect(escapeHtml('\"hello\"')).toBe("&quot;hello&quot;");
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
