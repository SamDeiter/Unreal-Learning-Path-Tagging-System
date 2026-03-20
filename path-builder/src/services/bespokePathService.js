/**
 * bespokePathService.js — Bespoke Learning Path Orchestrator
 *
 * Coordinates the 3-stage pipeline:
 *   Stage 1 (pathSearch.js):     findRelevantSegments()
 *   Stage 2 (pathSequencer.js):  sequencePath()
 *   Stage 3 (pathNarration.js):  generateBridgeNarration()
 *   Stage 3b (pathGapAnalyzer.js): analyzePathGaps() + searchCommunityPainPoints()
 *
 * Also contains the hybrid fallback (generateHybridPath) and the
 * main entry point (generateBespokePath).
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { adaptBespokePath } from "../schemas/pathAdapter";
import { runEditorialPass } from "./editorialPass";
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
import { findRelevantSegments, SIMILARITY_THRESHOLD, MIN_PATH_SEGMENTS } from "./pathSearch";
import { sequencePath } from "./pathSequencer";
import { generateBridgeNarration } from "./pathNarration";
import { analyzePathGaps, searchCommunityPainPoints, generateGapFillStep } from "./pathGapAnalyzer";
import { CATEGORY_TO_SECTION } from "../schemas/LearningPathV2";

// Re-export extracted modules so existing consumer imports stay valid
export { findRelevantSegments, SIMILARITY_THRESHOLD, MIN_PATH_SEGMENTS } from "./pathSearch";
export { sequencePath, computeTopicOverlap } from "./pathSequencer";
export { generateBridgeNarration } from "./pathNarration";
export { analyzePathGaps, searchCommunityPainPoints, generateGapFillStep } from "./pathGapAnalyzer";

// ── Category sort order (derived from CATEGORY_TO_SECTION + explicit ordering) ──
// Maps each category to a numeric order for sorting hybrid path steps.
const SECTION_PHASE_ORDER = { prerequisite: 0, core: 1, practice: 2 };
const CATEGORY_ORDER = Object.fromEntries(
  Object.entries(CATEGORY_TO_SECTION).map(([cat, phase]) => [
    cat,
    SECTION_PHASE_ORDER[phase] ?? 99,
  ])
);

// ── Phase 0: UE5 Query Feasibility Gate (Layer 1) ──
// Prevents hallucinated paths for off-topic queries (e.g., "Horses in UE5")
const UE5_DOMAINS = [
  'blueprint', 'material', 'landscape', 'niagara', 'animation',
  'ai', 'navigation', 'physics', 'collision', 'widget', 'umg',
  'common ui', 'networking', 'replication', 'pcg', 'procedural',
  'metahuman', 'nanite', 'lumen', 'virtual shadow', 'mass',
  'gameplay ability', 'gas', 'data asset', 'subsystem',
  'c++', 'actor', 'component', 'pawn', 'character', 'controller',
  'game mode', 'game state', 'sequencer', 'level', 'world',
  'packaging', 'deployment', 'lighting', 'rendering', 'shader',
  'texture', 'mesh', 'static mesh', 'skeletal mesh', 'fbx',
  'import', 'export', 'fab', 'marketplace', 'plugin',
  'modeling', 'modelling', 'uv', 'unwrap', 'retopology',
  'cinematic', 'camera', 'hud', 'inventory', 'dialogue',
  'behavior tree', 'blackboard', 'eqs', 'pathfinding',
  'audio', 'sound', 'metasound', 'quartz',
  'chaos', 'destruction', 'fracture', 'water', 'ocean',
  'foliage', 'terrain', 'world partition', 'data layer',
  'source control', 'perforce', 'git', 'multiplayer',
  'dedicated server', 'listen server', 'session',
  'save game', 'serialization', 'data table', 'curve',
  'motion matching', 'control rig', 'ik', 'ragdoll',
  'post process', 'volumetric', 'fog', 'cloud', 'sky',
  'blueprint interface', 'event dispatcher', 'delegate',
  'enum', 'struct', 'array', 'map', 'set',
  'widget blueprint', 'anchor', 'canvas', 'slate',
  'cooking', 'pak', 'IoStore', 'shipping',
  'live link', 'motion capture', 'mocap',
  'pixel streaming', 'nDisplay', 'virtual production',
  'game instance', 'player state', 'hism', 'instancing',
  'spline', 'cable', 'rope', 'chain',
  'verse', 'uefn', 'fortnite creative',
  // Layer 1 additions: common "make X" verbs that imply game dev
  'create', 'build', 'spawn', 'place', 'add', 'setup', 'configure',
  'implement', 'design', 'prototype', 'iterate',
];

const UE5_ENGINE_REGEX = /unreal|ue5|ue4|blueprint|editor|game\s*dev|level\s*design|game\s*engine/i;

/**
 * Check whether a query is related to Unreal Engine 5.
 * Used as a gate before hybrid AI fallback to prevent hallucinations.
 * @param {string} query - The user's search query
 * @returns {boolean} true if the query appears UE5-relevant
 */
export function isQueryUE5Relevant(query) {
  const queryLower = query.toLowerCase();
  const hasDomainTerm = UE5_DOMAINS.some(d => queryLower.includes(d));
  const mentionsEngine = UE5_ENGINE_REGEX.test(query);
  return hasDomainTerm || mentionsEngine;
}

// ── Layer 2: Query Rewriter ──
// Expands vague queries into UE5-specific search terms so embedding
// search and hybrid generation produce relevant results.
// e.g. "How to make a horse" → "How to set up a horse skeletal mesh
// character in UE5 with animation blueprint and physics"
async function rewriteQueryForUE5(userQuery) {
  const prompt = `You are a UE5 search query optimizer. A student on an Unreal Engine 5 learning platform typed:
"${userQuery}"

This platform teaches UE5 via official video courses plus Epic documentation.
The student wants to do this IN Unreal Engine 5 (not in Blender, Maya, etc.).

Rewrite their query into a more specific UE5-focused form that would match relevant learning content.
Assume they want the Blueprint-based workflow (not C++ unless they said C++).
Assume assets come from FAB (Unreal Marketplace) or FBX import — NOT modeled from scratch.

Rules:
- Keep it as a natural search query (not a prompt)
- Add relevant UE5 terms (Blueprint, Skeletal Mesh, Static Mesh, Material, Actor, etc.)
- Max 20 words
- Return ONLY the rewritten query text, nothing else

Examples:
"How to make a horse" → "Setting up a horse skeletal mesh character with animation blueprint in UE5"
"sword" → "Creating a sword static mesh actor with collision and material in UE5"
"weather" → "Dynamic weather system with Niagara particles volumetric clouds and post process in UE5"
"cars" → "Vehicle blueprint setup with chaos vehicle movement component in UE5"`;

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");
    const result = await retryWithBackoff(() => classifyFn({ prompt }), {
      maxRetries: 1,
      baseDelayMs: 500,
      label: "queryRewrite",
    });
    const rewritten = (result.data?.text || "").trim().replace(/^["']|["']$/g, "");
    if (rewritten && rewritten.length > 5 && rewritten.length < 200) {
      devLog(`[BespokePath] Query rewritten: "${userQuery}" → "${rewritten}"`);
      recordTokenUsage("queryRewrite", Math.ceil(prompt.length / 4), Math.ceil(rewritten.length / 4));
      return rewritten;
    }
  } catch (err) {
    devWarn("[BespokePath] Query rewrite failed (non-fatal):", err.message);
  }
  return userQuery; // fallback: use original
}

// ── Phase 6: AI Content Quality Gate ──
// Validates hybrid AI-generated steps before showing to users.
// Catches hallucinated content (e.g., "horse accessories") that has no UE5 substance.
const UE5_CONTENT_REGEX = /blueprint|node|widget|material|actor|component|editor|viewport|content browser|details panel|niagara|lumen|nanite|sequencer|level|world|collision|physics|mesh|texture|shader|animation|skeletal|static mesh|game mode|pawn|character|player controller|event graph|variable|function|macro|interface|class|struct|enum|array|map/i;

function validateHybridStep(step, originalQuery) {
  const title = (step.segment?.title || '').toLowerCase();
  const queryWords = originalQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  // Check 1: Does the title contain at least one word from the original query?
  const titleRelevance = queryWords.some(w => title.includes(w));

  // Check 2: Is the title at least 3 words (not generic "Step 1" type)?
  const titleQuality = title.split(/\s+/).length >= 3;

  // Check 3: Does the summary mention UE5-specific terms?
  const summary = (step.summary || step.segment?.text || '').toLowerCase();
  const hasUE5Terms = UE5_CONTENT_REGEX.test(summary);

  return (titleRelevance || hasUE5Terms) && titleQuality;
}



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

  // Layer 2: Rewrite the query for better UE5 specificity BEFORE generating
  const rewrittenQuery = await rewriteQueryForUE5(userQuery);

  // Layer 3: Improved hybrid prompt with stronger UE5 grounding
  const prompt = `You are a UE5 curriculum designer creating a learning path for a STUDENT.
The student asked: "${userQuery}"
Interpreted as UE5 topic: "${rewrittenQuery}"

This is an Unreal Engine 5 learning platform. The student wants to achieve this IN the UE5 editor.

Create a course with 2-4 MODULES (chapters). Each module should answer ONE specific question or teach ONE specific skill.

For each step, specify:
- "module": A descriptive SEO-friendly module title. Example: "How to set up a Nav Mesh" or "Configuring AI Patrol Behavior"
- "category": One of "prerequisite", "core", or "practice" (used for ordering)
- "title": A 3-6 word gerund phrase for the specific lesson within the module
- "summary": 3-5 sentences, second person ("you"), plain text only
- "lessonType": One of "Video", "Quiz", "Walkthrough" (what type of content this lesson should be)

CRITICAL RULES:
1. TITLE FORMAT: 3-6 word gerund phrases. Examples: "Importing a Skeletal Mesh", "Setting Up Animation Blueprints", "Configuring Physics Assets".
2. MODULE TITLES: Must be descriptive and SEO-friendly. They should read like chapter titles, e.g. "How to set up a Nav Mesh" NOT "Understand" or "Implement".
3. Every title and summary MUST reference specific UE5 features: actual panel names (Details, Content Browser, Outliner), node names, property names, menu paths.
4. PRIORITIZE Blueprint-based approaches over C++ unless the query explicitly mentions C++.
5. ASSET ASSUMPTION: The student gets pre-made 3D assets from FAB (Unreal Marketplace) or imports FBX files. "Create/Make" means SETTING UP the asset in UE5 — NOT modeling from scratch. Never suggest Blender, Maya, or external modeling tools.
6. For "create/make [object]" queries:
   Step 1: Download from FAB or import an FBX of the object
   Step 2: Set up Materials in the Material Editor
   Step 3: Create a Blueprint Actor with the appropriate mesh component (Static Mesh or Skeletal Mesh)
   Step 4: Configure collision, physics, and gameplay properties
   Step 5: Place in the level and test
7. Each summary: 3-5 sentences, second person ("you"), plain text only — no markdown.
8. UE5 ONLY: Never reference UE4. All instructions must be UE5.5-specific.
9. NEVER generate content about real-world events, shows, competitions, or venues. Stay focused on the UE5 editor workflow.
10. Include at least ONE quiz lesson per module to verify understanding.
${adaptiveContext}

Return a JSON array:
[{"module": "How to Import and Set Up a Horse Character", "category": "prerequisite", "title": "Importing the Horse Skeletal Mesh", "summary": "Open the Content Browser and use the Import button to bring in your FBX horse model...", "lessonType": "Video"}]`;

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

      // ── Phase 0: Query Feasibility Gate (Layer 1) ──
      // Before generating from AI knowledge, verify the query is actually about UE5.
      // This prevents hallucinated paths for completely off-topic queries.
      const queryIsRelevant = isQueryUE5Relevant(userQuery);
      if (!queryIsRelevant) {
        devWarn(`[BespokePath] Feasibility gate BLOCKED query: "${userQuery}" — not UE5-relevant`);
        trackHybridFallbackTriggered({
          reason: 'feasibility_blocked',
          bestSimilarity,
          corpusSegments: segments.length,
        });
        result.error = "This topic doesn't appear to be related to Unreal Engine 5. Try adding UE5 context, like 'How to create a horse character in UE5' or 'Blueprint communication'.";
        result.feasibilityFailed = true;
        return result;
      }

      trackHybridFallbackTriggered({
        reason: hybridReason,
        bestSimilarity,
        corpusSegments: segments.length,
      });
      result.path = await generateHybridPath(userQuery, knowledgeProfile);
      result.isAiGenerated = true;
      result.aiGeneratedWarning = "⚠️ Generated from AI knowledge — not from our verified course library";

      // ── Phase 6: Quality Gate — filter out hallucinated steps ──
      const preFilterCount = result.path.length;
      result.path = result.path.filter(s => validateHybridStep(s, userQuery));
      if (preFilterCount !== result.path.length) {
        devLog(`[BespokePath] Quality gate filtered ${preFilterCount - result.path.length}/${preFilterCount} hybrid steps`);
        // Re-index remaining steps
        result.path = result.path.map((s, i) => ({ ...s, order: i }));
      }

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

      // Stage 3: Generate bridge narrations + gap analysis for hybrid path (parallel)
      devLog("[BespokePath] Stage 3: Generating narrations + gap analysis for hybrid path...");
      const [hybridBridges, hybridGaps, hybridPainPoints] = await Promise.allSettled([
        generateBridgeNarration(result.path, userQuery),
        analyzePathGaps(userQuery, result.path, knowledgeProfile),
        searchCommunityPainPoints(userQuery),
      ]);
      result.bridges = hybridBridges.status === "fulfilled" ? hybridBridges.value : [];
      result.gaps = hybridGaps.status === "fulfilled" ? hybridGaps.value : null;
      result.communityPainPoints =
        hybridPainPoints.status === "fulfilled" ? hybridPainPoints.value : [];

      devLog(`[BespokePath] Hybrid pipeline complete: ${result.path.length} AI-generated steps`);

      // ── Adapt to V2 schema ──
      result.v2Path = adaptBespokePath(result);
      result.v2Path.learnerGoal = userQuery;
      result.v2Path._originalQuery = userQuery;

      // ── Stage 5: Editorial enrichment ──
      devLog("[BespokePath] Stage 5: Running editorial pass...");
      result.v2Path = await runEditorialPass(result.v2Path)
        .catch((err) => { devWarn("[BespokePath] Editorial pass failed:", err.message); return result.v2Path; });

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

    // Stage 3: Gap analysis + community pain points (parallel)
    devLog("[BespokePath] Stage 3: Analyzing gaps + community pain points...");
    const [corpusGaps, corpusPainPoints] = await Promise.allSettled([
      analyzePathGaps(userQuery, result.path, knowledgeProfile),
      searchCommunityPainPoints(userQuery),
    ]);
    result.gaps = corpusGaps.status === "fulfilled" ? corpusGaps.value : null;
    result.communityPainPoints =
      corpusPainPoints.status === "fulfilled" ? corpusPainPoints.value : [];

    // ── Stage 3.5: Fill gaps with Gemini (only when no source content exists) ──
    const blindSpots = result.gaps?.blindSpots || [];
    if (blindSpots.length > 0) {
      devLog(`[BespokePath] Filling ${blindSpots.length} gap(s) with 3-tier engine...`);
      const existingCodes = result.path.map((s) => s.segment?.courseCode).filter(Boolean);
      const gapFills = await Promise.allSettled(
        blindSpots.slice(0, 3).map((gap) =>
          generateGapFillStep(gap.topic, userQuery, result.path, existingCodes)
        )
      );
      let filledCount = 0;
      for (let i = 0; i < gapFills.length; i++) {
        if (gapFills[i].status !== "fulfilled" || !gapFills[i].value) continue;
        const fill = gapFills[i].value;
        const gapTopic = blindSpots[i].topic;
        // Wrap the gap fill as a path step
        result.path.push({
          segment: {
            type: fill.source === "ai" ? "ai_generated" : "gap_fill",
            title: gapTopic,
            text: fill.summary || fill.segments?.[0]?.text || "",
            videoTitle: fill.segments?.[0]?.videoTitle || gapTopic,
            similarity: 0,
            gapFillSource: fill.source,
          },
          isAutoGapFill: true,
          category: "transfer",
          title: gapTopic,
          summary: fill.summary || fill.segments?.[0]?.text || `Learn about ${gapTopic}`,
          order: result.path.length,
        });
        blindSpots[i].filled = true;
        filledCount++;
      }
      if (filledCount > 0) {
        devLog(`[BespokePath] Filled ${filledCount} gap(s) — path now has ${result.path.length} steps`);
      }
    }

    // Stage 4: Generate bridge narrations (runs after gap fill so all steps get narrated)
    devLog("[BespokePath] Stage 4: Generating narrations...");
    result.bridges = await generateBridgeNarration(result.path, userQuery)
      .catch((err) => { devWarn("[BespokePath] Narration failed:", err.message); return []; });

    devLog(
      `[BespokePath] Pipeline complete: ${result.path.length} steps, ${result.bridges.length} bridges, gaps: ${blindSpots.length} (filled: ${blindSpots.length > 0 ? result.path.length - corpusSteps : 0})`
    );

    // ── Adapt to V2 schema ──
    result.v2Path = adaptBespokePath(result);
    result.v2Path.learnerGoal = userQuery;
    result.v2Path._originalQuery = userQuery;

    // ── Stage 5: Editorial enrichment ──
    devLog("[BespokePath] Stage 5: Running editorial pass...");
    result.v2Path = await runEditorialPass(result.v2Path)
      .catch((err) => { devWarn("[BespokePath] Editorial pass failed:", err.message); return result.v2Path; });

    return result;
  } catch (err) {
    devWarn("[BespokePath] Pipeline failed:", err.message);
    result.error = "Something went wrong generating your path. Please try again.";
    return result;
  }
}
