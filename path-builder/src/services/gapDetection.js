/**
 * gapDetection.js — Gap Detection Engine
 *
 * Detects blind spots in learning paths by comparing what a query
 * REQUIRES (via Gemini) against what the path actually COVERS
 * (via keyword overlap and substring matching).
 *
 * Exports:
 *   - analyzePathGaps()
 *   - extractSubtopics()           (internal helper, exported for testing)
 *   - generateRequiredSubtopics()  (internal helper, exported for testing)
 *   - parseGeminiJSON()            (shared utility)
 *   - RESEARCH_LABELS              (UI tooltip map)
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { computeTopicOverlap } from "./pathSequencer";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";

// ── Constants ────────────────────────────────────────────
export const MAX_SUBTOPICS = 8; // Cap vector searches for cost control
const HIGH_SEVERITY_THRESHOLD = 0.5; // Below this = high severity gap

// Research context distilled from 8+ papers (keeps prompt small)
export const RESEARCH_CONTEXT = `Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;

// Maps research pattern names to short explanations for UI tooltips
export const RESEARCH_LABELS = {
  blooms_gap: "Path stays at Remember/Understand — needs Apply/Create activities",
  spaced_practice: "Topics compressed without review breaks — retention risk",
  transfer_gap: "Skill only shown in one context — won't transfer to new scenarios",
  scaffold_removal: "Never removes guided support — creates tutorial dependency",
  assessment_mismatch: "Assessment tests lower skills than what's taught",
  cognitive_overload: "Too much content without chunking — attention loss after 6 min",
  tutorial_limbo: "Step-by-step without independent practice — stuck in limbo, can't apply alone",
  missing_why: "Procedural 'how' without conceptual 'why' — fragile understanding",
  assumed_prereq: "Prerequisites assumed, not taught — editor nav, asset pipeline, etc.",
};

/**
 * Sanitize Gemini JSON output (same pattern as generateHybridPath).
 * @param {string} raw - Raw text from Gemini
 * @returns {Object|Array|null} Parsed JSON or null on failure
 */
export function parseGeminiJSON(raw) {
  if (!raw) return null;

  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Fall through to sanitization
  }

  // Extract JSON object or array
  const match = raw.match(/[{[\s\S]*[}\]]/);
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
export function extractSubtopics(steps, query) {
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
export async function generateRequiredSubtopics(query) {
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

export async function analyzePathGaps(query, steps, profile = null) {
  const emptyResult = {
    blindSpots: [],
    assumedKnowledge: [],
    suggestions: [],
    weaklyCovered: [],
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
    const weaklyCovered = [];

    // Fetch augmentation data to check course quality
    let augData = null;
    try {
      const augRes = await fetch(`${import.meta.env.BASE_URL}augmentation_summary.json`);
      if (augRes.ok) {
        const raw = await augRes.json();
        augData = {};
        for (const v of raw.videos || []) {
          if (!augData[v.course]) augData[v.course] = { totalScore: 0, count: 0 };
          augData[v.course].totalScore += v.score || 0;
          augData[v.course].count++;
        }
      }
    } catch {
      /* augmentation data is optional */
    }

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
        // Check augmentation quality of the matching course
        let augWeak = false;
        let augGrade = null;
        let augScore = null;
        if (augData && bestMatch) {
          // Find the course code from the matched path topic
          const matchedStep = steps.find((s) => {
            const seg = s?.segment;
            const title = (seg?.title || seg?.videoTitle || "").toLowerCase();
            return title.includes(bestMatch.toLowerCase().slice(0, 10));
          });
          const courseCode = matchedStep?.segment?.courseSlug || matchedStep?.segment?.course || "";
          if (courseCode && augData[courseCode]) {
            const avg = Math.round(augData[courseCode].totalScore / augData[courseCode].count);
            augScore = avg;
            augGrade = avg >= 45 ? "A" : avg >= 39 ? "B" : avg >= 33 ? "C" : avg >= 22 ? "D" : "F";
            augWeak = augGrade === "D" || augGrade === "F";
          }
        }

        if (augWeak) {
          weaklyCovered.push({
            topic: required,
            matchedTo: bestMatch || "(multiple courses)",
            confidence: Math.max(bestOverlap, wordCoverage, substringMatch ? 0.8 : 0),
            augGrade,
            augScore,
            reason: `Covered by course material rated ${augGrade} (${augScore}/55) — pedagogy needs augmentation`,
          });
        } else {
          covered.push({
            topic: required,
            matchedTo: bestMatch || "(multiple courses)",
            confidence: Math.max(bestOverlap, wordCoverage, substringMatch ? 0.8 : 0),
          });
        }
      } else {
        gaps.push({
          topic: required,
          bestOverlap,
          bestMatch: bestMatch || null,
          wordCoverage,
        });
      }
    }

    // Weak coverage counts as half coverage
    const effectiveCovered = covered.length + weaklyCovered.length * 0.5;
    const coverageScore =
      requiredSubtopics.length > 0 ? effectiveCovered / requiredSubtopics.length : 1.0;

    devLog(
      `[GapAnalyzer] Coverage: ${covered.length} strong + ${weaklyCovered.length} weak + ${gaps.length} gaps out of ${requiredSubtopics.length} required topics (score: ${coverageScore.toFixed(2)})`
    );

    // 4. If no gaps found, return with coverage data
    if (gaps.length === 0 && weaklyCovered.length === 0) {
      return {
        ...emptyResult,
        coverageScore,
        weaklyCovered,
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
        weaklyCovered,
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
      weaklyCovered,
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
