/**
 * editorialPass.js — Post-Generation Editorial Enrichment
 *
 * Takes a raw V2 path and enriches each step with structured teaching
 * fields via Gemini. Converts source-descriptive copy into pedagogical
 * instruction with a consistent learner voice.
 *
 * Uses the existing `classifySegments` Cloud Function as the Gemini proxy.
 *
 * Strategy:
 * - Batch steps (up to 5 at a time) to reduce round-trips
 * - Deterministic fill for fields that can be derived from existing data
 * - LLM enrichment for teaching fields (whyThisMatters, whatToDo, etc.)
 * - Graceful degradation: if LLM fails, deterministic fallback fills
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { COMPLETION_TYPES } from "../schemas/LearningPathV2";

// ── Constants ──────────────────────────────────────────────────────

const BATCH_SIZE = 5;
const MAX_STEP_CONTEXT_CHARS = 300;

// ── Deterministic Completion Type ──────────────────────────────────

function inferCompletionType(step) {
  if (step.video) return "watch";
  const cat = (step.category || "").toLowerCase();
  const title = (step.title || "").toLowerCase();

  if (cat.includes("practice") || cat.includes("transfer") || title.includes("apply"))
    return "apply";
  if (cat.includes("diagnosis") || title.includes("verify") || title.includes("test"))
    return "verify";
  if (cat.includes("foundation") || cat.includes("prerequisite"))
    return "read";
  return "do";
}

// ── Deterministic Time Estimate ────────────────────────────────────

function inferEstimatedMinutes(step) {
  // Video: use actual duration if available
  if (step.video?.durationSeconds) {
    return Math.ceil(step.video.durationSeconds / 60);
  }
  // Estimate based on content length
  const textLength = (step.summary || "").length + (step._bridgeText || "").length;
  if (textLength > 1000) return 8;
  if (textLength > 500) return 5;
  return 3;
}

// ── Deterministic goDeeper Links ───────────────────────────────────

function inferGoDeeper(step) {
  const links = [];
  const seg = step._originalSegment || {};

  if (step.video?.url) {
    links.push({
      label: step.video.title || "Watch the video",
      url: step.video.url,
      type: "video",
    });
  }
  if (seg.doc_url || seg.url) {
    links.push({
      label: "Official documentation",
      url: seg.doc_url || seg.url,
      type: "docs",
    });
  }
  return links;
}

// ── Deterministic Fallback Fill ────────────────────────────────────

/**
 * Fill structured fields deterministically when LLM enrichment fails.
 * Produces reasonable (if generic) content from existing step data.
 */
function deterministicFill(step) {
  const title = step.title || "this topic";
  return {
    whyThisMatters: step.whyThisMatters ||
      `Understanding ${title} is essential for working effectively in Unreal Engine 5.`,
    whatToDo: step.whatToDo?.length ? step.whatToDo : [
      `Review the material on ${title}.`,
      `Follow along with the provided example.`,
    ],
    howToVerify: step.howToVerify?.length ? step.howToVerify : [
      `You can explain ${title} in your own words.`,
      `Your project compiles and runs without errors.`,
    ],
    commonMistake: step.commonMistake ||
      `Skipping the verification step and moving on before confirming ${title} works in your project.`,
    takeaway: step.takeaway ||
      `${title} — now part of your UE5 toolkit.`,
    completionType: step.completionType || inferCompletionType(step),
    estimatedMinutes: step.estimatedMinutes || inferEstimatedMinutes(step),
    goDeeper: step.goDeeper?.length ? step.goDeeper : inferGoDeeper(step),
  };
}

// ── LLM Enrichment Prompt ──────────────────────────────────────────

function buildEnrichmentPrompt(steps, pathTitle, learnerGoal) {
  const stepSummaries = steps.map((s, i) => {
    const text = (s.summary || s._bridgeText || "").slice(0, MAX_STEP_CONTEXT_CHARS);
    return `Step ${i + 1}: "${s.title}" (${s.category})
Summary: ${text}`;
  }).join("\n\n");

  return `You are a senior UE5 instructor writing a structured learning path.

Path: "${pathTitle}"
Learner goal: "${learnerGoal}"

For each step below, generate structured teaching content.
Write in second person ("you"), be concise, and stay factually grounded.

${stepSummaries}

Return a JSON array (one object per step, in order):
[
  {
    "whyThisMatters": "1-2 sentences connecting to the learner's goal",
    "whatToDo": ["action 1", "action 2", "action 3"],
    "howToVerify": ["check 1", "check 2"],
    "commonMistake": "One specific pitfall to avoid",
    "takeaway": "One sentence memory anchor"
  }
]

Rules:
- whatToDo should be specific UE5 actions, not "read about it"
- howToVerify should be observable outcomes, not subjective feelings
- commonMistake should be a real UE5 gotcha, not generic advice
- takeaway should be memorable and concise (under 15 words)
- Return ONLY the JSON array, no markdown fences or commentary`;
}

// ── Path Intro Enrichment Prompt ───────────────────────────────────

function buildIntroPrompt(pathTitle, learnerGoal, stepTitles) {
  return `You are a senior UE5 instructor writing the introduction for a learning path.

Path: "${pathTitle}"
Learner's question/goal: "${learnerGoal}"

Steps in this path:
${stepTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Generate a learner-friendly introduction. Return JSON:
{
  "quickAnswer": "One sentence direct answer to what the learner asked",
  "rootCause": "One sentence: the most likely reason this problem happens",
  "whatYouWillLearn": ["outcome 1", "outcome 2", "outcome 3"],
  "quickWin": "One concrete thing to try right now before starting the full path",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "estimatedMinutes": <total minutes as integer>
}

Rules:
- quickAnswer should directly address the learner's question
- quickWin should be actionable in under 2 minutes
- prerequisites should be specific UE5 knowledge, not generic
- Return ONLY the JSON object, no markdown fences`;
}

// ── Core Editorial Pass ────────────────────────────────────────────

/**
 * Run the editorial pass on a V2 path.
 *
 * Enriches each step with teaching fields (whyThisMatters, whatToDo,
 * howToVerify, commonMistake, takeaway) and the path intro
 * (quickAnswer, rootCause, whatYouWillLearn, quickWin).
 *
 * @param {Object} v2Path — LearningPathV2 object
 * @returns {Promise<Object>} — Enriched V2 path
 */
export async function runEditorialPass(v2Path) {
  if (!v2Path || !v2Path.sections) return v2Path;

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");
  const classifyFn = httpsCallable(functions, "classifySegments", { timeout: 120000 });

  const enrichedPath = { ...v2Path };

  // ── Collect all steps ──
  const allSteps = [];
  for (const section of enrichedPath.sections) {
    for (const step of section.steps) {
      allSteps.push(step);
    }
  }

  devLog(`[EditorialPass] Enriching ${allSteps.length} steps in batches of ${BATCH_SIZE}`);

  // ── Batch-enrich steps ──
  for (let i = 0; i < allSteps.length; i += BATCH_SIZE) {
    const batch = allSteps.slice(i, i + BATCH_SIZE);

    try {
      const prompt = buildEnrichmentPrompt(
        batch,
        v2Path.title || "Learning Path",
        v2Path.learnerGoal || v2Path._originalQuery || ""
      );

      const result = await retryWithBackoff(
        () => classifyFn({ prompt }),
        { maxRetries: 2, baseDelayMs: 1500, label: "editorialPass" }
      );

      const responseText = result.data?.text || "";
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const enrichments = JSON.parse(jsonMatch[0]);

        recordTokenUsage(
          "editorialPass",
          Math.ceil(prompt.length / 4),
          Math.ceil(responseText.length / 4)
        );

        // Merge LLM enrichment into steps
        for (let j = 0; j < batch.length && j < enrichments.length; j++) {
          const e = enrichments[j];
          const step = batch[j];
          step.whyThisMatters = e.whyThisMatters || step.whyThisMatters;
          step.whatToDo = Array.isArray(e.whatToDo) ? e.whatToDo : step.whatToDo;
          step.howToVerify = Array.isArray(e.howToVerify) ? e.howToVerify : step.howToVerify;
          step.commonMistake = e.commonMistake || step.commonMistake;
          step.takeaway = e.takeaway || step.takeaway;
          step._editorialStatus = "enriched";
        }

        devLog(`[EditorialPass] Batch ${Math.floor(i / BATCH_SIZE) + 1}: enriched ${enrichments.length} steps`);
      } else {
        devWarn("[EditorialPass] LLM returned no valid JSON, using deterministic fill for batch");
        batch.forEach((step) => Object.assign(step, deterministicFill(step)));
      }
    } catch (err) {
      devWarn(`[EditorialPass] Batch failed: ${err.message}, using deterministic fill`);
      batch.forEach((step) => Object.assign(step, deterministicFill(step)));
    }
  }

  // ── Deterministic fill for any remaining gaps ──
  for (const step of allSteps) {
    const fill = deterministicFill(step);
    // Only fill fields that are still empty
    if (!step.whyThisMatters) step.whyThisMatters = fill.whyThisMatters;
    if (!step.whatToDo?.length) step.whatToDo = fill.whatToDo;
    if (!step.howToVerify?.length) step.howToVerify = fill.howToVerify;
    if (!step.commonMistake) step.commonMistake = fill.commonMistake;
    if (!step.takeaway) step.takeaway = fill.takeaway;
    step.completionType = step.completionType || fill.completionType;
    step.estimatedMinutes = step.estimatedMinutes || fill.estimatedMinutes;
    if (!step.goDeeper?.length) step.goDeeper = fill.goDeeper;
  }

  // ── Enrich path intro (Phase 6) ──
  try {
    const stepTitles = allSteps.map((s) => s.title);
    const introPrompt = buildIntroPrompt(
      v2Path.title || "Learning Path",
      v2Path.learnerGoal || v2Path._originalQuery || "",
      stepTitles
    );

    const introResult = await retryWithBackoff(
      () => classifyFn({ prompt: introPrompt }),
      { maxRetries: 2, baseDelayMs: 1500, label: "editorialPassIntro" }
    );

    const introText = introResult.data?.text || "";
    const introJson = introText.match(/\{[\s\S]*\}/);

    if (introJson) {
      const intro = JSON.parse(introJson[0]);
      enrichedPath.quickAnswer = intro.quickAnswer || enrichedPath.quickAnswer;
      enrichedPath.rootCause = intro.rootCause || enrichedPath.rootCause;
      enrichedPath.whatYouWillLearn = Array.isArray(intro.whatYouWillLearn)
        ? intro.whatYouWillLearn : enrichedPath.whatYouWillLearn;
      enrichedPath.quickWin = intro.quickWin || enrichedPath.quickWin;
      enrichedPath.difficulty = intro.difficulty || enrichedPath.difficulty;
      enrichedPath.prerequisites = Array.isArray(intro.prerequisites)
        ? intro.prerequisites : enrichedPath.prerequisites;

      // Use authored estimate if provided
      if (intro.estimatedMinutes) {
        enrichedPath.estimatedMinutes = intro.estimatedMinutes;
      }

      recordTokenUsage(
        "editorialPassIntro",
        Math.ceil(introPrompt.length / 4),
        Math.ceil(introText.length / 4)
      );
      devLog("[EditorialPass] Path intro enriched via LLM");
    }
  } catch (err) {
    devWarn(`[EditorialPass] Intro enrichment failed: ${err.message}`);
  }

  // ── Calculate total time from step estimates ──
  if (!enrichedPath.estimatedMinutes) {
    enrichedPath.estimatedMinutes = allSteps.reduce(
      (sum, s) => sum + (s.estimatedMinutes || 3), 0
    );
  }

  devLog(`[EditorialPass] Complete: ${allSteps.filter((s) => s._editorialStatus === "enriched").length}/${allSteps.length} steps enriched via LLM`);

  return enrichedPath;
}
