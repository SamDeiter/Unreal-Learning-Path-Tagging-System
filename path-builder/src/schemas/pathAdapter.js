/**
 * pathAdapter.js — Adapts existing pipeline outputs into LearningPathV2 format.
 *
 * Each adapter converts a specific pipeline's output shape into the canonical
 * V2 format. The existing generators remain untouched — adapters are a
 * pure translation layer.
 *
 * Adapters:
 *   adaptBespokePath()   — bespokePathService output
 *   adaptQueryPath()     — queryLearningPath output (problem-first cart)
 *   adaptPreSeededPath() — pre-seeded path data
 */

import {
  createV2Path,
  createV2Section,
  createV2Step,
  CATEGORY_TO_SECTION,
  SECTION_PHASES,
} from "./LearningPathV2";
import { ensureQualitySummary } from "../utils/summaryQualityGate";
import { resolveStepTitle } from "../utils/resolveStepTitle";

// ── Bespoke Path Adapter ───────────────────────────────────────────

/**
 * Adapt a bespoke pipeline result into LearningPathV2.
 *
 * Input shape:
 *   { query, path: [{ segment, category, title, summary, order }], bridges, gaps, ... }
 *
 * @param {Object} bespokeResult — output from generateBespokePath()
 * @returns {Object} LearningPathV2
 */
export function adaptBespokePath(bespokeResult) {
  if (!bespokeResult || !bespokeResult.path || bespokeResult.path.length === 0) {
    return createV2Path({
      _sourceFormat: "bespoke",
      _originalQuery: bespokeResult?.query || "",
    });
  }

  const { path, bridges = [], query = "" } = bespokeResult;

  // Group steps by section phase
  const sectionBuckets = { prerequisite: [], core: [], practice: [] };

  path.forEach((step, idx) => {
    const category = (step.category || "core").toLowerCase();
    const sectionPhase = CATEGORY_TO_SECTION[category] || "core";
    const bridge = bridges[idx] || null;
    const bridgeText = bridge?.text || bridge?.narration || "";

    // Resolve summary through quality gate
    const rawSummary =
      step.summary ||
      step.segment?.summary ||
      step.segment?.text ||
      step.description ||
      "";
    const { text: cleanSummary } = ensureQualitySummary(
      rawSummary,
      resolveStepTitle(step, idx),
      category
    );

    const v2Step = createV2Step({
      id: step.segment?.id || `bespoke-${idx}`,
      title: resolveStepTitle(step, idx),
      summary: cleanSummary,
      category,
      // Extract teaching fields from existing pipeline enrichment
      whyThisMatters: step.gemini_enriched?.one_sentence_summary || "",
      whatToDo: extractWhatToDo(step),
      howToVerify: [],
      commonMistake: extractCommonMistake(step),
      takeaway: step.gemini_enriched?.takeaway || step.takeaway || "",
      completionType: step.video || step.segment?.videoUrl ? "watch" : "do",
      goDeeper: extractGoDeeper(step),
      source: {
        type: step.segment?.type || step.segment?.source || "unknown",
        url: step.segment?.videoUrl || step.segment?.url || "",
        videoTitle: step.segment?.videoTitle || "",
        timestamp: step.segment?.startTimestamp || "",
      },
      video: extractVideoFromStep(step),
      estimatedMinutes: step.segment?.durationSeconds
        ? Math.ceil(step.segment.durationSeconds / 60)
        : 3,
      _originalSegment: step.segment || null,
      _bridgeText: bridgeText,
    });

    sectionBuckets[sectionPhase].push(v2Step);
  });

  // Build sections (only non-empty)
  const sections = SECTION_PHASES
    .filter((phase) => sectionBuckets[phase].length > 0)
    .map((phase) => createV2Section(phase, sectionBuckets[phase]));

  const totalSteps = path.length;

  return createV2Path({
    title: query
      ? `UE5 Learning Path: ${query.substring(0, 60)}`
      : "Learning Path",
    learnerGoal: query,
    difficulty: bespokeResult.knowledgeProfile?.level || "intermediate",
    estimatedMinutes: totalSteps * 3,
    isAiGenerated: !!bespokeResult.isAiGenerated,
    generatedAt: bespokeResult.generatedAt || new Date().toISOString(),
    sections,
    _sourceFormat: "bespoke",
    _originalQuery: query,
    // Preserve metadata for gap analysis, community pain points, etc.
    _gaps: bespokeResult.gaps || null,
    _communityPainPoints: bespokeResult.communityPainPoints || [],
    _bridges: bridges,
    // Preserve the original path array for backward compat
    _originalPath: path,
  });
}

// ── Query / Problem-First Adapter ──────────────────────────────────

/**
 * Adapt a query pipeline result into LearningPathV2.
 *
 * Input shape:
 *   { cart: { intent, diagnosis, objectives, microLesson }, fixSteps, evidence, learnPath, ... }
 *
 * @param {Object} queryResult — output from queryLearningPath
 * @returns {Object} LearningPathV2
 */
export function adaptQueryPath(queryResult) {
  if (!queryResult || !queryResult.success) {
    return createV2Path({ _sourceFormat: "query" });
  }

  const sections = [];
  const query = queryResult.cart?.intent?.problem_description || "";

  // Prerequisites: diagnosis root causes → prerequisite section
  const diagnosis = queryResult.cart?.diagnosis;
  if (diagnosis) {
    const prereqSteps = (diagnosis.root_causes || []).map((cause, i) =>
      createV2Step({
        id: `query-prereq-${i}`,
        title: `Understanding: ${cause.substring(0, 50)}`,
        summary: cause,
        category: "diagnosis",
      })
    );
    if (prereqSteps.length > 0) {
      sections.push(createV2Section("prerequisite", prereqSteps));
    }
  }

  // Core: fix steps + micro lesson
  const coreSteps = [];
  if (queryResult.fixSteps && queryResult.fixSteps.length > 0) {
    queryResult.fixSteps.forEach((fixStep, i) => {
      coreSteps.push(
        createV2Step({
          id: `query-fix-${i}`,
          title: `Fix Step ${i + 1}`,
          summary: fixStep,
          category: "fix",
        })
      );
    });
  }
  if (queryResult.cart?.microLesson) {
    const ml = queryResult.cart.microLesson;
    if (ml.quick_fix) {
      coreSteps.push(
        createV2Step({
          id: "query-quickfix",
          title: ml.quick_fix.title || "Quick Fix",
          summary: (ml.quick_fix.steps || []).join(" → "),
          whyThisMatters: ml.why_it_works?.explanation || "",
          category: "fix",
        })
      );
    }
  }
  if (coreSteps.length > 0) {
    sections.push(createV2Section("core", coreSteps));
  }

  // Practice: transferable objectives
  const objectives = queryResult.cart?.objectives;
  if (objectives?.transferable && objectives.transferable.length > 0) {
    const practiceSteps = objectives.transferable.map((obj, i) =>
      createV2Step({
        id: `query-transfer-${i}`,
        title: `Apply: ${obj.substring(0, 50)}`,
        summary: obj,
        category: "transfer",
      })
    );
    sections.push(createV2Section("practice", practiceSteps));
  }

  return createV2Path({
    title: query
      ? `UE5 Fix: ${query.substring(0, 60)}`
      : "Problem-First Path",
    learnerGoal: query,
    sections,
    _sourceFormat: "query",
    _originalQuery: query,
  });
}

// ── Pre-Seeded Path Adapter ────────────────────────────────────────

/**
 * Adapt a pre-seeded path into LearningPathV2.
 *
 * Input shape:
 *   { id, query, title, description, steps: [{ category, title, summary, sourceType }] }
 *
 * @param {Object} preSeeded — pre-seeded path data
 * @returns {Object} LearningPathV2
 */
export function adaptPreSeededPath(preSeeded) {
  if (!preSeeded || !preSeeded.steps || preSeeded.steps.length === 0) {
    return createV2Path({ _sourceFormat: "preseeded" });
  }

  const sectionBuckets = { prerequisite: [], core: [], practice: [] };

  preSeeded.steps.forEach((step, idx) => {
    const category = (step.category || "core").toLowerCase();
    const sectionPhase = CATEGORY_TO_SECTION[category] || "core";

    sectionBuckets[sectionPhase].push(
      createV2Step({
        id: `${preSeeded.id}-step-${idx}`,
        title: step.title || `Step ${idx + 1}`,
        summary: step.summary || "",
        category,
        source: { type: step.sourceType || "preseeded" },
      })
    );
  });

  const sections = SECTION_PHASES
    .filter((phase) => sectionBuckets[phase].length > 0)
    .map((phase) => createV2Section(phase, sectionBuckets[phase]));

  return createV2Path({
    title: preSeeded.title || `UE5 Path: ${preSeeded.query}`,
    learnerGoal: preSeeded.query || "",
    sections,
    _sourceFormat: "preseeded",
    _originalQuery: preSeeded.query || "",
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

// ── Teaching Field Extractors ───────────────────────────────────────

/**
 * Extract actionable "what to do" steps from pipeline enrichment data.
 */
function extractWhatToDo(step) {
  const gemini = step.gemini_enriched || {};
  const actions = [];
  if (gemini.key_properties?.length) {
    actions.push(...gemini.key_properties.slice(0, 3).map(
      (p) => `Learn about ${p.toLowerCase()}`
    ));
  }
  if (gemini.deep_dive) {
    actions.push(gemini.deep_dive);
  }
  return actions;
}

/**
 * Extract a common mistake/pitfall from pipeline enrichment data.
 */
function extractCommonMistake(step) {
  const gemini = step.gemini_enriched || {};
  if (gemini.common_pitfalls?.length) return gemini.common_pitfalls[0];
  if (gemini.pitfalls?.length) return gemini.pitfalls[0];
  return "";
}

/**
 * Extract "go deeper" resource links from step data.
 */
function extractGoDeeper(step) {
  const links = [];
  const seg = step.segment || {};

  if (seg.videoUrl || seg.url) {
    links.push({
      label: seg.videoTitle || "Source video",
      url: seg.videoUrl || seg.url,
      type: "video",
    });
  }
  if (seg.doc_url) {
    links.push({
      label: "Official docs",
      url: seg.doc_url,
      type: "docs",
    });
  }
  return links;
}

/**
 * Extract video info from a bespoke path step (mirrors logic in webPlayerService).
 */
function extractVideoFromStep(step) {
  const segment = step.segment || {};
  const candidateUrls = [
    segment.videoUrl,
    segment.url,
    step._url,
    step.url,
    step.code,
  ].filter(Boolean);

  const firstVideo = step.videos?.[0] || segment.videos?.[0];
  let driveId = null;
  let youtubeId = null;

  // Check explicit drive_id fields
  if (firstVideo?.drive_id) driveId = firstVideo.drive_id;
  else if (segment.drive_id) driveId = segment.drive_id;
  else if (step.drive_id) driveId = step.drive_id;

  // Try URLs
  if (!driveId && !youtubeId) {
    for (const videoUrl of candidateUrls) {
      if (!videoUrl) continue;
      const driveMatch =
        videoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        videoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (driveMatch) { driveId = driveMatch[1]; break; }
      try {
        const vUrl = new URL(videoUrl);
        if (vUrl.hostname.includes("youtube.com")) { youtubeId = vUrl.searchParams.get("v"); break; }
        if (vUrl.hostname.includes("youtu.be")) { youtubeId = vUrl.pathname.slice(1); break; }
      } catch { /* not a URL */ }
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) { youtubeId = videoUrl; break; }
    }
  }

  // Last resort: videoId field
  if (!driveId && !youtubeId && segment.videoId) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(segment.videoId)) {
      youtubeId = segment.videoId;
    }
  }

  if (!driveId && !youtubeId) return null;

  return {
    driveId,
    youtubeId,
    startSec: Math.round(segment.startTime || 0),
    endSec: Math.round(segment.endTime || 0),
    videoTitle: segment.videoTitle || "",
  };
}
