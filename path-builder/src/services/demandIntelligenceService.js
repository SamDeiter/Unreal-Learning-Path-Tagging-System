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
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { searchCommunityPainPoints } from "./communityPainPoints";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";
import { parseGeminiJSON } from "./gapDetection";
import { computeDecayRisk, computeDemandIndex } from "../utils/decayDetector";
import demandBenchmarksUE5 from "../data/demand_benchmarks.json";
import demandBenchmarksUEFN from "../data/demand_benchmarks_uefn.json";
import seoMetricsData from "../data/seoMetrics.json";

// ── Configuration ──────────────────────────────────────────

const TRENDING_QUESTION_LIMIT = 15;
const BATCH_CONCURRENCY = 3;          // Parallel AI calls at once
const CACHE_TTL_MS = 30 * 60 * 1000;  // 30-minute cache for demand reports

const getStorageKey = (engine) => engine === "UEFN" ? "demandIntel_report_uefn" : "demandIntel_report";
const getFirestoreCollection = (engine) => engine === "UEFN" ? "demand_intel_uefn" : "demand_intel";
const FIRESTORE_DOC_ID = "latest";

// ── Persistent + in-memory report cache ───────────────────

const _cachedReports = { UE5: null, UEFN: null };
const _cachedAt = { UE5: 0, UEFN: 0 };

/**
 * Try to load a cached report from localStorage for a specific engine.
 * Populates the in-memory cache if found and still fresh.
 */
function _loadFromStorage(engine = "UE5") {
  try {
    const raw = localStorage.getItem(getStorageKey(engine));
    if (!raw) return;
    const { report, cachedAt } = JSON.parse(raw);
    if (report && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
      _cachedReports[engine] = report;
      _cachedAt[engine] = cachedAt;
      devLog(`[DemandIntel] Loaded cached report for ${engine} from localStorage`);
    } else {
      localStorage.removeItem(getStorageKey(engine));
    }
  } catch {
    // localStorage unavailable or corrupt — ignore
  }
}

/**
 * Persist the current report to localStorage for a specific engine.
 */
function _saveToStorage(report, engine = "UE5") {
  try {
    localStorage.setItem(
      getStorageKey(engine),
      JSON.stringify({ report, cachedAt: Date.now() })
    );
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

// Bootstrap: try to restore from localStorage on module load
_loadFromStorage("UE5");
_loadFromStorage("UEFN");

// ── Source Type Constants ──────────────────────────────────

export const SOURCE_TYPES = {
  REDDIT: "reddit",
  EPIC_FORUM: "epic_forum",
  STACKOVERFLOW: "stackoverflow",
  COMMUNITY_INDEX: "community_index",
  YOUTUBE_COMMENTS: "youtube_comments",
  EPIC_DEV_COMMUNITY: "epic_dev_community",
  GOOGLE_TRENDS: "google_trends",
};

// ── Granular Subtopic Taxonomy ─────────────────────────────
// Maps broad categories to specific subtopics for granular analysis

export const GRANULAR_TAXONOMY = {
  "Blueprints": [
    "Blueprint Interfaces", "Event Dispatchers", "Blueprint Macros",
    "Data Tables", "Enumerations", "Structures", "Blueprint Communication",
    "Blueprint Debugging", "Construction Scripts", "Function Libraries",
    "Actor Components", "Gameplay Ability System (GAS)"
  ],
  "AI": [
    "State Trees", "Behavior Trees", "NavMesh", "AI Perception",
    "EQS (Environment Query)", "Blackboard", "AI Controllers",
    "Mass Entity", "Smart Objects", "Crowd Simulation",
    "MassAI", "Goal Oriented Action Planning"
  ],
  "Materials": [
    "Material Instances", "Shader Complexity", "Substrate (Strata)",
    "Material Functions", "Texture Streaming", "PBR Workflows",
    "Decals", "Post Process Materials", "Landscape Materials",
    "Material Layers", "Shader Permutations"
  ],
  "Niagara": [
    "Niagara Emitters", "Niagara Modules", "GPU Simulation",
    "Niagara Fluids", "Mesh Particles", "Ribbon Renderers",
    "Data Interfaces", "Niagara Debugging",
    "Simulation Stages", "Niagara Fluids 2.0"
  ],
  "Animation": [
    "Animation Blueprints", "Control Rig", "IK (Inverse Kinematics)",
    "Retargeting", "Sequencer Cinematics", "Motion Matching",
    "Blend Spaces", "Montages", "Pose Search", "Skeletal Mesh LODs",
    "MetaHuman Animator", "Layered Animation"
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
    "Terrain Sculpting", "Biome Painting",
    "Nanite Foliage"
  ],
  "Networking": [
    "Replication", "RPCs", "Dedicated Servers",
    "Session Management", "Prediction", "Relevancy"
  ],
  "C++": [
    "Gameplay Framework", "UPROPERTY/UFUNCTION Macros", "Delegates",
    "Subsystems", "Plugins", "Build System", "Hot Reload",
    "Gameplay Ability System (GAS)", "Unreal Header Tool"
  ],
  "Physics": [
    "Chaos Physics", "Ragdoll", "Destruction",
    "Constraints", "Physical Materials", "Vehicles"
  ],
  "Rendering": [
    "Nanite", "Virtual Shadow Maps", "TSR (Temporal Super Resolution)",
    "Screen Space Reflections", "Mesh Distance Fields",
    "Hardware Ray Tracing", "Lumen Reflections",
    "Path Tracing", "MegaLights"
  ],
  "MetaHumans": [
    "MetaHuman Creator", "Facial Animation", "Body Customization",
    "Hair and Groom", "Clothing Simulation", "MetaHuman Animator",
    "Performance Capture", "MetaHuman Blueprint Integration",
    "LOD and Scalability", "MetaHuman on FAB"
  ],
  "Optimization": [
    "Profiling Tools (Unreal Insights)", "Draw Call Reduction",
    "LOD Management", "Texture Optimization", "GPU Profiling",
    "CPU Threading", "Memory Management", "Shader Compilation",
    "Asset Streaming", "Cook and Package Size"
  ],
  "Virtual Production": [
    "nDisplay", "LED Wall Workflow", "Live Link",
    "Camera Tracking", "Color Calibration", "Multi-User Editing",
    "Composure Compositing", "Stage Operator", "Media Framework"
  ],
  "Level Design": [
    "BSP and Geometry", "Blockout Workflows", "Level Instances",
    "Data Layers", "Gameplay Scripting", "Level Blueprints",
    "Environment Art Pipeline", "Collision Setup", "Navigation Volumes"
  ],
  "Gameplay Framework": [
    "GameMode and GameState", "PlayerController", "Pawn vs Character",
    "GameInstance", "Enhanced Input System", "Gameplay Tags",
    "Save Game System", "Subsystems Architecture", "Actor Lifecycle"
  ]
};

// ── Secondary Taxonomy (UEFN) ──────────────────────────────
export const UEFN_GRANULAR_TAXONOMY = {
  "Verse Programming": [
    "Verse Syntax", "Concurrency (spawn/sync/race)", "Verse Classes & Devices",
    "Arrays and Maps", "Failure Contexts", "Custom Events",
    "UI with Verse (Verse UI)", "NPC Behaviors in Verse"
  ],
  "UEFN Devices": [
    "Sequencer Device", "HUD Message Device", "Item Granter",
    "Cinematic Sequence Device", "Map Indicator", "Tracker Device",
    "End Game Device", "Player Spawners", "Trigger Volumes"
  ],
  "Island Settings": [
    "Game Rules", "Matchmaking Settings", "Time of Day (Verse)",
    "Post Process Volumes", "Storm Controller", "Audio Player",
    "Environment Lighting"
  ],
  "Asset Management": [
    "Importing Custom Models", "Material Translation", "FAB Marketplace integration",
    "Collision on Custom Assets", "Texture Optimization for Switch/Mobile",
    "Size Limitations (Memory Calculation)"
  ],
  "Level Design / Creative": [
    "Prefabs", "Landscape Modifiers (UEFN)", "Foliage Painting in UEFN",
    "Building Grids", "Creative 2.0 Edit Sessions", "Live Edit Workflow"
  ],
  "MetaHumans & Animation": [
    "MetaHumans in UEFN", "Custom Skeletons", "Animation Retargeting",
    "Control Rig in UEFN", "Sequencer Cinematics"
  ],
  "Revision Control": [
    "Unreal Revision Control (URC)", "Snapshot management", "Team Collaboration",
    "Conflict Resolution", "Project Publishing"
  ]
};

const getTaxonomy = (engine) => engine === "UEFN" ? UEFN_GRANULAR_TAXONOMY : GRANULAR_TAXONOMY;

// ── Layer 1: Demand Benchmarks (granular) ──────────────────

/**
 * Load demand benchmarks with granular subtopic scores.
 * Falls back to the broad category score for subtopics not in the file.
 *
 * @returns {Object} { category → { overall, subtopics: { name → score } } }
 */
export function loadGranularDemand(engine = "UE5") {
  const result = {};
  const benchmarksData = engine === "UEFN" ? demandBenchmarksUEFN : demandBenchmarksUE5;
  const benchmarks = benchmarksData.benchmarks || {};
  const subtopicData = benchmarksData.subtopics || {};
  const taxonomy = getTaxonomy(engine);

  for (const [category, subtopics] of Object.entries(taxonomy)) {
    // For UEFN, we either pull from benchmarks or default to a solid baseline of 60 if not tracking it fully yet
    const defaultScore = engine === "UEFN" ? 60 : 50; 
    const overallScore = benchmarks[category] ?? defaultScore;
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
export async function fetchTrendingQuestions({ category = null, limit = TRENDING_QUESTION_LIMIT, engine = "UE5" } = {}) {
  try {
    const engineContext = engine === "UEFN" ? "Unreal Editor for Fortnite (UEFN) and Verse programming" : "Unreal Engine 5";
    const categoryFilter = category
      ? `Focus specifically on "${category}" topics within ${engineContext}.`
      : `Cover ALL major ${engineContext} topic areas.`;

    const prompt = `Search for the most commonly asked questions about ${engineContext} that learners are posting RIGHT NOW.

SEARCH THESE SOURCES (in priority order):
1. Reddit r/unrealengine — recent posts with high engagement
2. forums.unrealengine.com — Epic's official forums
3. stackoverflow.com [unreal-engine5] tag — recent questions
4. Epic Developer Community — dev.epicgames.com discussions
5. YouTube comments on popular UE5 tutorials

${categoryFilter}

Return a JSON array of the top ${limit} trending questions. Each question must be attributed to exactly ONE primary source — the platform where you found the strongest signal for that specific question:

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
- CRITICAL: Each question gets exactly ONE source entry — its PRIMARY platform
- Do NOT list the same question under multiple platforms
- Distribute questions across platforms — aim for a mix of reddit, epic_forum, youtube sources
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
export async function scanAllCommunityPainPoints(engine = "UE5") {
  const taxonomy = getTaxonomy(engine);
  const categories = Object.keys(taxonomy);
  const results = {};

  // Process in batches to avoid overwhelming the AI backend
  for (let i = 0; i < categories.length; i += BATCH_CONCURRENCY) {
    const batch = categories.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((cat) => searchCommunityPainPoints(cat, engine))
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
 * @param {string} engine — The engine to calculate coverage against
 * @returns {Object} { category → { subtopic → { coverage, courseCount } } }
 */
export function calculateGranularCoverage(courses, engine = "UE5") {
  if (!courses?.length) return {};

  const coverage = {};
  const taxonomy = getTaxonomy(engine);

  for (const [category, subtopics] of Object.entries(taxonomy)) {
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

// ── Firestore Pre-computed Data ────────────────────────────

/**
 * Try to load the pre-computed demand report from Firestore.
 * The GitHub Action (scrape-demand-intel) writes to demand_intel/latest.
 *
 * @returns {Promise<Object|null>} The pre-computed report or null
 */
export async function loadFromFirestore(engine = "UE5") {
  try {
    const app = getFirebaseApp();
    if (!app) return null;

    const db = getFirestore(app);
    const docRef = doc(db, getFirestoreCollection(engine), FIRESTORE_DOC_ID);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      devLog("[DemandIntel] No pre-computed report in Firestore");
      return null;
    }

    const report = snapshot.data();
    devLog(
      `[DemandIntel] Loaded pre-computed report from Firestore ` +
      `(scraped: ${report.generatedAt}, by: ${report.scrapedBy || "unknown"})`
    );
    return report;
  } catch (err) {
    devWarn("[DemandIntel] Firestore read failed, falling back to live:", err.message);
    return null;
  }
}

// ── Main Report Generator ──────────────────────────────────

/**
 * Generate a full demand intelligence report with source provenance.
 *
 * Strategy: Firestore-first → localStorage cache → live AI scraping
 *   1. Try pre-computed data from Firestore (instant, written by GitHub Action)
 *   2. Fall back to localStorage cache (instant, 30-min TTL)
 *   3. Fall back to live AI scraping (30-60s, original method)
 *
 * @param {Array} courses — Video library courses (for coverage analysis)
 * @param {Object} [options]
 * @param {boolean} [options.skipCache] — Force fresh data (default: false)
 * @param {boolean} [options.skipFirestore] — Skip Firestore, force live scraping (default: false)
 * @returns {Promise<Object>} Full demand report
 */
export async function generateDemandReport(courses = [], { skipCache = false, skipFirestore = false, firestoreOnly = false, engine = "UE5" } = {}) {
  // Check in-memory / localStorage cache
  if (!skipCache && _cachedReports[engine] && Date.now() - _cachedAt[engine] < CACHE_TTL_MS) {
    devLog(`[DemandIntel:${engine}] Returning cached report`);
    const cReport = _cachedReports[engine];
    // ALWAYS inject fresh SEO metrics from local bundle into cache
    if (cReport && cReport.suggestions) {
      cReport.suggestions.forEach(suggestion => {
        const seoData = seoMetricsData[suggestion.topic] || { msv: 0, kd: 0 };
        suggestion.seoMetrics = { msv: seoData.msv, kd: seoData.kd };
      });
    }
    return cReport;
  }

  // ── Try Firestore first (pre-computed by GitHub Action) ──
  if (!skipFirestore) {
    try {
      const firestoreReport = await loadFromFirestore(engine);
      if (firestoreReport && firestoreReport.suggestions?.length > 0) {
        // Quality check: if the Firestore report has no community intelligence
        // data (trending questions, pain points, Reddit engagement), it's an
        // incomplete scraper run and we should fall through to live scraping
        // to fill in the missing platform signals.
        const hasTrending = (firestoreReport.trendingQuestions || []).length > 0;
        const hasPainPoints = Object.values(firestoreReport.painPointsByCategory || {}).flat().length > 0;
        const hasReddit = firestoreReport.suggestions.some(s => s.redditEngagement);
        const hasMultiPlatformSources = firestoreReport.suggestions.some(s =>
          (s.sources || []).some(src => src.type && src.type !== "community_index")
        );

        if (hasTrending || hasPainPoints || hasReddit || hasMultiPlatformSources) {
          // ALWAYS inject fresh SEO metrics from local bundle into Firestore report
          // (Frontend seoMetrics.json is more authoritative than server-stored values)
          if (firestoreReport.suggestions) {
            firestoreReport.suggestions.forEach(suggestion => {
              const seoData = seoMetricsData[suggestion.topic] || { msv: 0, kd: 0 };
              suggestion.seoMetrics = { msv: seoData.msv, kd: seoData.kd };
            });
          }
          
          firestoreReport._source = "firestore";
          _cachedReports[engine] = firestoreReport;
          _cachedAt[engine] = Date.now();
          _saveToStorage(firestoreReport, engine);
          devLog(`[DemandIntel:${engine}] Using pre-computed Firestore report (instant!)`);
          return firestoreReport;
        } else {
          devLog(`[DemandIntel:${engine}] Firestore report lacks community data (0 trending, 0 pain points, 0 Reddit) — falling through to live scrape`);
        }
      }
    } catch (err) {
      devWarn("[DemandIntel] Firestore attempt failed:", err.message);
    }
  }

  // If firestoreOnly mode, don't fall through to expensive live scraping
  if (firestoreOnly) {
    devLog(`[DemandIntel:${engine}] firestoreOnly mode — skipping live scrape`);
    return null;
  }

  devLog(`[DemandIntel:${engine}] Generating fresh demand report (live scraping)...`);
  const startTime = Date.now();

  // Layer 1: Granular demand benchmarks (instant — local data)
  const demandData = loadGranularDemand(engine);

  // Layer 2a + 2b: Trending questions + community pain points (parallel AI calls)
  const [trendingResult, painPointsResult] = await Promise.allSettled([
    fetchTrendingQuestions({ engine }),
    scanAllCommunityPainPoints(engine),
  ]);

  const trendingQuestions =
    trendingResult.status === "fulfilled" ? trendingResult.value : [];
  const painPointsByCategory =
    painPointsResult.status === "fulfilled" ? painPointsResult.value : {};

  // Layer 3: Coverage analysis (instant — local computation)
  const coverageData = calculateGranularCoverage(courses, engine);

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

      // REAL SEO DATA (via DataForSEO pipeline)
      // Note: Data is pre-fetched via scripts/pull_dataforseo.js and stored in seoMetrics.json
      const seoData = seoMetricsData[subtopic] || { msv: 0, kd: 0 };
      const seoMetrics = { msv: seoData.msv, kd: seoData.kd };

      if (gap > 0 || sources.length > 0) {
        // Compute decay risk based on UE5 breaking changes
        const decay = computeDecayRisk(category, subtopic, sources);

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
          decayRisk: decay.risk,
          decayReason: decay.reason,
          decayVersion: decay.breakingVersion,
          seoMetrics, // Phase 4.1
          sources,
          existingContent: [], // TODO: populate with matching video library entries
        });
      }
    }
  }

  // Compute weighted Demand Index across all suggestions
  computeDemandIndex(suggestions);

  // Sort by Demand Index (highest opportunity first)
  suggestions.sort((a, b) => b.demandIndex - a.demandIndex);

  const report = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    provenance: {
      communityIndex: {
        version: (engine === "UEFN" ? demandBenchmarksUEFN : demandBenchmarksUE5).version || "unknown",
        source: (engine === "UEFN" ? demandBenchmarksUEFN : demandBenchmarksUE5).source || "manual",
        methodology: (engine === "UEFN" ? demandBenchmarksUEFN : demandBenchmarksUE5).methodology || "",
        subtopicCount: Object.values(getTaxonomy(engine)).flat().length,
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
  _cachedReports[engine] = report;
  _cachedAt[engine] = Date.now();
  _saveToStorage(report, engine);

  devLog(
    `[DemandIntel:${engine}] Report complete: ${suggestions.length} suggestions, ` +
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
export async function getDemandSuggestions(courses = [], topN = 10, engine = "UE5") {
  const report = await generateDemandReport(courses, { engine });
  return report.suggestions.slice(0, topN);
}

/**
 * Return the in-memory cached report synchronously (or null if stale/empty).
 * This lets React hooks seed their initial state without an async call,
 * preventing a loading-spinner flash when the data is already available.
 */
export function getCachedReport(engine = "UE5") {
  if (_cachedReports[engine] && Date.now() - _cachedAt[engine] < CACHE_TTL_MS) {
    const cReport = _cachedReports[engine];
    // ALWAYS inject fresh SEO metrics from local bundle
    if (cReport && cReport.suggestions) {
      cReport.suggestions.forEach(suggestion => {
        const seoData = seoMetricsData[suggestion.topic] || { msv: 0, kd: 0 };
        suggestion.seoMetrics = { msv: seoData.msv, kd: seoData.kd };
      });
    }
    return cReport;
  }
  return null;
}

/**
 * Force-clear the report cache (e.g., when user clicks Refresh).
 */
export function clearDemandCache(engine = "UE5") {
  _cachedReports[engine] = null;
  _cachedAt[engine] = 0;
  try { localStorage.removeItem(getStorageKey(engine)); } catch { /* ignore */ }
  devLog(`[DemandIntel:${engine}] Cache cleared (memory + localStorage)`);
}

export default {
  generateDemandReport,
  fetchTrendingQuestions,
  scanAllCommunityPainPoints,
  getDemandSuggestions,
  loadGranularDemand,
  loadFromFirestore,
  calculateGranularCoverage,
  clearDemandCache,
  GRANULAR_TAXONOMY,
  SOURCE_TYPES,
};
