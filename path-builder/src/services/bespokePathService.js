/**
 * bespokePathService.js — Bespoke Learning Path Orchestrator
 *
 * Coordinates the 3-stage pipeline:
 *   Stage 1 (pathSearch.js):     findRelevantSegments()
 *   Stage 2 (pathSequencer.js):  sequencePath()
 *   Stage 3 (pathNarration.js):  generateBridgeNarration()
 *
 * Also contains the hybrid fallback (generateHybridPath) and the
 * main entry point (generateBespokePath).
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import {
  trackVectorSearchCompleted,
  trackHybridFallbackTriggered,
  trackPathSequenced,
  trackAICoverageReport,
} from "./analyticsService";

// Re-export extracted modules so existing consumer imports stay valid
export { findRelevantSegments, SIMILARITY_THRESHOLD, MIN_PATH_SEGMENTS } from "./pathSearch";
export { sequencePath, computeTopicOverlap } from "./pathSequencer";
export { generateBridgeNarration } from "./pathNarration";

// Internal imports for orchestration
import { findRelevantSegments } from "./pathSearch";
import { SIMILARITY_THRESHOLD, MIN_PATH_SEGMENTS } from "./pathSearch";
import { sequencePath } from "./pathSequencer";
import { generateBridgeNarration } from "./pathNarration";

/**
 * Hybrid Fallback: Generate a learning path from Gemini's own knowledge
 * when the embedding corpus doesn't have good matches.
 *
 * @param {string} userQuery - The learner's question
 * @param {Object} [knowledgeProfile] - Optional adaptive profile
 * @returns {Promise<Array<{segment: Object, category: string, summary: string, order: number}>>}
 */
async function generateHybridPath(userQuery, knowledgeProfile = null) {
  let adaptiveContext = "";
  if (knowledgeProfile) {
    const { level = "beginner", gaps = [], knows = [] } = knowledgeProfile;
    const gapText =
      gaps.length > 0
        ? `\nKnowledge GAPS the path MUST address (these are the learner's weak areas — focus content on these topics):\n${gaps.map((c) => `  - ${c.replace(/_/g, " ")}`).join("\n")}`
        : "";
    const knowsText =
      knows.length > 0
        ? `\nConcepts they ALREADY KNOW (keep brief, 1 sentence max):\n${knows.map((c) => `  - ${c.replace(/_/g, " ")}`).join("\n")}`
        : "";
    adaptiveContext = `\nThe learner's assessed level is: ${level.toUpperCase()}. Adjust complexity accordingly.${gapText}${knowsText}`;
  }

  const prompt = `You are a UE5 curriculum designer. A learner asked: "${userQuery}"

Our content library does not have strong matches for this topic, so generate a learning path from your own Unreal Engine 5 knowledge.

Create a 4-6 step learning path with these categories:
- prerequisite (1-2 steps): Background concepts the learner needs before tackling the main topic
- core (1-2 steps): The main implementation — step-by-step workflow in the UE5 editor
- practice (1-2 steps): Hands-on exercises or ways to apply and extend the knowledge

IMPORTANT RULES:
- TITLE FORMAT: Each title must be a short, clear description (3-6 words max) that starts with a gerund. Examples: "Understanding Blueprint Variables", "Setting Up Time Dilation", "Applying Slow Motion Effects". Do NOT use generic titles like "Step 1" or "Assembly".
- The title MUST directly relate to the learner's original question: "${userQuery}"
- PRIORITIZE Blueprint-based approaches over C++ unless the query asks about C++
- Be specific: include actual menu paths, property names, panel names, and node names
- ASSET ASSUMPTION: Assume the learner already has a Static Mesh from FAB (Unreal Marketplace) or an FBX they imported. "Create" means setting up the asset in their project — NOT modeling from scratch or using Texture Graph.
- For "create/make" queries: Start with importing the asset or downloading from FAB, then setting up materials, then creating a Blueprint actor with the mesh component, then configuring collision
- Each summary should be 3-5 sentences teaching the concept directly in second person
- Plain text only — no markdown, no asterisks, no code blocks
- UE5 ONLY: This platform is exclusively for Unreal Engine 5. NEVER reference UE4 or Unreal Engine 4. All menu paths, features, and instructions must be UE5-specific.
${adaptiveContext}

Return a JSON array:
[{"category": "prerequisite", "title": "Understanding Time Dilation", "summary": "Direct teaching content..."}]`;

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(() => classifyFn({ prompt, grounded: true }), {
      maxRetries: 2,
      baseDelayMs: 1500,
      label: "hybridPath",
    });
    const responseText = result.data?.text || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      devWarn("[BespokePath] Hybrid path generation failed to parse JSON");
      return [];
    }

    // Sanitize common Gemini JSON issues
    let jsonStr = jsonMatch[0]
      .replace(/```json?\s*/gi, "") // strip code fences
      .replace(/```\s*/g, "") // strip closing fences
      .replace(/[\u201C\u201D]/g, '"') // smart quotes → straight
      .replace(/[\u2018\u2019]/g, "'") // smart single quotes
      .replace(/,\s*([}\]])/g, "$1"); // trailing commas

    let steps;
    try {
      steps = JSON.parse(jsonStr);
      // eslint-disable-next-line no-unused-vars
    } catch (_parseErr) {
      // Last-ditch: try replacing single-quoted keys with double-quoted
      jsonStr = jsonStr.replace(/'/g, '"');
      try {
        steps = JSON.parse(jsonStr);
      } catch (finalErr) {
        devWarn(
          "[BespokePath] Hybrid JSON parse failed even after sanitization:",
          finalErr.message
        );
        return [];
      }
    }
    const CATEGORY_ORDER = {
      prerequisite: 0,
      core: 1,
      practice: 2,
      foundation: 3,
      diagnosis: 4,
      fix: 5,
      transfer: 6,
    };

    const sequenced = steps
      .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99))
      .map((step, i) => {
        // Attach grounding sources to this step if available
        const stepSources = [];
        if (groundingMetadata?.sources?.length > 0) {
          // Match supports that reference this step's title or summary
          const stepText = (step.title + " " + step.summary).toLowerCase();
          (groundingMetadata.supports || []).forEach((support) => {
            // Check if any grounding support text overlaps with this step's content
            const supportText = (support.text || "").toLowerCase();
            const words = stepText.split(/\s+/).filter((w) => w.length > 4);
            const hasOverlap = words.some((word) => supportText.includes(word));
            if (hasOverlap) {
              (support.sourceIndices || []).forEach((idx) => {
                if (groundingMetadata.sources[idx]) {
                  const src = groundingMetadata.sources[idx];
                  if (!stepSources.some((s) => s.url === src.url)) {
                    stepSources.push(src);
                  }
                }
              });
            }
          });
        }

        return {
          segment: {
            id: `hybrid-${i}`,
            type: "ai_generated",
            title: step.title,
            text: step.summary,
            source: "ai_generated",
            sources: stepSources.length > 0 ? stepSources : undefined,
            unverified: stepSources.length === 0,
          },
          category: step.category || "foundation",
          summary: step.summary,
          order: i,
        };
      });

    devLog(`[BespokePath] Hybrid path generated: ${sequenced.length} AI steps`);
    recordTokenUsage(
      "hybridPath",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );
    return sequenced;
  } catch (err) {
    devWarn("[BespokePath] Hybrid path generation failed:", err.message);
    return [];
  }
}

/**
 * Full pipeline: generate a complete bespoke learning path.
 * Orchestrates all 3 stages and returns a ready-to-render path.
 *
 * @param {string} userQuery - The learner's question
 * @param {Object} [knowledgeProfile] - Optional adaptive profile { knows, gaps, level }
 * @returns {Promise<{query: string, segments: Array, path: Array, bridges: Array, error: string|null}>}
 */
export async function generateBespokePath(userQuery, knowledgeProfile = null) {
  const result = {
    query: userQuery,
    segments: [],
    path: [],
    bridges: [],
    error: null,
    generatedAt: new Date().toISOString(),
    knowledgeProfile: knowledgeProfile || null,
  };

  try {
    // Stage 1: Find relevant content
    devLog("[BespokePath] Stage 1: Finding relevant segments...");
    const searchStart = Date.now();
    const { segments, lowCorpusCoverage } = await findRelevantSegments(
      userQuery,
      5,
      knowledgeProfile
    );
    const searchTimeMs = Date.now() - searchStart;
    result.segments = segments;

    // ── RAG Telemetry ──
    const transcriptCount = segments.filter((s) => s.type === "transcript").length;
    const epicCount = segments.filter((s) => s.type === "epic_learning").length;
    const docsCount = segments.filter((s) => s.type === "docs").length;
    const bestSimilarity = segments.length > 0 ? segments[0].similarity : 0;
    const avgSimilarity =
      segments.length > 0
        ? segments.reduce((sum, s) => sum + (s.similarity || 0), 0) / segments.length
        : 0;
    trackVectorSearchCompleted({
      query: userQuery,
      transcriptCount,
      epicCount,
      docsCount,
      bestSimilarity,
      avgSimilarity,
      lowCorpusCoverage,
      searchTimeMs,
    });

    // ── HYBRID FALLBACK: If corpus can't answer, let Gemini generate from its own knowledge ──
    // Check 1: No segments or low similarity
    let forceHybrid = segments.length === 0 || lowCorpusCoverage;
    let hybridReason = segments.length === 0 ? "no_segments" : "low_similarity";

    // Check 2: Gap-relevance — when the learner has identified gaps, verify
    // that the retrieved segments actually discuss those gap topics.
    // Without this, semantically-similar but topically-wrong content (e.g.,
    // "animation timelines" when the gap is "time dilation") gets served.
    if (!forceHybrid && knowledgeProfile?.gaps?.length > 0) {
      const gapTerms = knowledgeProfile.gaps.map((g) => g.replace(/_/g, " ").toLowerCase());
      const segmentTexts = segments.map((s) =>
        `${s.text} ${s.title || ""} ${s.videoTitle || ""}`.toLowerCase()
      );
      const gapMentioned = gapTerms.some((gap) => segmentTexts.some((txt) => txt.includes(gap)));
      if (!gapMentioned) {
        forceHybrid = true;
        hybridReason = "gap_not_in_corpus";
        devWarn(
          `[BespokePath] No segments mention gap topics [${gapTerms.join(", ")}] — forcing hybrid`
        );
      }
    }

    if (forceHybrid) {
      devLog(`[BespokePath] Hybrid fallback triggered (reason: ${hybridReason})`);
      trackHybridFallbackTriggered({
        reason: hybridReason,
        bestSimilarity,
        corpusSegments: segments.length,
      });
      result.path = await generateHybridPath(userQuery, knowledgeProfile);
      result.isAiGenerated = true;

      if (result.path.length === 0) {
        result.error =
          "No relevant content found for your question. Try rephrasing or being more specific.";
        return result;
      }

      // ── CORPUS VERIFICATION for AI steps ──
      // For each hybrid step, check if official corpus content matches.
      // This is a lightweight check — it reuses findRelevantSegments with topK=1.
      try {
        const verifyPromises = result.path.map(async (pathStep) => {
          const summary = pathStep.summary || pathStep.segment?.text || "";
          if (!summary) return;
          try {
            const { segments: matches } = await findRelevantSegments(summary, 1);
            if (matches.length > 0 && matches[0].similarity >= SIMILARITY_THRESHOLD) {
              const best = matches[0];
              pathStep.segment.corpusVerified = true;
              pathStep.segment.corpusMatch = {
                videoTitle: best.videoTitle || best.title || "",
                videoUrl: best.videoUrl || best.url || "",
                similarity: best.similarity,
              };
              devLog(
                `[BespokePath] Corpus verified: "${pathStep.segment.title}" ↔ "${best.videoTitle || best.title}" (${best.similarity.toFixed(3)})`
              );
            }
          } catch {
            // Non-fatal — step stays unverified
          }
        });
        await Promise.allSettled(verifyPromises);
        const verifiedCount = result.path.filter((s) => s.segment.corpusVerified).length;
        devLog(
          `[BespokePath] Corpus verification: ${verifiedCount}/${result.path.length} steps verified`
        );
      } catch (verifyErr) {
        devWarn("[BespokePath] Corpus verification failed (non-fatal):", verifyErr.message);
      }

      // Stage 3: Generate bridge narrations for hybrid path
      devLog("[BespokePath] Stage 3: Generating narrations for hybrid path...");
      result.bridges = await generateBridgeNarration(result.path, userQuery);

      devLog(`[BespokePath] Hybrid pipeline complete: ${result.path.length} AI-generated steps`);

      // ── Track metrics for hybrid fallback path ──
      trackPathSequenced({
        stepCount: result.path.length,
        categories: [...new Set(result.path.map((s) => s.category))],
        isAiGenerated: true,
        corpusRatio: 0,
      });
      trackAICoverageReport({
        query: userQuery,
        learnerLevel: knowledgeProfile?.level || "unknown",
        knowledgeGaps: knowledgeProfile?.gaps || [],
        totalSteps: result.path.length,
        corpusSteps: 0,
        aiGeneratedSteps: result.path.length,
        lowCorpusCoverage: true,
      });

      return result;
    }

    // Stage 2: Sequence into learning path (with adaptive depth if profile provided)
    devLog(
      `[BespokePath] Stage 2: Sequencing path...${knowledgeProfile ? ` (adaptive: ${knowledgeProfile.level})` : ""}`
    );
    result.path = await sequencePath(userQuery, segments, knowledgeProfile);

    // ── POST-SEQUENCE SAFETY NET ──
    // If the corpus had segments but most were filtered as "low" relevance
    // (e.g., Texture Graph matching "sword" semantically but wrong workflow),
    // supplement with hybrid AI-generated steps so the path isn't anemic.
    if (result.path.length < MIN_PATH_SEGMENTS) {
      devLog(
        `[BespokePath] Only ${result.path.length} steps survived sequencing (min ${MIN_PATH_SEGMENTS}) — supplementing with hybrid AI content`
      );
      const hybridSteps = await generateHybridPath(userQuery, knowledgeProfile);
      if (hybridSteps.length > 0) {
        // Replace entirely with hybrid if corpus gave ≤1 usable step
        if (result.path.length <= 1) {
          result.path = hybridSteps;
          result.isAiGenerated = true;
          trackHybridFallbackTriggered({
            reason: "post_sequence_empty",
            bestSimilarity,
            corpusSegments: segments.length,
          });
        } else {
          // Fill in missing categories from hybrid
          const existingCategories = new Set(result.path.map((s) => s.category));
          const supplemental = hybridSteps.filter((s) => !existingCategories.has(s.category));
          result.path = [...result.path, ...supplemental].map((s, i) => ({
            ...s,
            order: i,
          }));
        }
        devLog(`[BespokePath] Path supplemented to ${result.path.length} steps`);
      }
    }

    if (result.path.length === 0) {
      result.error =
        "Found content but couldn't build a coherent path. Try a more focused question.";
      return result;
    }

    // ── Track final path metrics (before narration so they always fire) ──
    const corpusSteps = result.path.filter((s) => s.segment?.type !== "ai_generated").length;
    const aiGenSteps = result.path.length - corpusSteps;
    trackPathSequenced({
      stepCount: result.path.length,
      categories: [...new Set(result.path.map((s) => s.category))],
      isAiGenerated: !!result.isAiGenerated,
      corpusRatio: result.path.length > 0 ? corpusSteps / result.path.length : 0,
    });
    devLog("[BespokePath] >>> Firing coverage report:", {
      corpusSteps,
      aiGenSteps,
      total: result.path.length,
    });
    trackAICoverageReport({
      query: userQuery,
      learnerLevel: knowledgeProfile?.level || "unknown",
      knowledgeGaps: knowledgeProfile?.gaps || [],
      totalSteps: result.path.length,
      corpusSteps,
      aiGeneratedSteps: aiGenSteps,
      lowCorpusCoverage: !!lowCorpusCoverage,
    });

    // Stage 3: Generate bridge narrations
    devLog("[BespokePath] Stage 3: Generating narrations...");
    result.bridges = await generateBridgeNarration(result.path, userQuery);

    devLog(
      `[BespokePath] Pipeline complete: ${result.path.length} steps, ${result.bridges.length} bridges`
    );

    return result;
  } catch (err) {
    devWarn("[BespokePath] Pipeline failed:", err.message);
    result.error = "Something went wrong generating your path. Please try again.";
    return result;
  }
}
