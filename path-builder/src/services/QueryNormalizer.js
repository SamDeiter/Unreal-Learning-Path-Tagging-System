/**
 * QueryNormalizer — Deterministic query preprocessing for tag extraction.
 *
 * Pipeline:
 *   1. Lowercase
 *   2. Expand UE abbreviations (BP → blueprint, etc.)
 *   3. Split camelCase and snake_case
 *   4. Strip punctuation (preserve hyphens in compound words)
 *   5. Basic de-pluralization
 *   6. Detect negative intent ("not X", "without X")
 */

// ---- UE Abbreviation Dictionary ----
const UE_ABBREVIATIONS = new Map([
  ["bp", "blueprint"],
  ["bps", "blueprints"],
  ["gas", "gameplay ability system"],
  ["pcg", "procedural content generation"],
  ["gi", "global illumination"],
  ["lod", "level of detail"],
  ["hdr", "high dynamic range"],
  ["pbr", "physically based rendering"],
  ["vsm", "virtual shadow maps"],
  ["rt", "ray tracing"],
  ["hlod", "hierarchical level of detail"],
  ["wp", "world partition"],
  ["ik", "inverse kinematics"],
  ["fk", "forward kinematics"],
  ["dof", "depth of field"],
  ["vfx", "visual effects"],
  ["ai", "artificial intelligence"],
  ["hud", "heads up display"],
  ["umg", "unreal motion graphics"],
  ["cpp", "c++"],
  ["c++", "cpp"],
  ["ue5", "unreal engine 5"],
  ["ue4", "unreal engine 4"],
  ["rhi", "render hardware interface"],
  ["niagara", "niagara"],
  ["nanite", "nanite"],
  ["lumen", "lumen"],
  ["chaos", "chaos physics"],
  ["sequencer", "sequencer"],
  ["metahuman", "metahuman"],
  ["fab", "fab marketplace"],
  ["eqs", "environment query system"],
  ["abp", "animation blueprint"],
  ["tsr", "temporal super resolution"],
  ["pso", "pipeline state object"],
  ["rpc", "remote procedure call"],
  ["dlss", "deep learning super sampling"],
  ["fsr", "fidelity super resolution"],
  ["dmx", "lighting protocol"],
  ["ecs", "entity component system"],
  ["cas", "contrast adaptive sharpening"],
  ["ssgi", "screen space global illumination"],
  ["wpo", "world position offset"],
  ["mrq", "movie render queue"],
]);

// Words that should NOT be de-pluralized (safe-list exceptions)
const NO_DEPLURALIZE = new Set([
  "chaos",
  "physics",
  "atlas",
  "canvas",
  "alias",
  "diagnosis",
  "analysis",
  "basis",
  "class",
  "process",
  "pass",
  "grass",
  "address",
  "access",
  "progress",
  "mass",
  "less",
  "cross",
]);

// Negative intent patterns
const NEGATIVE_PATTERNS = [
  /\bnot\s+(\w+)/gi,
  /\bwithout\s+(\w+)/gi,
  /\bexclude\s+(\w+)/gi,
  /\bno\s+(\w+)/gi,
  /\bdon'?t\s+(?:want|need|use)\s+(\w+)/gi,
];

/**
 * Normalize a query string for tag matching.
 * @param {string} raw - Raw user query
 * @returns {{ normalized: string, expandedTerms: string[], negatedTerms: string[] }}
 */
export function normalizeQuery(raw) {
  if (!raw || typeof raw !== "string") {
    return { normalized: "", expandedTerms: [], negatedTerms: [] };
  }

  // 1. Detect negative intent BEFORE other transformations
  const negatedTerms = [];
  for (const pattern of NEGATIVE_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(raw)) !== null) {
      negatedTerms.push(match[1].toLowerCase());
    }
  }

  // 2. Lowercase
  let text = raw.toLowerCase();

  // 3. Expand abbreviations (whole word only)
  const expandedTerms = [];
  for (const [abbrev, expansion] of UE_ABBREVIATIONS) {
    const regex = new RegExp(`\\b${escapeRegex(abbrev)}\\b`, "gi");
    if (regex.test(text)) {
      expandedTerms.push(`${abbrev} → ${expansion}`);
      // Add expansion alongside original (don't replace, augment)
      text = text + " " + expansion;
    }
  }

  // 4. Split camelCase: "BlueprintCompiler" → "blueprint compiler"
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

  // 5. Split snake_case: "world_partition" → "world partition"
  text = text.replace(/_/g, " ");

  // 6. Strip punctuation but preserve meaningful chars
  //    Keep: alphanumeric, spaces, hyphens, periods (for version numbers), plus signs (c++)
  text = text.replace(/[^a-z0-9\s\-+.]/g, " ");

  // 7. Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return { normalized: text, expandedTerms, negatedTerms };
}

/**
 * Basic de-pluralization for a single word.
 * Conservative — only strips trailing "s"/"es" when safe.
 * @param {string} word
 * @returns {string}
 */
export function depluralize(word) {
  if (!word || word.length < 4) return word;
  if (NO_DEPLURALIZE.has(word)) return word;

  // "ies" → "y" (e.g., "queries" → "query")
  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }
  // "sses" → "ss" (e.g., "classes" is in safe-list, but "processes" etc.)
  if (word.endsWith("sses")) {
    return word.slice(0, -2);
  }
  // "xes", "shes", "ches" → drop "es"
  if (word.endsWith("xes") || word.endsWith("shes") || word.endsWith("ches")) {
    return word.slice(0, -2);
  }
  // Generic "es" after consonant
  if (word.endsWith("es") && !/[aeiou]/.test(word[word.length - 3])) {
    return word.slice(0, -2);
  }
  // Generic trailing "s" (not "ss")
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { UE_ABBREVIATIONS, NEGATIVE_PATTERNS };
