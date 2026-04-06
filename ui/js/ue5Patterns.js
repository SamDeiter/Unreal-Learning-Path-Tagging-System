/* UE5 Learning Path Builder - Shared UE5 Error Patterns */

// Unified UE5 error patterns for crash log parsing
// Used by both app.js (parseCrashLog) and basket.js (addLogIngredient)
const UE5_ERROR_PATTERNS = [
  {
    pattern: /ExitCode[=:\s]*(\d+)/i,
    type: "exitcode",
    extract: (m) => `ExitCode ${m[1]}`,
  },
  {
    pattern: /Error[:\s]+([A-Z]+\d+)/i,
    type: "linker",
    extract: (m) => m[1],
  },
  {
    pattern: /ShaderCompileWorker/i,
    type: "shader",
    extract: () => "Shader compilation error",
  },
  {
    pattern: /D3D\s*device\s*lost/i,
    type: "gpu",
    extract: () => "D3D device lost",
  },
  { pattern: /GPU\s*crash/i, type: "gpu", extract: () => "GPU crash" },
  {
    pattern: /Accessed\s*None/i,
    type: "blueprint",
    extract: () => "Blueprint Accessed None",
  },
  {
    pattern: /cook\s*(fail|error)/i,
    type: "cook",
    extract: () => "Cook failure",
  },
  {
    pattern: /packaging\s*(fail|error)/i,
    type: "packaging",
    extract: () => "Packaging error",
  },
  { pattern: /Lumen/i, type: "lumen", extract: () => "Lumen issue" },
  { pattern: /Nanite/i, type: "nanite", extract: () => "Nanite issue" },
  {
    pattern: /replication|multiplayer|net/i,
    type: "network",
    extract: () => "Network/replication",
  },
  {
    pattern: /Fatal\s*error/i,
    type: "fatal",
    extract: () => "Fatal error",
  },
  {
    pattern: /LogCore:\s*Error/i,
    type: "core",
    extract: () => "Core error",
  },
  {
    pattern: /out\s*of\s*(memory|video\s*memory)/i,
    type: "memory",
    extract: () => "Out of memory",
  },
];

// Escape HTML to prevent XSS when inserting user/API content
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Export for Node.js native tests if running in that environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UE5_ERROR_PATTERNS, escapeHtml };
}
