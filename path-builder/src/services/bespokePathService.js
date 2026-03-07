/**
 * bespokePathService.js — 3-Stage Bespoke Learning Path Pipeline
 *
 * Stage 1: findRelevantSegments() — vector search via Cloud Functions
 * Stage 2: sequencePath()         — Gemini classifies & orders clips
 * Stage 3: generateBridgeNarration() — AI narration between segments
 *
 * Each stage is independent and can fail gracefully.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { validatePathQuality } from "../utils/pathQualityValidator";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import {
  trackVectorSearchCompleted,
  trackHybridFallbackTriggered,
  trackPathSequenced,
  trackAICoverageReport,
} from "./analyticsService";

// ── Constants ──────────────────────────────────────────────────────────
const SEGMENT_CATEGORIES = ["foundation", "diagnosis", "fix", "transfer"];
const MAX_PATH_SEGMENTS = 8;
const MIN_PATH_SEGMENTS = 3;
const FALLBACK_NARRATION_TEMPLATES = {
  "foundation→diagnosis":
    "Now that you understand the core concept, let's look at how to identify when things go wrong.",
  "diagnosis→fix": "With the problem identified, here's how to resolve it step by step.",
  "fix→transfer":
    "Great — you've fixed the issue. Let's see how this knowledge applies to other scenarios.",
  default: "Let's continue to the next part of your learning path.",
};

// Minimum cosine similarity for a segment to be considered a "good" match.
// Raised to 0.70 — rejects weak semantic matches (e.g., "time dilation" ≠ "delay nodes").
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Stage 1: Find relevant segments across all embedding collections.
 * Calls embedQuery → then vectorSearchSegments + vectorSearchEpic + vectorSearchDocs.
 *
 * When a knowledgeProfile with gaps is provided, a SECOND search is run using
 * only the gap terms. Results are merged (gap-sourced segments get a 1.5x boost)
 * so the sequencing stage has gap-relevant content to choose from.
 *
 * @param {string} userQuery - The user's natural language question
 * @param {number} topK - Results per collection (default 5)
 * @param {Object} [knowledgeProfile] - Optional adaptive profile { knows, gaps, level }
 * @returns {Promise<{segments: Array, embedding: number[], lowCorpusCoverage: boolean}>}
 */
export async function findRelevantSegments(userQuery, topK = 5, knowledgeProfile = null) {
  if (!userQuery?.trim()) return { segments: [], embedding: [] };

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");

  // Helper: embed a query string and return the vector
  async function getEmbedding(query) {
    const embedFn = httpsCallable(functions, "embedQuery");
    const embedResult = await retryWithBackoff(() => embedFn({ query }), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: "embedQuery",
    });
    recordTokenUsage("embedQuery", Math.ceil(query.length / 4), 0);
    return embedResult.data?.embedding;
  }

  // Helper: run vector search across all 3 collections
  async function searchAllCollections(queryVector) {
    const [segResults, epicResults, docsResults] = await Promise.allSettled([
      httpsCallable(functions, "vectorSearchSegments")({ queryVector, topK }),
      httpsCallable(functions, "vectorSearchEpic")({ queryVector, topK }),
      httpsCallable(functions, "vectorSearchDocs")({ queryVector, topK }),
    ]);

    const segments = [];

    if (segResults.status === "fulfilled" && segResults.value?.data?.results) {
      for (const r of segResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "transcript",
          courseCode: r.course_code,
          videoKey: r.video_key,
          videoTitle: r.video_title || "",
          startTimestamp: r.start_timestamp,
          endTimestamp: r.end_timestamp,
          startSeconds: r.start_seconds,
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    if (epicResults.status === "fulfilled" && epicResults.value?.data?.results) {
      for (const r of epicResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "epic_learning",
          title: r.title || "",
          url: r.url || "",
          contentType: r.content_type || "",
          author: r.author || "",
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    if (docsResults.status === "fulfilled" && docsResults.value?.data?.results) {
      for (const r of docsResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "docs",
          slug: r.slug || "",
          url: r.url || "",
          title: r.title || "",
          section: r.section || "",
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    return segments;
  }

  // ── Primary search: user's original query ──
  let queryVector;
  try {
    queryVector = await getEmbedding(userQuery);
    if (!queryVector) throw new Error("No embedding returned");
    devLog(`[BespokePath] Got ${queryVector.length}-dim embedding for query`);
  } catch (err) {
    devWarn("[BespokePath] embedQuery failed:", err.message);
    return { segments: [], embedding: [] };
  }

  const TRANSCRIPT_BOOST = 1.3;
  let segments = await searchAllCollections(queryVector);

  // ── Evaluate corpus quality from PRIMARY search only ──
  // This must happen BEFORE merging gap results, otherwise the gap boost
  // inflates scores and prevents hybrid fallback when the corpus actually
  // lacks content for the user's topic.
  const primaryBoosted = segments.map((seg) => ({
    ...seg,
    _score: seg.type === "transcript" ? seg.similarity * TRANSCRIPT_BOOST : seg.similarity,
  }));
  const primaryBest =
    primaryBoosted.length > 0 ? Math.max(...primaryBoosted.map((s) => s._score)) : 0;
  const lowCorpusCoverage = primaryBest < SIMILARITY_THRESHOLD;

  if (lowCorpusCoverage) {
    devWarn(
      `[BespokePath] Low corpus coverage: best primary similarity ${primaryBest.toFixed(3)} < ${SIMILARITY_THRESHOLD}`
    );
  }

  // ── Secondary search: gap-specific terms (only when adaptive) ──
  // This ensures the segment pool always contains gap-relevant content,
  // even when the user's phrasing doesn't semantically match the gap concepts.
  if (knowledgeProfile?.gaps?.length > 0) {
    const gapQuery = knowledgeProfile.gaps.map((g) => g.replace(/_/g, " ")).join(", ");
    devLog(`[BespokePath] Running gap-specific search: "${gapQuery}"`);

    try {
      const gapVector = await getEmbedding(gapQuery);
      if (gapVector) {
        const gapSegments = await searchAllCollections(gapVector);
        // Boost gap-sourced segments so they rank above generic query matches
        const GAP_BOOST = 1.5;
        for (const seg of gapSegments) {
          seg.similarity *= GAP_BOOST;
          seg._gapSourced = true;
        }
        devLog(`[BespokePath] Gap search returned ${gapSegments.length} segments`);
        segments = segments.concat(gapSegments);
      }
    } catch (err) {
      devWarn("[BespokePath] Gap-specific search failed (non-fatal):", err.message);
    }
  }

  // Deduplicate by id (keep the higher-similarity version)
  const segmentMap = new Map();
  for (const seg of segments) {
    const existing = segmentMap.get(seg.id);
    if (!existing || seg.similarity > existing.similarity) {
      segmentMap.set(seg.id, seg);
    }
  }
  segments = Array.from(segmentMap.values());

  // Boost transcript segments so video content ranks higher than articles
  for (const seg of segments) {
    if (seg.type === "transcript" && !seg._gapSourced) {
      seg.similarity *= TRANSCRIPT_BOOST;
    }
    // Construct YouTube URL with timestamp for direct linking
    if (seg.type === "transcript" && seg.videoKey) {
      const t = Math.floor(seg.startSeconds || 0);
      seg.videoUrl = `https://youtube.com/watch?v=${seg.videoKey}&t=${t}`;
      seg.thumbnailUrl = `https://img.youtube.com/vi/${seg.videoKey}/mqdefault.jpg`;
    }
  }

  // Sort by similarity, take top results
  segments.sort((a, b) => b.similarity - a.similarity);

  const topSegments = segments.slice(0, topK * 3);

  devLog(
    `[BespokePath] Found ${topSegments.length} segments (primaryBest: ${primaryBest.toFixed(3)}, lowCoverage: ${lowCorpusCoverage})`
  );

  return { segments: topSegments, embedding: queryVector, lowCorpusCoverage };
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

/**
 * Stage 3: Generate bridge narration between path steps.
 * Creates transitional text to connect segments into a coherent narrative.
 *
 * @param {Array} sequencedPath - Output from Stage 2
 * @param {string} userQuery - Original question for context
 * @returns {Promise<Array<{from: number, to: number, narration: string}>>}
 */
export async function generateBridgeNarration(sequencedPath, userQuery) {
  if (!sequencedPath || sequencedPath.length < 2) return [];

  const bridges = [];

  // Build transitions needed
  const transitions = [];
  for (let i = 0; i < sequencedPath.length - 1; i++) {
    transitions.push({
      from: i,
      to: i + 1,
      fromCategory: sequencedPath[i].category,
      toCategory: sequencedPath[i + 1].category,
      fromText: sequencedPath[i].segment.text.slice(0, 150),
      toText: sequencedPath[i + 1].segment.text.slice(0, 150),
    });
  }

  // Try AI narration first
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const narrateFn = httpsCallable(functions, "classifySegments");

    const narrationPrompt = `You are a UE5 instructor creating bridge narrations for a learning path.
The learner asked: "${userQuery}"

Generate a short (1-2 sentence) transition for each step:
${transitions.map((t) => `Step ${t.from + 1} (${t.fromCategory}) → Step ${t.to + 1} (${t.toCategory}): "${t.fromText}..." → "${t.toText}..."`).join("\n")}

Return a JSON array: [{"from": 0, "to": 1, "narration": "..."}]
Keep narrations natural, concise, and helpful. Max 50 words each.`;

    const result = await retryWithBackoff(() => narrateFn({ prompt: narrationPrompt }), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: "bridgeNarration",
    });
    const responseText = result.data?.text || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const narrations = JSON.parse(jsonMatch[0]);
      devLog(`[BespokePath] Generated ${narrations.length} AI bridge narrations`);
      // Track: narration prompt + response
      recordTokenUsage(
        "bridgeNarration",
        Math.ceil(prompt.length / 4),
        Math.ceil(responseText.length / 4)
      );
      return narrations;
    }
  } catch (err) {
    devWarn("[BespokePath] AI narration failed, using templates:", err.message);
  }

  // Fallback: template-based narration
  for (const t of transitions) {
    const key = `${t.fromCategory}→${t.toCategory}`;
    bridges.push({
      from: t.from,
      to: t.to,
      narration: FALLBACK_NARRATION_TEMPLATES[key] || FALLBACK_NARRATION_TEMPLATES.default,
    });
  }

  return bridges;
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
