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

/**
 * Stage 1: Find relevant segments across all embedding collections.
 * Calls embedQuery → then vectorSearchSegments + vectorSearchEpic + vectorSearchDocs.
 *
 * @param {string} userQuery - The user's natural language question
 * @param {number} topK - Results per collection (default 5)
 * @returns {Promise<{segments: Array, embedding: number[]}>}
 */
export async function findRelevantSegments(userQuery, topK = 5) {
  if (!userQuery?.trim()) return { segments: [], embedding: [] };

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");

  // Step 1a: Get embedding for the query
  let queryVector;
  try {
    const embedFn = httpsCallable(functions, "embedQuery");
    const embedResult = await embedFn({ text: userQuery });
    queryVector = embedResult.data?.embedding;
    if (!queryVector) throw new Error("No embedding returned");
    devLog(`[BespokePath] Got ${queryVector.length}-dim embedding for query`);
  } catch (err) {
    devWarn("[BespokePath] embedQuery failed:", err.message);
    return { segments: [], embedding: [] };
  }

  // Step 1b: Run parallel vector searches
  const [segResults, epicResults, docsResults] = await Promise.allSettled([
    httpsCallable(functions, "vectorSearchSegments")({ queryVector, topK }),
    httpsCallable(functions, "vectorSearchEpic")({ queryVector, topK }),
    httpsCallable(functions, "vectorSearchDocs")({ queryVector, topK }),
  ]);

  const segments = [];

  // Collect segment (transcript) results
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

  // Collect Epic Learning results
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

  // Collect docs results
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

  // Sort by similarity, take top results
  segments.sort((a, b) => b.similarity - a.similarity);
  devLog(`[BespokePath] Found ${segments.length} total segments across all sources`);

  return { segments: segments.slice(0, topK * 3), embedding: queryVector };
}

/**
 * Stage 2: Sequence and classify segments into a learning path.
 * Uses Gemini to categorize each segment (Foundation → Diagnosis → Fix → Transfer)
 * and order them into a coherent curriculum.
 *
 * @param {string} userQuery - Original user question
 * @param {Array} segments - Raw segments from Stage 1
 * @returns {Promise<Array<{segment: Object, category: string, order: number}>>}
 */
export async function sequencePath(userQuery, segments) {
  if (!segments || segments.length === 0) return [];

  // Build context for Gemini
  const segmentSummaries = segments
    .map((s, i) => {
      const source =
        s.type === "transcript"
          ? `Video: ${s.videoTitle} (${s.startTimestamp || ""})`
          : s.type === "epic_learning"
            ? `Article: ${s.title}`
            : `Docs: ${s.title} > ${s.section}`;
      return `[${i}] ${source}\n   ${s.text.slice(0, 200)}...`;
    })
    .join("\n\n");

  const prompt = `You are a UE5 curriculum designer. A learner asked: "${userQuery}"

Here are ${segments.length} content segments found via semantic search:

${segmentSummaries}

Classify each segment into ONE of these categories:
- foundation: Background concepts the learner needs first
- diagnosis: How to identify the specific problem or concept
- fix: Step-by-step solution or implementation
- transfer: How this knowledge applies to other contexts

Return a JSON array of objects with this format:
[{"index": 0, "category": "foundation", "relevance": "high|medium|low"}]

Rules:
- Include only segments with "high" or "medium" relevance
- Order: foundation → diagnosis → fix → transfer
- Max ${MAX_PATH_SEGMENTS} segments total
- Min ${MIN_PATH_SEGMENTS} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics`;

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "extractIntent");

    // Reuse extractIntent with a custom prompt
    const result = await classifyFn({ text: prompt });
    const responseText = result.data?.intent || result.data?.text || "";

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
          sequenced.push({
            segment: segments[c.index],
            category: c.category,
            order: sequenced.length,
          });
        }
      }
    }

    devLog(`[BespokePath] Sequenced ${sequenced.length} segments into learning path`);
    return sequenced;
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
    const narrateFn = httpsCallable(functions, "extractIntent");

    const prompt = `You are a UE5 instructor creating bridge narrations for a learning path.
The learner asked: "${userQuery}"

Generate a short (1-2 sentence) transition for each step:
${transitions.map((t) => `Step ${t.from + 1} (${t.fromCategory}) → Step ${t.to + 1} (${t.toCategory}): "${t.fromText}..." → "${t.toText}..."`).join("\n")}

Return a JSON array: [{"from": 0, "to": 1, "narration": "..."}]
Keep narrations natural, concise, and helpful. Max 50 words each.`;

    const result = await narrateFn({ text: prompt });
    const responseText = result.data?.intent || result.data?.text || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const narrations = JSON.parse(jsonMatch[0]);
      devLog(`[BespokePath] Generated ${narrations.length} AI bridge narrations`);
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
 * Full pipeline: generate a complete bespoke learning path.
 * Orchestrates all 3 stages and returns a ready-to-render path.
 *
 * @param {string} userQuery - The learner's question
 * @returns {Promise<{query: string, segments: Array, path: Array, bridges: Array, error: string|null}>}
 */
export async function generateBespokePath(userQuery) {
  const result = {
    query: userQuery,
    segments: [],
    path: [],
    bridges: [],
    error: null,
    generatedAt: new Date().toISOString(),
  };

  try {
    // Stage 1: Find relevant content
    devLog("[BespokePath] Stage 1: Finding relevant segments...");
    const { segments } = await findRelevantSegments(userQuery);
    result.segments = segments;

    if (segments.length === 0) {
      result.error =
        "No relevant content found for your question. Try rephrasing or being more specific.";
      return result;
    }

    // Stage 2: Sequence into learning path
    devLog("[BespokePath] Stage 2: Sequencing path...");
    result.path = await sequencePath(userQuery, segments);

    if (result.path.length === 0) {
      result.error =
        "Found content but couldn't build a coherent path. Try a more focused question.";
      return result;
    }

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
