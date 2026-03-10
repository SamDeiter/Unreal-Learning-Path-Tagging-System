/**
 * gapFill.js — 3-Tier Gap Fill Engine
 *
 * Tries Library → Bespoke → AI in order to fill identified gaps.
 *
 * Exports:
 *   - generateGapFillStep()
 *   - generateBespokeGapStep()
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { findRelevantSegments, SIMILARITY_THRESHOLD } from "./pathSearch";
import { findSimilarCourses } from "./semanticSearchService";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";
import { parseGeminiJSON } from "./gapDetection";

const GAP_FILL_TOP_K = 3; // Segments to fetch for gap context

export async function generateGapFillStep(topic, query, steps, existingCodes = []) {
  try {
    devLog(`[GapFill] 3-tier fill for gap: "${topic}"`);
    const pathCodeSet = new Set(existingCodes);

    // ── Tier 1: Library Search ─────────────────────────────
    try {
      const app = getFirebaseApp();
      const functions = getFunctions(app, "us-central1");
      const embedFn = httpsCallable(functions, "embedQuery");
      const embedResult = await embedFn({ text: topic });
      const embedding = embedResult.data?.embedding;

      if (embedding) {
        const courseMatches = await findSimilarCourses(embedding, 5);
        // Filter out courses already in path + require decent similarity
        const filtered = courseMatches.filter(
          (c) => c.similarity >= 0.4 && !pathCodeSet.has(c.code)
        );
        if (filtered.length > 0) {
          devLog(`[GapFill] Tier 1 HIT — ${filtered.length} library courses for "${topic}"`);
          return { source: "library", matchedCourses: filtered };
        }
        devLog(`[GapFill] Tier 1 MISS — no library matches above 0.4 for "${topic}"`);
      }
    } catch (err) {
      devWarn(`[GapFill] Tier 1 failed, falling through: ${err.message}`);
    }

    // ── Tier 2: Bespoke Segments ───────────────────────────
    try {
      const { segments } = await findRelevantSegments(topic, 5);
      const relevant = segments.filter((s) => (s.similarity || 0) >= 0.35);
      if (relevant.length > 0) {
        devLog(`[GapFill] Tier 2 HIT — ${relevant.length} segments for "${topic}"`);
        return {
          source: "bespoke",
          segments: relevant.map((s) => ({
            title: s.title || s.videoTitle || "Untitled",
            text: (s.text || "").substring(0, 300),
            videoTitle: s.videoTitle || "",
            videoUrl: s.videoUrl || "",
            similarity: s.similarity || 0,
          })),
        };
      }
      devLog(`[GapFill] Tier 2 MISS — no segments above 0.35 for "${topic}"`);
    } catch (err) {
      devWarn(`[GapFill] Tier 2 failed, falling through: ${err.message}`);
    }

    // ── Tier 3: AI-Generated Step ──────────────────────────
    devLog(`[GapFill] Tier 3 — generating AI step for "${topic}"`);

    // Fetch corpus context if available
    let corpusContext = "";
    try {
      const { segments: ctxSegs } = await findRelevantSegments(topic, GAP_FILL_TOP_K);
      if (ctxSegs.length > 0) {
        corpusContext = `\nRelated content from our corpus:\n${ctxSegs
          .slice(0, 2)
          .map((s) => `- "${s.title || s.videoTitle}": ${(s.text || "").substring(0, 200)}`)
          .join("\n")}`;
      }
    } catch {
      /* non-fatal */
    }

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

    const responseText = result.data?.text || result.data?.response || "";
    const groundingMetadata = result.data?.groundingMetadata || null;

    recordTokenUsage(
      "gapFillStep",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    if (!responseText) {
      devWarn("[GapFill] Empty AI response");
      return {
        source: "ai",
        step: {
          segment: { title: `Learn: ${topic}`, text: `Study ${topic} in context of ${query}.` },
          category: "core",
          isGapFill: true,
        },
      };
    }

    let parsed = parseGeminiJSON(responseText);
    if (!parsed || !parsed.title) {
      parsed = {
        title: `Understanding ${topic}`,
        summary: responseText
          .replace(/```json?|```/gi, "")
          .trim()
          .slice(0, 500),
        category: "core",
      };
    }

    // Grounding sources
    const stepSources = [];
    if (groundingMetadata?.sources?.length > 0) {
      (groundingMetadata.supports || []).forEach((support) => {
        (support.sourceIndices || []).forEach((idx) => {
          if (groundingMetadata.sources[idx]) {
            const src = groundingMetadata.sources[idx];
            if (!stepSources.some((s) => s.url === src.url)) stepSources.push(src);
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

    // Corpus verification
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
      }
    } catch {
      /* non-fatal */
    }

    devLog(`[GapFill] Tier 3 AI step: "${parsed.title}" [${step.category}]`);
    return { source: "ai", step };
  } catch (err) {
    devWarn("[GapFill] generateGapFillStep failed:", err.message);
    return null;
  }
}

export function generateBespokeGapStep(topic, segments) {
  const bestSegment = segments[0];
  const combinedText = segments
    .slice(0, 3)
    .map((s) => s.text || "")
    .filter(Boolean)
    .join("\n\n");

  return {
    code: `bespoke-${Date.now()}`,
    title: `${topic} (Bespoke)`,
    description: combinedText.substring(0, 500) || `Bespoke step covering ${topic}`,
    type: "bespoke_segment",
    role: "core",
    duration_seconds: segments.length * 300, // ~5 min per segment
    tags: { level: "Intermediate", industry: "General" },
    isBespoke: true,
    isGapFill: true,
    sourceSegments: segments.map((s) => ({
      title: s.title,
      videoTitle: s.videoTitle,
      videoUrl: s.videoUrl,
      similarity: s.similarity,
    })),
    // Reference to the best segment's video
    videoTitle: bestSegment?.videoTitle || "",
    videoUrl: bestSegment?.videoUrl || "",
  };
}
