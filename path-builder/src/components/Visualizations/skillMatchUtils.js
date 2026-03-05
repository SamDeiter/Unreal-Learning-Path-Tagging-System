/**
 * Shared skill category definitions and word-boundary-aware matching.
 *
 * Problem solved:
 * Short keywords like "ui", "bp", "gi", "hud" were matching as substrings
 * inside unrelated words (e.g. "build" contains "ui", "lighting" contains "gi").
 * This caused inflated course counts (429 courses matching "UI/UMG").
 *
 * Solution:
 * Keywords shorter than 4 characters use word-boundary regex (\b) matching.
 * Longer keywords use regular substring matching (safe from false positives).
 */

/**
 * Default skill categories for all analytics visualizations.
 * Used by InsightsPanel, SkillRadar, and SkillGapAnalysis.
 */
export const SKILL_CATEGORIES = [
  { name: "Blueprints", keywords: ["blueprint", "visual scripting", "node graph"] },
  { name: "Materials", keywords: ["material", "shader", "texture", "pbr", "substance"] },
  { name: "Niagara", keywords: ["niagara", "particle", "vfx", "effects", "cascade"] },
  { name: "Lighting", keywords: ["lighting", "lumen", "raytracing", "ray tracing", "shadow"] },
  { name: "Animation", keywords: ["animation", "skeletal", "rigging", "sequencer", "pose"] },
  { name: "UI/UMG", keywords: ["umg", "widget", "slate", "user interface", "common ui"] },
  { name: "Audio", keywords: ["audio", "sound", "metasound", "acoustic"] },
  {
    name: "Landscape",
    keywords: [
      "landscape",
      "terrain",
      "foliage",
      "world partition",
      "world composition",
      "open world",
      "landmass",
    ],
  },
];

// Pre-compile matchers (runs once at import time)
const categoryMatchers = new Map();

/**
 * Build matchers for a category's keywords.
 * Short keywords (< 4 chars) get word-boundary regex; longer ones use includes().
 */
function getMatchers(keywords) {
  const key = keywords.join("|");
  if (categoryMatchers.has(key)) return categoryMatchers.get(key);

  const matchers = keywords.map((kw) => {
    if (kw.length < 4) {
      // Short keyword — use word boundary to avoid substring false positives
      return { type: "regex", pattern: new RegExp(`\\b${kw}\\b`, "i"), keyword: kw };
    }
    return { type: "includes", keyword: kw.toLowerCase() };
  });

  categoryMatchers.set(key, matchers);
  return matchers;
}

/**
 * Check if a course matches any keyword in a skill category.
 * Uses word-boundary regex for short keywords.
 *
 * @param {Object} course - Course object with tags arrays
 * @param {string[]} keywords - Keywords to match against
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeTranscriptTags] - Include transcript_tags (default: false)
 * @param {boolean} [options.includeTagKeys] - Include Object.keys(course.tags) (default: false)
 * @param {Object} [options.keywordHits] - Optional object to accumulate per-keyword hit counts
 * @returns {boolean} Whether the course matches
 */
export function courseMatchesKeywords(course, keywords, options = {}) {
  const matchers = getMatchers(keywords);

  const allTags = [
    ...(course.gemini_system_tags || []),
    ...(course.ai_tags || []),
    ...(options.includeTranscriptTags ? course.transcript_tags || [] : []),
    ...(options.includeTagKeys ? Object.keys(course.tags || {}) : []),
    course.title || "",
  ].map((t) => t.toLowerCase());

  return matchers.some((m) => {
    let hit;
    if (m.type === "regex") {
      hit = allTags.some((tag) => m.pattern.test(tag));
    } else {
      hit = allTags.some((tag) => tag.includes(m.keyword));
    }
    if (hit && options.keywordHits) {
      options.keywordHits[m.keyword] = (options.keywordHits[m.keyword] || 0) + 1;
    }
    return hit;
  });
}
