/**
 * demandIntelligenceService.js — Demand Intelligence Engine
 *
 * Aggregates demand signals from multiple sources to identify
 * what tutorials people are searching for and asking about.
 *
 * Three data layers (all with source provenance):
 *   Layer 1: Community Activity Index — granular subtopics via demand_benchmarks.json
 *   Layer 2: Community questions — batch grounded search (extends communityPainPoints)
 *   Layer 3: Gap-weighted ranking — cross-references against video library coverage
 *
 * Every data point carries clickable source attribution.
 *
 * Exports:
 *   - generateDemandReport()  — full demand analysis with sources
 *   - fetchTrendingQuestions() — trending questions from forums/Reddit/SO
 *   - scanAllCommunityPainPoints() — batch pain point scan across all topics
 *   - getDemandSuggestions()  — ranked course suggestions (demand × sources - coverage)
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { searchCommunityPainPoints } from "./communityPainPoints";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";
import { parseGeminiJSON } from "./gapDetection";
import demandBenchmarks from "../data/demand_benchmarks.json";

// ── Configuration ──────────────────────────────────────────

const TRENDING_QUESTION_LIMIT = 15;
const BATCH_CONCURRENCY = 3;          // Parallel AI calls at once
const CACHE_TTL_MS = 30 * 60 * 1000;  // 30-minute cache for demand reports
const STORAGE_KEY = "demandIntel_report";

// ── Persistent + in-memory report cache ───────────────────

let _cachedReport = null;
let _cachedAt = 0;

/**
 * Try to load a cached report from localStorage.
 * Populates the in-memory cache if found and still fresh.
 */
function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { report, cachedAt } = JSON.parse(raw);
    if (report && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      _cachedReport = report;
      _cachedAt = cachedAt;
      devLog("[DemandIntel] Loaded cached report from localStorage");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable or corrupt — ignore
  }
}

/**
 * Persist the current report to localStorage.
 */
function _saveToStorage(report) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ report, cachedAt: Date.now() })
    );
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

// Bootstrap: try to restore from localStorage on module load
_loadFromStorage();

// ── Source Type Constants ──────────────────────────────────

export const SOURCE_TYPES = {
  REDDIT: "reddit",
  EPIC_FORUM: "epic_forum",
  STACKOVERFLOW: "stackoverflow",
  COMMUNITY_INDEX: "community_index",
  YOUTUBE_COMMENTS: "youtube_comments",
  EPIC_DEV_COMMUNITY: "epic_dev_community",
};

// ── Granular Subtopic Taxonomy ─────────────────────────────
// Maps broad categories to specific subtopics for granular analysis

export const GRANULAR_TAXONOMY = {
  "Blueprints": [
    "Blueprint Interfaces", "Event Dispatchers", "Blueprint Macros",
    "Data Tables", "Enumerations", "Structures", "Blueprint Communication",
    "Blueprint Debugging", "Construction Scripts", "Function Libraries"
  ],
  "AI": [
    "State Trees", "Behavior Trees", "NavMesh", "AI Perception",
    "EQS (Environment Query)", "Blackboard", "AI Controllers",
    "Mass Entity", "Smart Objects", "Crowd Simulation"
  ],
  "Materials": [
    "Material Instances", "Shader Complexity", "Substrate (Strata)",
    "Material Functions", "Texture Streaming", "PBR Workflows",
    "Decals", "Post Process Materials", "Landscape Materials"
  ],
  "Niagara": [
    "Niagara Emitters", "Niagara Modules", "GPU Simulation",
    "Niagara Fluids", "Mesh Particles", "Ribbon Renderers",
    "Data Interfaces", "Niagara Debugging"
  ],
  "Animation": [
    "Animation Blueprints", "Control Rig", "IK (Inverse Kinematics)",
    "Retargeting", "Sequencer Cinematics", "Motion Matching",
    "Blend Spaces", "Montages", "Pose Search", "Skeletal Mesh LODs"
  ],
  "Lighting": [
    "Lumen Global Illumination", "Ray Tracing", "Light Baking",
    "Volumetric Fog", "Sky Atmosphere", "HDRI Lighting",
    "Light Functions", "IES Profiles", "Virtual Shadow Maps"
  ],
  "UI/UMG": [
    "Common UI Plugin", "Slate C++ Widgets", "Widget Blueprints",
    "UMG Animations", "Data Binding", "Input Routing",
    "HUD Rendering", "Rich Text", "Localization"
  ],
  "Audio": [
    "MetaSounds", "Sound Cues", "Audio Attenuation",
    "Spatial Audio", "Sound Classes", "Audio Modulation",
    "Quartz Clock", "Audio Analysis"
  ],
  "Landscape": [
    "World Partition", "Level Streaming", "Foliage System",
    "Procedural Generation (PCG)", "Water System", "Landmass Plugin",
    "Terrain Sculpting", "Biome Painting"
  ],
  "Networking": [
    "Replication", "RPCs", "Dedicated Servers",
    "Session Management", "Prediction", "Relevancy"
  ],
  "C++": [
    "Gameplay Framework", "UPROPERTY/UFUNCTION Macros", "Delegates",
    "Subsystems", "Plugins", "Build System", "Hot Reload"
  ],
  "Physics": [
    "Chaos Physics", "Ragdoll", "Destruction",
    "Constraints", "Physical Materials", "Vehicles"
  ],
  "Rendering": [
    "Nanite", "Virtual Shadow Maps", "TSR (Temporal Super Resolution)",
    "Screen Space Reflections", "Mesh Distance Fields",
    "Hardware Ray Tracing", "Lumen Reflections"
  ]
};

// ── Layer 1: Demand Benchmarks (granular) ──────────────────

/**
 * Load demand benchmarks with granular subtopic scores.
 * Falls back to the broad category score for subtopics not in the file.
 *
 * @returns {Object} { category → { overall, subtopics: { name → score } } }
 */
export function loadGranularDemand() {
  const result = {};
  const benchmarks = demandBenchmarks.benchmarks || {};
  const subtopicData = demandBenchmarks.subtopics || {};

  for (const [category, subtopics] of Object.entries(GRANULAR_TAXONOMY)) {
    const overallScore = benchmarks[category] ?? 50;
    const fileSubtopics = subtopicData[category] || {};

    result[category] = {
      overall: overallScore,
      subtopics: {},
    };

    for (const subtopic of subtopics) {
      // Use file data if available, otherwise estimate from overall
      result[category].subtopics[subtopic] = fileSubtopics[subtopic] ?? overallScore;
    }
  }

  return result;
}

// ── Layer 2: Trending Questions (grounded search) ──────────

/**
 * Fetch trending UE5 questions from community sites via Gemini grounded search.
 * Returns source-attributed results with clickable URLs.
 *
 * @param {Object} [options]
 * @param {string} [options.category] — Limit to a specific category (e.g., "AI")
 * @param {number} [options.limit] — Max questions to return (default 15)
 * @returns {Promise<Array<{question, sources: Array<{type, url, title, date, engagement}>}>>}
 */
export async function fetchTrendingQuestions({ category = null, limit = TRENDING_QUESTION_LIMIT } = {}) {
  try {
    const categoryFilter = category
      ? `Focus specifically on "${category}" topics within Unreal Engine 5.`
      : "Cover ALL major Unreal Engine 5 topic areas.";

    const prompt = `Search for the most commonly asked questions about Unreal Engine 5 that learners are posting RIGHT NOW.

SEARCH THESE SOURCES (in priority order):
1. Reddit r/unrealengine — recent posts with high engagement
2. forums.unrealengine.com — Epic's official forums
3. stackoverflow.com [unreal-engine5] tag — recent questions
4. Epic Developer Community — dev.epicgames.com discussions
5. YouTube comments on popular UE5 tutorials

${categoryFilter}

Return a JSON array of the top ${limit} trending questions. For EACH question, include the ACTUAL source URL where you found it:

[{
  "question": "The exact question people are asking",
  "category": "Which UE5 system this relates to (e.g., AI, Blueprints, Materials)",
  "subtopic": "Specific subtopic (e.g., State Trees, NavMesh, Event Dispatchers)",
  "frequency": "high" or "medium" or "low",
  "sources": [{
    "type": "reddit" or "epic_forum" or "stackoverflow" or "youtube",
    "title": "Title of the post/thread",
    "date": "Approximate date (YYYY-MM-DD if known)",
    "engagement": "Number of upvotes, comments, or views if available"
  }]
}]

RULES:
- Return REAL questions from REAL posts — do not fabricate
- Include the post/thread title so we can verify
- Prioritize questions with high engagement (upvotes, comments, views)
- Focus on learning/tutorial questions, not bug reports
- Return valid JSON only, no markdown fences`;

    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(
      () => classifyFn({ prompt, grounded: true }),
      { maxRetries: 1, baseDelayMs: 2000, label: "trendingQuestions" }
    );

    const responseText = result.data?.text || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    recordTokenUsage(
      "trendingQuestions",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (!parsed || !Array.isArray(parsed)) {
      devWarn("[DemandIntel] Failed to parse trending questions response");
      return [];
    }

    // Enrich with grounding source URLs from Gemini's metadata
    const groundingSources = groundingMetadata?.sources || [];

    const questions = parsed.slice(0, limit).map((q, idx) => {
      const enrichedSources = (q.sources || []).map((src, srcIdx) => {
        // Try to match grounding URLs to our sources
        const groundingUrl = groundingSources[idx * 2 + srcIdx]?.url || "";
        return {
          type: src.type || "unknown",
          url: groundingUrl || src.url || "",
          title: src.title || "",
          date: src.date || "",
          engagement: src.engagement || "",
        };
      });

      return {
        question: q.question || "",
        category: q.category || "General",
        subtopic: q.subtopic || "",
        frequency: q.frequency || "medium",
        sources: enrichedSources,
      };
    });

    devLog(`[DemandIntel] Found ${questions.length} trending questions`);
    return questions;
  } catch (err) {
    devWarn("[DemandIntel] fetchTrendingQuestions failed:", err.message);
    return [];
  }
}

// ── Layer 2b: Batch Community Pain Points ──────────────────

/**
 * Scan ALL major UE5 topic categories for community pain points.
 * Runs in batches to avoid rate limits on the AI backend.
 *
 * @returns {Promise<Object>} { category → painPoints[] }
 */
export async function scanAllCommunityPainPoints() {
  const categories = Object.keys(GRANULAR_TAXONOMY);
  const results = {};

  // Process in batches to avoid overwhelming the AI backend
  for (let i = 0; i < categories.length; i += BATCH_CONCURRENCY) {
    const batch = categories.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((cat) => searchCommunityPainPoints(cat))
    );

    batch.forEach((cat, idx) => {
      const result = batchResults[idx];
      results[cat] = result.status === "fulfilled" ? result.value : [];
    });

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_CONCURRENCY < categories.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  devLog(`[DemandIntel] Scanned ${categories.length} categories for pain points`);
  return results;
}

// ── Layer 3: Coverage Analysis ─────────────────────────────

/**
 * Calculate coverage percentage for each subtopic against the video library.
 *
 * @param {Array} courses — Course objects from TagDataContext
 * @returns {Object} { category → { subtopic → { coverage, courseCount } } }
 */
export function calculateGranularCoverage(courses) {
  if (!courses?.length) return {};

  const coverage = {};

  for (const [category, subtopics] of Object.entries(GRANULAR_TAXONOMY)) {
    coverage[category] = {};

    for (const subtopic of subtopics) {
      // Build keyword list from subtopic name
      const keywords = subtopic
        .toLowerCase()
        .replace(/[()]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      let matchCount = 0;
      for (const course of courses) {
        const allTags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || []),
          ...(course.transcript_tags || []),
          ...Object.values(course.tags || {}).filter((v) => typeof v === "string"),
          course.title || "",
        ].map((t) => t.toLowerCase());

        const tagText = allTags.join(" ");

        // For multi-word subtopics, require ALL keywords to match (prevents
        // "world" alone from matching 122 courses for "World Partition")
        const matched =
          keywords.length > 1
            ? keywords.every((kw) => tagText.includes(kw))
            : keywords.some((kw) => tagText.includes(kw));
        if (matched) matchCount++;
      }

      // Threshold-based coverage: 15+ courses on a subtopic = 100% coverage.
      // This is more meaningful than dividing by total library size.
      const FULL_COVERAGE_THRESHOLD = 15;
      const coveragePct = matchCount === 0
        ? 0
        : Math.min(100, Math.round((matchCount / FULL_COVERAGE_THRESHOLD) * 100));
      coverage[category][subtopic] = {
        coverage: coveragePct,
        courseCount: matchCount,
      };
    }
  }

  return coverage;
}

// ── Main Report Generator ──────────────────────────────────

/**
 * Generate a full demand intelligence report with source provenance.
 *
 * @param {Array} courses — Video library courses (for coverage analysis)
 * @param {Object} [options]
 * @param {boolean} [options.skipCache] — Force fresh data (default: false)
 * @returns {Promise<Object>} Full demand report
 */
export async function generateDemandReport(courses = [], { skipCache = false } = {}) {
  // Check cache
  if (!skipCache && _cachedReport && Date.now() - _cachedAt < CACHE_TTL_MS) {
    devLog("[DemandIntel] Returning cached report");
    return _cachedReport;
  }

  devLog("[DemandIntel] Generating fresh demand report...");
  const startTime = Date.now();

  // Layer 1: Granular demand benchmarks (instant — local data)
  const demandData = loadGranularDemand();

  // Layer 2a + 2b: Trending questions + community pain points (parallel AI calls)
  const [trendingResult, painPointsResult] = await Promise.allSettled([
    fetchTrendingQuestions(),
    scanAllCommunityPainPoints(),
  ]);

  const trendingQuestions =
    trendingResult.status === "fulfilled" ? trendingResult.value : [];
  const painPointsByCategory =
    painPointsResult.status === "fulfilled" ? painPointsResult.value : {};

  // Layer 3: Coverage analysis (instant — local computation)
  const coverageData = calculateGranularCoverage(courses);

  // ── Build ranked suggestions ─────────────────────────────
  const suggestions = [];

  for (const [category, data] of Object.entries(demandData)) {
    for (const [subtopic, demandScore] of Object.entries(data.subtopics)) {
      const coverageInfo = coverageData[category]?.[subtopic] || {
        coverage: 0,
        courseCount: 0,
      };
      const gap = demandScore - coverageInfo.coverage;

      // Collect all sources mentioning this subtopic
      const sources = [];

      // Community Activity Index source
      sources.push({
        type: SOURCE_TYPES.COMMUNITY_INDEX,
        url: "",
        title: `Community Activity Index: "${subtopic}"`,
        interestScore: demandScore,
        trend: demandScore > (data.overall || 50) ? "rising" : "stable",
      });

      // Trending question sources
      const relatedQuestions = trendingQuestions.filter(
        (q) =>
          q.category?.toLowerCase() === category.toLowerCase() ||
          q.subtopic?.toLowerCase().includes(subtopic.toLowerCase()) ||
          subtopic.toLowerCase().includes(q.subtopic?.toLowerCase() || "___")
      );
      for (const q of relatedQuestions) {
        for (const src of q.sources || []) {
          sources.push({ ...src, relatedQuestion: q.question });
        }
      }

      // Pain point sources
      const categoryPainPoints = painPointsByCategory[category] || [];
      const relatedPainPoints = categoryPainPoints.filter((pp) =>
        pp.painPoint?.toLowerCase().includes(subtopic.split(" ")[0].toLowerCase())
      );
      for (const pp of relatedPainPoints) {
        sources.push({
          type: pp.sourceUrl?.includes("reddit") ? SOURCE_TYPES.REDDIT :
                pp.sourceUrl?.includes("forum") ? SOURCE_TYPES.EPIC_FORUM :
                SOURCE_TYPES.EPIC_DEV_COMMUNITY,
          url: pp.sourceUrl || "",
          title: pp.sourceTitle || pp.painPoint || "",
          painPoint: pp.painPoint,
        });
      }

      // Confidence based on source count — only count sources with actual URLs
      const verifiedSourceCount = sources.filter((s) => s.type !== SOURCE_TYPES.COMMUNITY_INDEX && s.url).length;
      const confidence =
        verifiedSourceCount >= 3 ? "high" : verifiedSourceCount >= 1 ? "medium" : "low";

      if (gap > 0 || sources.length > 0) {
        suggestions.push({
          topic: subtopic,
          category,
          demandScore,
          coverageInLibrary: coverageInfo.coverage,
          courseCount: coverageInfo.courseCount,
          gap: Math.max(0, gap),
          confidence,
          sourceCount: sources.length,
          // Composite ranking: (demand × verified sources) - coverage
          rankScore: (demandScore * Math.max(1, verifiedSourceCount + 1)) - coverageInfo.coverage,
          sources,
          existingContent: [], // TODO: populate with matching video library entries
        });
      }
    }
  }

  // Sort by composite rank score (highest opportunity first)
  suggestions.sort((a, b) => b.rankScore - a.rankScore);

  const report = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    provenance: {
      communityIndex: {
        version: demandBenchmarks.version || "unknown",
        source: demandBenchmarks.source || "manual",
        methodology: demandBenchmarks.methodology || "",
        subtopicCount: Object.values(GRANULAR_TAXONOMY).flat().length,
      },
      communitySearch: {
        categoriesScanned: Object.keys(painPointsByCategory).length,
        totalPainPoints: Object.values(painPointsByCategory).flat().length,
        method: "Gemini Grounded Search",
      },
      trendingQuestions: {
        count: trendingQuestions.length,
        method: "Gemini Grounded Search",
      },
      libraryCoverage: {
        totalCourses: courses.length,
        categoriesAnalyzed: Object.keys(coverageData).length,
      },
    },
    // Top-level ranked suggestions (what to build next)
    suggestions: suggestions.slice(0, 30),
    // Trending questions with source links
    trendingQuestions,
    // Pain points grouped by category
    painPointsByCategory,
    // Raw demand data for chart rendering
    demandData,
    // Raw coverage data for chart rendering
    coverageData,
  };

  // Cache the report (in-memory + persistent)
  _cachedReport = report;
  _cachedAt = Date.now();
  _saveToStorage(report);

  devLog(
    `[DemandIntel] Report complete: ${suggestions.length} suggestions, ` +
    `${trendingQuestions.length} trending, ${Object.values(painPointsByCategory).flat().length} pain points ` +
    `(${Date.now() - startTime}ms)`
  );

  return report;
}

/**
 * Get just the top N course suggestions (lightweight — uses cached report).
 *
 * @param {Array} courses — Video library courses
 * @param {number} [topN] — Number of suggestions (default 10)
 * @returns {Promise<Array>} Ranked suggestion objects
 */
export async function getDemandSuggestions(courses = [], topN = 10) {
  const report = await generateDemandReport(courses);
  return report.suggestions.slice(0, topN);
}

/**
 * Return the in-memory cached report synchronously (or null if stale/empty).
 * This lets React hooks seed their initial state without an async call,
 * preventing a loading-spinner flash when the data is already available.
 */
export function getCachedReport() {
  if (_cachedReport && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cachedReport;
  }
  return null;
}

/**
 * Force-clear the report cache (e.g., when user clicks Refresh).
 */
export function clearDemandCache() {
  _cachedReport = null;
  _cachedAt = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  devLog("[DemandIntel] Cache cleared (memory + localStorage)");
}

export default {
  generateDemandReport,
  fetchTrendingQuestions,
  scanAllCommunityPainPoints,
  getDemandSuggestions,
  loadGranularDemand,
  calculateGranularCoverage,
  clearDemandCache,
  GRANULAR_TAXONOMY,
  SOURCE_TYPES,
};
