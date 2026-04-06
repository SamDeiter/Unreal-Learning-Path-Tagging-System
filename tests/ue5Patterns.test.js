/**
 * Tests for UE5 error pattern matching (shared module used by ui/js/ue5Patterns.js)
 * These patterns are critical for crash log parsing accuracy.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");

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
    assert.ok(results.some(r => r.type === "exitcode" && r.label === "ExitCode 25"));
  });

  test("detects ExitCode with : separator", () => {
    const results = matchPatterns("Process ExitCode: 1");
    assert.ok(results.some(r => r.type === "exitcode" && r.label === "ExitCode 1"));
  });

  test("detects shader compilation errors", () => {
    const results = matchPatterns("ShaderCompileWorker crashed");
    assert.ok(results.some(r => r.type === "shader" && r.label === "Shader compilation error"));
  });

  test("detects D3D device lost", () => {
    const results = matchPatterns("D3D device lost error in RHI");
    assert.ok(results.some(r => r.type === "gpu" && r.label === "D3D device lost"));
  });

  test("detects GPU crash", () => {
    const results = matchPatterns("Detected GPU crash on frame 12345");
    assert.ok(results.some(r => r.type === "gpu" && r.label === "GPU crash"));
  });

  test("detects Accessed None blueprint error", () => {
    const results = matchPatterns("Blueprint Runtime Error: Accessed None trying to read property");
    assert.ok(results.some(r => r.type === "blueprint" && r.label === "Blueprint Accessed None"));
  });

  test("detects cook failure", () => {
    const results = matchPatterns("Cook failed for package /Game/Maps/MainLevel");
    assert.ok(results.some(r => r.type === "cook" && r.label === "Cook failure"));
  });

  test("detects packaging error", () => {
    const results = matchPatterns("Packaging failed due to missing assets");
    assert.ok(results.some(r => r.type === "packaging" && r.label === "Packaging error"));
  });

  test("detects Lumen issues", () => {
    const results = matchPatterns("Lumen GI flickering in dark scene");
    assert.ok(results.some(r => r.type === "lumen" && r.label === "Lumen issue"));
  });

  test("detects Nanite issues", () => {
    const results = matchPatterns("Nanite mesh not rendering correctly");
    assert.ok(results.some(r => r.type === "nanite" && r.label === "Nanite issue"));
  });

  test("detects network/replication issues", () => {
    const results = matchPatterns("Replication failed for Actor BP_Player");
    assert.ok(results.some(r => r.type === "network" && r.label === "Network/replication"));
  });

  test("detects fatal errors", () => {
    const results = matchPatterns("Fatal error: Unhandled Exception");
    assert.ok(results.some(r => r.type === "fatal" && r.label === "Fatal error"));
  });

  test("detects out of memory", () => {
    const results = matchPatterns("Out of video memory trying to allocate texture");
    assert.ok(results.some(r => r.type === "memory" && r.label === "Out of memory"));
  });

  test("extracts multiple patterns from a real crash log", () => {
    const crashLog = `
      [2024/01/15 10:30:22] Fatal error: Unhandled Exception
      [2024/01/15 10:30:22] D3D device lost
      [2024/01/15 10:30:22] ExitCode=3
    `;
    const results = matchPatterns(crashLog);
    const types = results.map(r => r.type);
    assert.ok(results.length >= 3, `Expected >= 3 matches, got ${results.length}`);
    assert.ok(types.includes("fatal"));
    assert.ok(types.includes("gpu"));
    assert.ok(types.includes("exitcode"));
  });

  test("deduplicates by type (only first GPU match)", () => {
    const log = "GPU crash detected\nD3D device lost";
    const results = matchPatterns(log);
    const gpuResults = results.filter(r => r.type === "gpu");
    assert.strictEqual(gpuResults.length, 1);
  });

  test("returns empty for unrecognized text", () => {
    const results = matchPatterns("Everything is working fine");
    assert.strictEqual(results.length, 0);
  });
});

describe("escapeHtml", () => {
  test("escapes angle brackets", () => {
    assert.strictEqual(
      escapeHtml("<script>alert('xss')</script>"),
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  test("escapes ampersands", () => {
    assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
  });

  test("escapes quotes", () => {
    assert.strictEqual(escapeHtml('"hello"'), "&quot;hello&quot;");
  });

  test("returns empty string for falsy input", () => {
    assert.strictEqual(escapeHtml(null), "");
    assert.strictEqual(escapeHtml(undefined), "");
    assert.strictEqual(escapeHtml(""), "");
  });

  test("converts numbers to string", () => {
    assert.strictEqual(escapeHtml(42), "42");
  });
});
