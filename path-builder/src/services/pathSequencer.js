/**
 * pathSequencer.js — Stage 2: Classify & Sequence
 *
 * Uses Gemini to categorize segments into Foundation → Diagnosis → Fix → Transfer
 * and orders them into a coherent learning path.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { validatePathQuality } from "../utils/pathQualityValidator";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { MAX_PATH_SEGMENTS, MIN_PATH_SEGMENTS } from "./pathSearch";

// ── Constants ──────────────────────────────────────────────────────────
export const SEGMENT_CATEGORIES = ["foundation", "diagnosis", "fix", "transfer"];

// Minimum keyword overlap between user query and a classified step's text.
// Steps below this threshold are demoted to "low" relevance — catches
// semantically-similar but topically-wrong content that the AI failed to reject.
const TOPIC_OVERLAP_THRESHOLD = 0.3;

// Stop words excluded from topical overlap computation
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "and",
  "or",
  "not",
  "is",
  "it",
  "be",
  "as",
  "do",
  "has",
  "was",
  "are",
  "but",
  "if",
  "my",
  "this",
  "that",
  "how",
  "what",
  "when",
  "where",
  "why",
  "can",
  "will",
  "so",
  "no",
  "up",
  "out",
  "its",
  "i",
  "me",
  "you",
  "your",
  "we",
  "they",
  "their",
  "about",
  "use",
  "using",
  "used",
  "make",
  "get",
  "set",
]);

/**
 * Compute keyword overlap between a user query and classified step text.
 * Returns a ratio (0–1) of query keywords found in the step text.
 *
 * @param {string} queryText - The user's original query
 * @param {string} stepText - The classified step's title + summary text
 * @returns {number} Overlap ratio (0 = no keywords match, 1 = all match)
 */
export function computeTopicOverlap(queryText, stepText) {
  if (!queryText || !stepText) return 0;

  const tokenize = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return 1; // trivial query, skip check

  const stepTokenSet = new Set(tokenize(stepText));
  const matches = queryTokens.filter((t) => stepTokenSet.has(t)).length;
  return matches / queryTokens.length;
}

/**
 * Stage 2: Sequence and classify segments into a learning path.
 * Uses Gemini to categorize each segment (Foundation → Diagnosis → Fix → Transfer)
 * and order them into a coherent curriculum.
 *
 * @param {string} userQuery - Original user question
 * @param {Array} segments - Raw segments from Stage 1
 * @param {Object} [knowledgeProfile] - Optional adaptive profile { knows, gaps, level }
 * @returns {Promise<Array<{segment: Object, category: string, order: number}>>}
 */
export async function sequencePath(userQuery, segments, knowledgeProfile = null) {
  if (!segments || segments.length === 0) return [];

  // Build context for Gemini — give it enough text to summarize from
  const segmentSummaries = segments
    .map((s, i) => {
      const source =
        s.type === "transcript"
          ? `Video: ${s.videoTitle} (${s.startTimestamp || ""})`
          : s.type === "epic_learning"
            ? `Article: ${s.title}`
            : `Docs: ${s.title} > ${s.section}`;
      return `[${i}] ${source}\n   ${s.text.slice(0, 2000)}`;
    })
    .join("\n\n");

  // Build adaptive depth instructions when knowledge profile is available
  let adaptiveInstructions = "";
  if (knowledgeProfile) {
    const { knows = [], gaps = [], level = "beginner" } = knowledgeProfile;
    adaptiveInstructions = `\n\nADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${level.toUpperCase()}
${knows.length > 0 ? `\nConcepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):\n${knows.map((c) => `  - ${c.replace(/_/g, " ")}`).join("\n")}` : ""}
${gaps.length > 0 ? `\nKnowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):\n${gaps.map((c) => `  - ${c.replace(/_/g, " ")}`).join("\n")}` : ""}

Depth rules based on level:
${level === "beginner" ? "- Start with absolute basics. Explain every concept. More foundation steps." : ""}
${level === "intermediate" ? "- Skip basic introductions. Focus on practical application and diagnosis." : ""}
${level === "advanced" ? "- Skip all basics. Go straight to advanced techniques, edge cases, and optimization." : ""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`;
  }

  const prompt = `You are a UE5 curriculum designer. A learner asked: "${userQuery}"

Here are ${segments.length} content segments found via semantic search:

${segmentSummaries}

Classify each segment and write a DIRECT TEACHING SUMMARY for each. Do NOT describe the article or video — TEACH the concept yourself using the source material.

Categories:
- foundation: Background concepts the learner needs first
- diagnosis: How to identify the specific problem or concept
- fix: Step-by-step solution or implementation
- transfer: How this knowledge applies to other contexts

Return a JSON array of objects with this format:
[{"index": 0, "category": "foundation", "relevance": "high|medium|low", "summary": "A direct mini-lesson that teaches the concept. Extract the actual knowledge from the source and present it as clear instruction — explain what it is, how it works, and what the learner should do. Write 3-5 sentences in second person (you/your). No markdown formatting."}]

Rules:
- WORKFLOW INTENT MATCHING (CRITICAL): Before classifying, determine the learner's IMPLIED WORKFLOW from their query.
  ASSET ASSUMPTION: Assume learners already have a Static Mesh from FAB (Unreal Marketplace) or a Skeletal Mesh they imported. "Create/make [object]" means setting up and using an existing asset in a project, NOT modeling from scratch or generating 2D shapes.
  Common intent→workflow mappings:
  "create/make [3D object]" → Import FBX from FAB, Static Mesh setup, Materials, Blueprint actor, collision
  "customize appearance" → Materials, Material Editor, texture parameters
  "animate [object]" → Skeletal Mesh, Animation Blueprint, Sequencer
  "add interaction" → Blueprint, Collision, Overlap Events
  If a segment teaches a DIFFERENT tool than the implied workflow, mark it "low" relevance even if semantically similar. Mismatches to reject:
  - Texture Graph for 3D object creation (Texture Graph makes 2D procedural patterns, not 3D mesh setup)
  - Customizable Objects for basic item setup (advanced runtime customization system, not beginner workflow)
  - Control Rig for simple animation playback
  - Niagara for non-particle-related queries
  - Modeling Mode unless the query specifically asks about modeling/sculpting geometry
- TOPICAL RELEVANCE CROSS-CHECK (CRITICAL): Before marking a segment "high" or "medium", verify it teaches the SAME CONCEPT the user asked about — not just a related concept.
  Semantically similar ≠ topically relevant. Examples of FALSE MATCHES to reject as "low":
  - Query: "time dilation" → Segment about Delay nodes (pausing execution ≠ slowing world time)
  - Query: "physics simulation" → Segment about animation physics (ragdoll ≠ rigid body sim)
  - Query: "networking" → Segment about Blueprint communication (actor messaging ≠ multiplayer replication)
  - Query: "LOD" → Segment about Nanite (automatic virtualized geometry ≠ manual LOD setup)
  If the segment's PRIMARY topic is a different UE5 system/concept than what the user asked about, mark it "low" even if it shares vocabulary.
- PRIORITIZE Blueprint-based content over C++ content unless the query explicitly asks about C++. When teaching concepts, explain using Blueprint nodes, property panels, and editor UI rather than code syntax.
- BLUEPRINT PRECISION: Blueprints ARE a form of programming (visual scripting). NEVER say 'without code' or 'no code needed'. Instead say 'without writing C++ or text-based code'. Blueprints are visual code.
- NEVER start a summary with 'This article...' or 'This video...' or 'This segment...' — teach the concept directly
- Write as if YOU are the instructor explaining the concept, not describing someone else's content
- Include specific technical details, property names, menu paths, or code patterns from the source
- ANTI-HALLUCINATION (CRITICAL):
  - ONLY reference UE5 tools, properties, nodes, volumes, and menu items that are EXPLICITLY mentioned in the source text above
  - Do NOT invent or assume UE5 features. If a concept is not in the source text, do NOT mention it
  - Do NOT fabricate volume types, component names, or editor features that are not in the provided segments
  - When in doubt, be LESS specific rather than inventing details
  - Every UE5-specific term in your summary must trace back to a word in the source segments
- DEDUPLICATION: Do NOT assign the same segment to more than one category. Each segment index may appear at most once in your output. If a segment could fit multiple categories, assign it to the BEST-fitting one only.
- Include only segments with "high" or "medium" relevance
- Order: foundation → diagnosis → fix → transfer
- You MUST include at least ONE segment of each category (foundation, diagnosis, fix, transfer)
- If no segment perfectly fits "transfer", pick the one that best teaches prevention or broader application
- Max ${MAX_PATH_SEGMENTS} segments total
- Min ${MIN_PATH_SEGMENTS} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks${adaptiveInstructions}`;

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(() => classifyFn({ prompt, grounded: true }), {
      maxRetries: 2,
      baseDelayMs: 1500,
      label: "classifySegments",
    });
    const responseText = result.data?.text || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      devWarn("[BespokePath] Could not parse classification JSON, using fallback ordering");
      return fallbackSequence(segments);
    }

    const classifications = JSON.parse(jsonMatch[0]);

    // ── POST-CLASSIFICATION TOPICAL CROSS-CHECK ──
    // Code-level guardrail: even if Gemini rated a step as "high" relevance,
    // demote it if the step text has <30% keyword overlap with the user query.
    // This catches false semantic matches the AI prompt instructions missed.
    let demotedCount = 0;
    for (const c of classifications) {
      if (c.relevance === "low" || c.index < 0 || c.index >= segments.length) continue;
      const stepText = `${c.summary || ""} ${segments[c.index]?.title || ""} ${segments[c.index]?.videoTitle || ""} ${segments[c.index]?.text?.slice(0, 500) || ""}`;
      const overlap = computeTopicOverlap(userQuery, stepText);
      if (overlap < TOPIC_OVERLAP_THRESHOLD) {
        devWarn(
          `[BespokePath] Topical cross-check rejected: "${segments[c.index]?.title || segments[c.index]?.videoTitle || "(untitled)"}" (overlap: ${(overlap * 100).toFixed(0)}%)`
        );
        c.relevance = "low";
        demotedCount++;
      }
    }
    if (demotedCount > 0) {
      devLog(`[BespokePath] Topical cross-check demoted ${demotedCount} step(s) to low relevance`);
    }

    const sequenced = [];

    // Build ordered path by category
    for (const category of SEGMENT_CATEGORIES) {
      const matching = classifications
        .filter((c) => c.category === category && c.relevance !== "low")
        .sort((a, b) => {
          // Within category, sort by relevance then similarity
          if (a.relevance !== b.relevance) return a.relevance === "high" ? -1 : 1;
          return (segments[b.index]?.similarity || 0) - (segments[a.index]?.similarity || 0);
        });

      for (const c of matching) {
        if (c.index >= 0 && c.index < segments.length && sequenced.length < MAX_PATH_SEGMENTS) {
          // Attach grounding sources to this corpus step if available
          const stepSources = [];
          if (groundingMetadata?.sources?.length > 0) {
            const stepText = (c.summary || segments[c.index].text || "").toLowerCase();
            (groundingMetadata.supports || []).forEach((support) => {
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

          const seg = { ...segments[c.index] };
          if (stepSources.length > 0) {
            seg.sources = stepSources;
          }

          sequenced.push({
            segment: seg,
            category: c.category,
            summary: c.summary || "", // AI-generated step summary
            order: sequenced.length,
          });
        }
      }
    }

    devLog(`[BespokePath] Sequenced ${sequenced.length} segments into learning path`);

    // ── POST-GENERATION QUALITY GATE ──
    const { cleanedPath, warnings, autoFixes } = validatePathQuality(sequenced, segments);
    if (autoFixes.length > 0) {
      devLog(`[BespokePath] Quality gate applied ${autoFixes.length} auto-fix(es):`, autoFixes);
    }
    if (warnings.length > 0) {
      devWarn(`[BespokePath] Quality gate warnings:`, warnings);
    }

    // Track: sequencing prompt is large, response is small JSON
    recordTokenUsage(
      "sequencePath",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );
    return cleanedPath;
  } catch (err) {
    devWarn("[BespokePath] sequencePath failed:", err.message);
    return fallbackSequence(segments);
  }
}

/**
 * Fallback sequencing when AI classification fails.
 * Uses similarity ranking with a simple heuristic ordering.
 */
function fallbackSequence(segments) {
  const top = segments.slice(0, MAX_PATH_SEGMENTS);
  return top.map((segment, i) => ({
    segment,
    category: SEGMENT_CATEGORIES[Math.min(Math.floor(i / 2), SEGMENT_CATEGORIES.length - 1)],
    order: i,
  }));
}
