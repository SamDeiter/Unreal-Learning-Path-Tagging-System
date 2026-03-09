/**
 * pathGapAnalyzer.js — Path Intelligence Engine
 *
 * Detects blind spots, fills gaps, searches community pain points,
 * simulates persona perspectives, and builds prerequisite chains.
 *
 * All analysis is RAG-grounded: we vector-search each subtopic against
 * the corpus before identifying gaps. Gemini only classifies severity
 * and suggests fills — it never hallucinates what the gaps are.
 *
 * Functions:
 *   1. analyzePathGaps()        — Detect blind spots + coverage score
 *   2. generateGapFillStep()    — AI step to fill a specific gap
 *   3. searchCommunityPainPoints() — Grounded search for learner struggles
 *   4. simulatePersonaGaps()    — Re-run analysis from different personas
 *   5. buildPrereqChain()       — Dependency graph between steps
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { findRelevantSegments, SIMILARITY_THRESHOLD } from "./pathSearch";
import { computeTopicOverlap } from "./pathSequencer";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";

// ── Constants ────────────────────────────────────────────
const MAX_SUBTOPICS = 8; // Cap vector searches for cost control
const HIGH_SEVERITY_THRESHOLD = 0.5; // Below this = high severity gap
const GAP_FILL_TOP_K = 3; // Segments to fetch for gap context
const PAIN_POINT_LIMIT = 5; // Max community pain points returned

// Research context distilled from 8 papers (keeps prompt small)
const RESEARCH_CONTEXT = `Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial hell" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems`;

/**
 * Sanitize Gemini JSON output (same pattern as generateHybridPath).
 * @param {string} raw - Raw text from Gemini
 * @returns {Object|Array|null} Parsed JSON or null on failure
 */
function parseGeminiJSON(raw) {
  if (!raw) return null;

  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Fall through to sanitization
  }

  // Extract JSON object or array
  const match = raw.match(/[{[[\s\S]*[}\]]/);
  if (!match) return null;

  let jsonStr = match[0]
    .replace(/```json?\s*/gi, "") // strip code fences
    .replace(/```\s*/g, "") // strip closing fences
    .replace(/[\u201C\u201D]/g, '"') // smart quotes → straight
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/,\s*([}\]])/g, "$1"); // trailing commas

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Last-ditch: replace single-quoted keys
    jsonStr = jsonStr.replace(/'/g, '"');
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

/**
 * Extract key subtopics from a set of learning path steps.
 * Used for building searchable topic lists from the PATH's content.
 *
 * @param {Array} steps - Path steps with segment data
 * @param {string} query - The original user query (included as a topic)
 * @returns {string[]} Deduplicated subtopic strings (max MAX_SUBTOPICS)
 */
function extractSubtopics(steps, query) {
  const topics = new Set();

  // Always include the original query as a topic
  if (query) topics.add(query.trim());

  for (const step of steps) {
    const seg = step?.segment;
    if (!seg) continue;

    // Title is the best topic signal
    const title = seg.title || seg.videoTitle || "";
    if (title && title.length > 3) {
      topics.add(title.trim());
    }

    // Extract a topic from the summary/text if it looks different from the title
    const text = (step.summary || seg.text || "").substring(0, 150);
    if (text && text.length > 20) {
      // Use first sentence as a topic proxy
      const firstSentence = text.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        topics.add(firstSentence);
      }
    }
  }

  // Deduplicate by checking keyword overlap between topics
  const unique = [];
  const topicArray = [...topics];
  for (const topic of topicArray) {
    const isDuplicate = unique.some((existing) => computeTopicOverlap(existing, topic) > 0.6);
    if (!isDuplicate) {
      unique.push(topic);
    }
  }

  return unique.slice(0, MAX_SUBTOPICS);
}

/**
 * Use Gemini to generate what subtopics a learning query REQUIRES.
 * This is the key fix: instead of checking what the path has,
 * we check what the query NEEDS.
 *
 * @param {string} query - The user's learning goal
 * @returns {Promise<string[]>} Array of required subtopic strings
 */
async function generateRequiredSubtopics(query) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const prompt = `You are a UE5 curriculum expert. A learner wants to learn: "${query}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${query}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`;

    const result = await retryWithBackoff(() => classifyFn({ prompt }), {
      maxRetries: 1,
      baseDelayMs: 1500,
      label: "requiredSubtopics",
    });

    const responseText = result.data?.text || "";
    recordTokenUsage(
      "requiredSubtopics",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      devLog(`[GapAnalyzer] Generated ${parsed.length} required subtopics for "${query}"`);
      return parsed.slice(0, 12);
    }

    devWarn("[GapAnalyzer] Could not parse required subtopics, using fallback");
    return null;
  } catch (err) {
    devWarn("[GapAnalyzer] generateRequiredSubtopics failed:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 1. analyzePathGaps
// ═══════════════════════════════════════════════════════════

/**
 * Analyze a learning path for blind spots, assumed knowledge, and suggestions.
 *
 * NEW APPROACH: Instead of checking if path content exists in the corpus
 * (which always returns 100% since courses ARE the corpus), we:
 * 1. Ask Gemini what SUBTOPICS the query requires
 * 2. Check which of those subtopics the PATH's courses actually cover
 * 3. The uncovered required subtopics = gaps
 *
 * @param {string} query - The user's original question
 * @param {Array} steps - The sequenced path steps
 * @param {Object|null} profile - Knowledge profile { knows, gaps, level } or null
 * @returns {Promise<{blindSpots: Array, assumedKnowledge: Array, suggestions: Array, coverageScore: number, corpusStats: Object}>}
 */
export async function analyzePathGaps(query, steps, profile = null) {
  const emptyResult = {
    blindSpots: [],
    assumedKnowledge: [],
    suggestions: [],
    coverageScore: 1.0,
    corpusStats: { subtopicsChecked: 0, subtopicsCovered: 0, avgSimilarity: 0 },
  };

  try {
    if (!steps || steps.length === 0) return emptyResult;

    // 1. Generate what the query REQUIRES (via Gemini)
    const requiredSubtopics = await generateRequiredSubtopics(query);
    if (!requiredSubtopics || requiredSubtopics.length === 0) {
      devWarn("[GapAnalyzer] Could not generate required subtopics, falling back");
      return emptyResult;
    }

    devLog(`[GapAnalyzer] Required subtopics: ${requiredSubtopics.join(", ")}`);

    // 2. Extract what the PATH actually covers (from course titles/content)
    const pathTopics = extractSubtopics(steps, query);

    devLog(`[GapAnalyzer] Path covers: ${pathTopics.join(", ")}`);

    // 3. For each required subtopic, check if the path covers it
    //    Multiple strategies to catch coverage:
    //    a) computeTopicOverlap per-topic (keyword ratio)
    //    b) Substring containment in full path text (catches "AI Perception" in "AI Perception — AI Damage")
    //    c) Word-level hits with short keywords preserved (don't filter "ai", "ui", "vr")
    const covered = [];
    const gaps = [];

    // Build full text from ALL path content for aggregate matching
    const allPathText = steps
      .map((s) => {
        const seg = s?.segment;
        const title = seg?.title || seg?.videoTitle || "";
        const text = s?.summary || seg?.text || "";
        return `${title} ${text}`;
      })
      .join(" ")
      .toLowerCase();

    for (const required of requiredSubtopics) {
      const requiredLower = required.toLowerCase();
      // Keep words >= 2 chars (preserves "ai", "ui", "vr", "fx")
      const requiredWords = requiredLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2);

      // Strategy A: computeTopicOverlap against each path topic title
      let bestOverlap = 0;
      let bestMatch = "";
      for (const pathTopic of pathTopics) {
        const overlap = computeTopicOverlap(required, pathTopic);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = pathTopic;
        }
      }

      // Strategy B: Check if the required topic appears as a substring
      //   e.g. "ai perception" found in "ai perception — ai damage"
      const substringMatch =
        allPathText.includes(requiredLower) ||
        // Also check core phrase (first 2-3 significant words)
        (requiredWords.length >= 2 && allPathText.includes(requiredWords.slice(0, 3).join(" ")));

      // Strategy C: Word-level hits across ALL path text
      const wordHits = requiredWords.filter((w) => allPathText.includes(w)).length;
      const wordCoverage = requiredWords.length > 0 ? wordHits / requiredWords.length : 0;

      // Consider covered if ANY strategy succeeds:
      // - Topic overlap > 0.3 with a single course
      // - Substring match of the topic in full path text
      // - 70%+ of required words appear across all path content
      const isCovered = bestOverlap > 0.3 || substringMatch || wordCoverage >= 0.7;

      if (isCovered) {
        covered.push({
          topic: required,
          matchedTo: bestMatch || "(multiple courses)",
          confidence: Math.max(bestOverlap, wordCoverage, substringMatch ? 0.8 : 0),
        });
      } else {
        gaps.push({
          topic: required,
          bestOverlap,
          bestMatch: bestMatch || null,
          wordCoverage,
        });
      }
    }

    const coverageScore =
      requiredSubtopics.length > 0 ? covered.length / requiredSubtopics.length : 1.0;

    devLog(
      `[GapAnalyzer] Coverage: ${covered.length}/${requiredSubtopics.length} required topics covered (score: ${coverageScore.toFixed(2)})`
    );

    // 4. If no gaps found, return with coverage data
    if (gaps.length === 0) {
      return {
        ...emptyResult,
        coverageScore,
        corpusStats: {
          subtopicsChecked: requiredSubtopics.length,
          subtopicsCovered: covered.length,
          avgSimilarity: 0,
        },
      };
    }

    // 5. Ask Gemini to classify gap severity and suggest fills
    const levelContext = profile?.level
      ? `The learner's assessed level is: ${profile.level.toUpperCase()}.`
      : "Assume a beginner-level learner.";

    const gapSummary = gaps
      .map(
        (g) =>
          `- "${g.topic}" (best path match: ${g.bestMatch ? `"${g.bestMatch}" at ${g.bestOverlap.toFixed(2)} overlap` : "NONE"})`
      )
      .join("\n");

    const coveredSummary = covered
      .map((c) => `- "${c.topic}" (matched to: "${c.matchedTo}")`)
      .join("\n");

    const prompt = `You are a UE5 curriculum designer analyzing a learning path for the query: "${query}"

${levelContext}

${RESEARCH_CONTEXT}

TOPICS THE PATH COVERS WELL:
${coveredSummary || "(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${gapSummary}

Analyze these gaps and return a JSON object with:
1. "blindSpots": Array of objects for each gap topic:
   - "topic": The gap topic string
   - "severity": "high" (critical for the query), "medium" (helpful), or "low" (nice to have)
   - "reason": Why this gap matters for the learner (1 sentence)
   - "researchContext": Which research finding makes this important (1 sentence, reference the patterns above)
2. "assumedKnowledge": Array of strings — prerequisites the path assumes but never teaches
3. "suggestions": Array of objects:
   - "topic": Suggested addition
   - "priority": "high", "medium", or "low"
   - "rationale": Why this should be added (1 sentence)

RULES:
- Only classify gaps that were identified above — do NOT invent new gaps
- "high" severity = gap is directly related to the original query "${query}"
- "medium" severity = gap is a common prerequisite for this topic area
- "low" severity = gap is tangentially related but not blocking
- Keep responses concise — max 3 suggestions
- Return valid JSON only, no markdown fences`;

    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const geminiResult = await retryWithBackoff(() => classifyFn({ prompt }), {
      maxRetries: 1,
      baseDelayMs: 1500,
      label: "gapAnalysis",
    });

    const responseText = geminiResult.data?.text || "";
    recordTokenUsage(
      "gapAnalysis",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (!parsed) {
      devWarn("[GapAnalyzer] Failed to parse Gemini gap analysis response");
      // Return raw gap data without Gemini classification
      return {
        blindSpots: gaps.map((g) => ({
          topic: g.topic,
          severity: g.bestOverlap < 0.1 ? "high" : "medium",
          reason: "This required topic is not addressed by any course in the path",
          researchContext: "",
        })),
        assumedKnowledge: [],
        suggestions: [],
        coverageScore,
        corpusStats: {
          subtopicsChecked: requiredSubtopics.length,
          subtopicsCovered: covered.length,
          avgSimilarity: 0,
        },
      };
    }

    // 6. Return Gemini-classified results
    return {
      blindSpots: parsed.blindSpots || [],
      assumedKnowledge: parsed.assumedKnowledge || [],
      suggestions: (parsed.suggestions || []).slice(0, 3),
      coverageScore,
      corpusStats: {
        subtopicsChecked: requiredSubtopics.length,
        subtopicsCovered: covered.length,
        avgSimilarity: 0,
      },
    };
  } catch (err) {
    devWarn("[GapAnalyzer] analyzePathGaps failed:", err.message);
    return emptyResult;
  }
}

// ═══════════════════════════════════════════════════════════
// 2. generateGapFillStep
// ═══════════════════════════════════════════════════════════

/**
 * Generate an AI step to fill a specific identified gap.
 * RAG-grounded: fetches closest corpus matches first, then asks
 * Gemini to build upon them. Runs corpus verification after.
 *
 * @param {string} topic - The gap topic to fill
 * @param {string} query - The user's original question
 * @param {Array} steps - The existing path steps (for context)
 * @returns {Promise<Object|null>} A step matching the path step shape, or null on failure
 */
export async function generateGapFillStep(topic, query, steps) {
  try {
    devLog(`[GapAnalyzer] Generating fill step for gap: "${topic}"`);

    // 1. Fetch closest corpus matches as context
    let corpusContext = "";
    try {
      const { segments } = await findRelevantSegments(topic, GAP_FILL_TOP_K);
      if (segments.length > 0) {
        corpusContext = `\nRelated content from our corpus (use as reference):\n${segments
          .slice(0, 2)
          .map((s) => `- "${s.title || s.videoTitle}": ${(s.text || "").substring(0, 200)}`)
          .join("\n")}`;
      }
    } catch {
      // Non-fatal — generate without corpus context
    }

    // 2. Build Gemini prompt
    const existingTitles = steps
      .map((s) => s.segment?.title || s.segment?.videoTitle || "")
      .filter(Boolean)
      .join(", ");

    const prompt = `You are a UE5 curriculum designer. A learning path for "${query}" has a gap in: "${topic}"

Existing steps cover: ${existingTitles}
${corpusContext}

Generate a SINGLE learning step to fill this gap. Return a JSON object:
{
  "title": "Short descriptive title (3-6 words, gerund format like 'Understanding Blueprint Variables')",
  "category": "prerequisite" or "core" or "practice",
  "summary": "3-5 sentences teaching this concept directly. Plain text, no markdown. Include specific UE5 menu paths, property names, and node names where relevant."
}

RULES:
- The step must directly address "${topic}" in the context of "${query}"
- Do NOT repeat content already in the path
- Be specific to UE5 (not UE4)
- PRIORITIZE Blueprint-based approaches unless the topic is specifically about C++
- Return valid JSON only, no markdown fences`;

    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(() => classifyFn({ prompt, grounded: true }), {
      maxRetries: 1,
      baseDelayMs: 1500,
      label: "gapFillStep",
    });

    const responseText = result.data?.text || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    recordTokenUsage(
      "gapFillStep",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (!parsed || !parsed.title) {
      devWarn("[GapAnalyzer] Failed to parse gap fill step response");
      return null;
    }

    // 3. Build step in path-compatible shape
    const stepSources = [];
    if (groundingMetadata?.sources?.length > 0) {
      (groundingMetadata.supports || []).forEach((support) => {
        (support.sourceIndices || []).forEach((idx) => {
          if (groundingMetadata.sources[idx]) {
            const src = groundingMetadata.sources[idx];
            if (!stepSources.some((s) => s.url === src.url)) {
              stepSources.push(src);
            }
          }
        });
      });
    }

    const step = {
      segment: {
        id: `gap-fill-${Date.now()}`,
        type: "ai_generated",
        title: parsed.title,
        text: parsed.summary,
        source: "ai_generated",
        sources: stepSources.length > 0 ? stepSources : undefined,
        corpusVerified: false,
      },
      category: parsed.category || "core",
      summary: parsed.summary,
      order: steps.length,
      isGapFill: true,
    };

    // 4. Corpus verification — same pattern as bespokePathService.js
    try {
      const { segments: verifyMatches } = await findRelevantSegments(
        parsed.summary || parsed.title,
        1
      );
      if (verifyMatches.length > 0 && verifyMatches[0].similarity >= SIMILARITY_THRESHOLD) {
        const best = verifyMatches[0];
        step.segment.corpusVerified = true;
        step.segment.corpusMatch = {
          videoTitle: best.videoTitle || best.title || "",
          videoUrl: best.videoUrl || best.url || "",
          similarity: best.similarity,
        };
        devLog(
          `[GapAnalyzer] Gap-fill verified: "${parsed.title}" ↔ "${best.videoTitle || best.title}" (${best.similarity.toFixed(3)})`
        );
      }
    } catch {
      // Non-fatal — step stays unverified
    }

    devLog(`[GapAnalyzer] Gap fill step generated: "${parsed.title}" [${step.category}]`);
    return step;
  } catch (err) {
    devWarn("[GapAnalyzer] generateGapFillStep failed:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 3. searchCommunityPainPoints
// ═══════════════════════════════════════════════════════════

/**
 * Search UE5 forums and community sites for real learner pain points.
 * Uses the existing classifySegments CF with grounded: true for
 * web search — no new infrastructure needed.
 *
 * @param {string} topic - The topic to search for community struggles
 * @returns {Promise<Array<{painPoint: string, sourceUrl: string, sourceTitle: string, relevance: string}>>}
 */
export async function searchCommunityPainPoints(topic) {
  try {
    devLog(`[GapAnalyzer] Searching community pain points for: "${topic}"`);

    const prompt = `Search for the most common struggles, confusion points, and pain points that Unreal Engine 5 learners experience with: "${topic}"

SEARCH PRIORITY:
1. forums.unrealengine.com (Epic's official forums)
2. Reddit r/unrealengine
3. Epic Developer Community
4. YouTube comments on UE5 tutorials

Return a JSON array of the top ${PAIN_POINT_LIMIT} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "relevance": "high" or "medium" or "low"
}]

RULES:
- Focus on LEARNER confusion, not engine bugs
- Prioritize problems that affect beginners and intermediates
- Each pain point should be a specific, actionable insight (not vague like "it's hard")
- Return valid JSON only, no markdown fences`;

    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(() => classifyFn({ prompt, grounded: true }), {
      maxRetries: 1,
      baseDelayMs: 1500,
      label: "communityPainPoints",
    });

    const responseText = result.data?.text || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    recordTokenUsage(
      "communityPainPoints",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (!parsed || !Array.isArray(parsed)) {
      devWarn("[GapAnalyzer] Failed to parse community pain points response");
      return [];
    }

    // Enrich with grounding source URLs
    const sources = groundingMetadata?.sources || [];
    const painPoints = parsed.slice(0, PAIN_POINT_LIMIT).map((pp, i) => ({
      painPoint: pp.painPoint || pp.pain_point || "",
      sourceUrl: sources[i]?.url || "",
      sourceTitle: sources[i]?.title || "",
      relevance: pp.relevance || "medium",
    }));

    devLog(`[GapAnalyzer] Found ${painPoints.length} community pain points`);
    return painPoints;
  } catch (err) {
    devWarn("[GapAnalyzer] searchCommunityPainPoints failed:", err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 4. simulatePersonaGaps
// ═══════════════════════════════════════════════════════════

/**
 * Re-run gap analysis from a different persona perspective.
 * Uses the same knowledgeProfile format as useAdaptiveQuiz:
 *   { knows: [], gaps: [], level: "beginner"|"intermediate"|"advanced" }
 *
 * @param {string} query - The user's original question
 * @param {Array} steps - The path steps
 * @param {string} persona - "beginner", "intermediate", or "advanced"
 * @returns {Promise<Object>} Same shape as analyzePathGaps()
 */
export async function simulatePersonaGaps(query, steps, persona = "beginner") {
  // Build a synthetic knowledge profile for the persona
  const personaProfile = {
    level: persona,
    knows: [],
    gaps: [],
  };

  // Persona-specific gap assumptions
  switch (persona) {
    case "beginner":
      personaProfile.gaps = [
        "editor_navigation",
        "blueprint_basics",
        "project_structure",
        "asset_pipeline",
      ];
      break;
    case "intermediate":
      personaProfile.gaps = ["optimization", "advanced_blueprints"];
      personaProfile.knows = ["editor_navigation", "blueprint_basics", "material_basics"];
      break;
    case "advanced":
      personaProfile.knows = [
        "editor_navigation",
        "blueprint_basics",
        "material_basics",
        "animation_basics",
        "optimization",
        "advanced_blueprints",
      ];
      break;
    default:
      break;
  }

  devLog(`[GapAnalyzer] Simulating gaps for persona: ${persona}`);
  return analyzePathGaps(query, steps, personaProfile);
}

// ═══════════════════════════════════════════════════════════
// 5. buildPrereqChain
// ═══════════════════════════════════════════════════════════

/**
 * Build a dependency graph between path steps.
 * Uses keyword overlap (computeTopicOverlap) to detect edges,
 * and identifies floating steps that lack prerequisites.
 *
 * @param {Array} steps - The path steps
 * @returns {Promise<{nodes: Array, edges: Array, floatingSteps: number[], missingLinks: Array}>}
 */
export async function buildPrereqChain(steps) {
  const emptyResult = { nodes: [], edges: [], floatingSteps: [], missingLinks: [] };

  try {
    if (!steps || steps.length === 0) return emptyResult;

    // 1. Build nodes
    const nodes = steps.map((step, i) => ({
      id: i,
      title: step.segment?.title || step.segment?.videoTitle || step.title || `Step ${i + 1}`,
      category: step.category || "foundation",
    }));

    // 2. Build edges based on topic overlap between consecutive and non-consecutive steps
    const edges = [];
    const STRONG_THRESHOLD = 0.4;
    const WEAK_THRESHOLD = 0.15;

    for (let i = 0; i < steps.length; i++) {
      const textA = `${steps[i].segment?.title || ""} ${steps[i].segment?.text || steps[i].summary || ""}`;

      for (let j = i + 1; j < steps.length; j++) {
        const textB = `${steps[j].segment?.title || ""} ${steps[j].segment?.text || steps[j].summary || ""}`;
        const overlap = computeTopicOverlap(textA, textB);

        if (overlap >= WEAK_THRESHOLD) {
          edges.push({
            from: i,
            to: j,
            strength: overlap >= STRONG_THRESHOLD ? "strong" : "weak",
            overlap: Number(overlap.toFixed(3)),
          });
        }
      }
    }

    // 3. Identify floating steps (no inbound edges)
    const hasInbound = new Set(edges.map((e) => e.to));
    const floatingSteps = nodes
      .filter((n) => n.id > 0 && !hasInbound.has(n.id)) // Step 0 is always a root
      .map((n) => n.id);

    // 4. Identify missing links — consecutive steps with no edge between them
    const missingLinks = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const hasEdge = edges.some(
        (e) => (e.from === i && e.to === i + 1) || (e.from === i + 1 && e.to === i)
      );
      if (!hasEdge) {
        missingLinks.push({
          from: i,
          to: i + 1,
          suggestedBridge: `Bridge between "${nodes[i].title}" and "${nodes[i + 1].title}"`,
        });
      }
    }

    devLog(
      `[GapAnalyzer] Prereq chain: ${nodes.length} nodes, ${edges.length} edges, ${floatingSteps.length} floating, ${missingLinks.length} missing links`
    );

    return { nodes, edges, floatingSteps, missingLinks };
  } catch (err) {
    devWarn("[GapAnalyzer] buildPrereqChain failed:", err.message);
    return emptyResult;
  }
}
