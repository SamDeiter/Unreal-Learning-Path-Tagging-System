/**
 * communityPainPoints.js — Community Pain Point Search
 *
 * Searches UE5 forums and community sites for real learner struggles
 * using grounded Gemini search.
 *
 * Exports:
 *   - searchCommunityPainPoints()
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";
import { parseGeminiJSON } from "./gapDetection";

const PAIN_POINT_LIMIT = 5; // Max community pain points returned

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
