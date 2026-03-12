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
  const diagnosis = queryResult.cart?.diagnosis;
  const microLesson = queryResult.cart?.microLesson;
  const objectives = queryResult.cart?.objectives;
  const evidence = queryResult.evidence || [];

  // Build evidence summary for howToVerify
  const evidenceSummary = evidence.length > 0
    ? evidence.slice(0, 3).map((e) => `See: "${e.videoTitle || e.title || 'source'}" — ${(e.text || '').substring(0, 80)}`)
    : [];

  // Prerequisites: diagnosis root causes → prerequisite section
  if (diagnosis) {
    const prereqSteps = (diagnosis.root_causes || []).map((cause, i) => {
      const signals = (diagnosis.signals_to_watch_for || []).slice(0, 2);
      return createV2Step({
        id: `query-prereq-${i}`,
        title: `Understanding: ${cause.substring(0, 50)}`,
        summary: cause,
        category: "diagnosis",
        whyThisMatters: `This root cause is directly related to your issue: "${query.substring(0, 80)}".`,
        whatToDo: [
          `Identify whether ${cause.substring(0, 60)} applies to your project.`,
          ...(signals.length > 0 ? [`Check for these signals: ${signals.join(", ")}`] : []),
        ],
        howToVerify: [
          `You can confirm whether this root cause is present in your project.`,
          ...evidenceSummary.slice(0, 1),
        ],
        commonMistake: (diagnosis.variables_that_do_not || [])[0]
          ? `Don't focus on: ${(diagnosis.variables_that_do_not || [])[0]}`
          : "",
        takeaway: `Root cause: ${cause.substring(0, 50)}`,
        completionType: "read",
      });
    });
    if (prereqSteps.length > 0) {
      sections.push(createV2Section("prerequisite", prereqSteps));
    }
  }

  // Core: fix steps + micro lesson
  const coreSteps = [];
  if (queryResult.fixSteps && queryResult.fixSteps.length > 0) {
    queryResult.fixSteps.forEach((fixStep, i) => {
      const relatedCheck = (queryResult.fastChecks || [])[i] || "";
      coreSteps.push(
        createV2Step({
          id: `query-fix-${i}`,
          title: `Fix Step ${i + 1}: ${fixStep.substring(0, 40)}`,
          summary: fixStep,
          category: "fix",
          whyThisMatters: queryResult.whyThisResult?.[i]
            || `This step addresses the issue: "${query.substring(0, 60)}".`,
          whatToDo: [fixStep],
          howToVerify: relatedCheck
            ? [relatedCheck, ...evidenceSummary.slice(0, 1)]
            : evidenceSummary.slice(0, 2),
          commonMistake: (queryResult.ifStillBrokenBranches || [])[i]
            ? `If this doesn't work: ${queryResult.ifStillBrokenBranches[i].action || ""}`
            : "",
          takeaway: fixStep.substring(0, 60),
          completionType: "do",
        })
      );
    });
  }
  if (microLesson) {
    const ml = microLesson;
    if (ml.quick_fix) {
      const citationRefs = (ml.quick_fix.citations || []).map(
        (c) => `${c.videoTitle || c.courseCode || "source"} (${c.timestamp || ""})`
      );
      coreSteps.push(
        createV2Step({
          id: "query-quickfix",
          title: ml.quick_fix.title || "Quick Fix",
          summary: (ml.quick_fix.steps || []).join(" → "),
          whyThisMatters: ml.why_it_works?.explanation || "",
          whatToDo: ml.quick_fix.steps || [],
          howToVerify: citationRefs.length > 0
            ? [`Verify using: ${citationRefs.join(", ")}`]
            : [],
          commonMistake: (ml.related_situations || [])[0]
            ? `Watch out: ${ml.related_situations[0].scenario || ""}`
            : "",
          takeaway: ml.why_it_works?.key_concept || "",
          category: "fix",
          completionType: "do",
        })
      );
    }
  }
  if (coreSteps.length > 0) {
    sections.push(createV2Section("core", coreSteps));
  }

  // Practice: transferable objectives
  if (objectives?.transferable && objectives.transferable.length > 0) {
    const fixContext = (objectives.fix_specific || []).slice(0, 2);
    const practiceSteps = objectives.transferable.map((obj, i) =>
      createV2Step({
        id: `query-transfer-${i}`,
        title: `Apply: ${obj.substring(0, 50)}`,
        summary: obj,
        category: "transfer",
        whyThisMatters: `This skill transfers beyond the immediate fix${fixContext[0] ? `: "${fixContext[0].substring(0, 60)}"` : ""}.`,
        whatToDo: [
          `Apply ${obj.substring(0, 60)} to a different area of your project.`,
          "Test with a fresh scenario to confirm understanding.",
        ],
        howToVerify: [
          `You can solve a similar problem without referring back to this path.`,
        ],
        commonMistake: "Only applying this technique to the exact scenario you learned it in.",
        takeaway: obj.substring(0, 60),
        completionType: "apply",
      })
    );
    sections.push(createV2Section("practice", practiceSteps));
  }

  // Build intro fields from pipeline data
  const introOverrides = {};
  if (queryResult.mostLikelyCause) {
    introOverrides.rootCause = queryResult.mostLikelyCause;
  }
  if (queryResult.fastChecks?.length > 0) {
    introOverrides.quickWin = queryResult.fastChecks[0];
  }
  if (queryResult.learnPath?.topicsCovered?.length > 0) {
    introOverrides.whatYouWillLearn = queryResult.learnPath.topicsCovered;
  }
  if (queryResult.learnPath?.pathSummary) {
    introOverrides.quickAnswer = queryResult.learnPath.pathSummary;
  }

  return createV2Path({
    title: query
      ? `UE5 Fix: ${query.substring(0, 60)}`
      : "Problem-First Path",
    learnerGoal: query,
    sections,
    _sourceFormat: "query",
    _originalQuery: query,
    ...introOverrides,
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
  const totalSteps = preSeeded.steps.length;

  preSeeded.steps.forEach((step, idx) => {
    const category = (step.category || "core").toLowerCase();
    const sectionPhase = CATEGORY_TO_SECTION[category] || "core";
    const title = step.title || `Step ${idx + 1}`;

    sectionBuckets[sectionPhase].push(
      createV2Step({
        id: `${preSeeded.id}-step-${idx}`,
        title,
        summary: step.summary || "",
        category,
        source: { type: step.sourceType || "preseeded" },
        whyThisMatters: step.summary
          ? `${title} builds your understanding of ${(preSeeded.query || "this topic").substring(0, 60)}.`
          : "",
        whatToDo: step.summary
          ? [`Follow the guidance on ${title.toLowerCase()}.`, "Apply to your own project."]
          : [],
        howToVerify: [`Confirm that ${title.toLowerCase()} works correctly in your project.`],
        commonMistake: "",
        takeaway: title,
        completionType: sectionPhase === "prerequisite" ? "read" : sectionPhase === "practice" ? "apply" : "do",
        estimatedMinutes: Math.max(2, Math.round(15 / totalSteps)),
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
