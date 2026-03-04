/**
 * stepBriefingService.js — Per-step audio and key takeaways generation.
 *
 * - generateStepAudio(): Calls generateAudioBriefing CF with mode="step"
 * - generateStepTakeaways(): Calls extractIntent CF for key learning points
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";

/**
 * Generate a short audio briefing for a single learning path step.
 *
 * @param {Object} step - The path step object
 * @param {string} query - The original user query
 * @returns {Promise<string|null>} Blob URL for the audio, or null on failure
 */
export async function generateStepAudio(step, query) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const genFn = httpsCallable(functions, "generateAudioBriefing", { timeout: 60000 });

    const result = await genFn({
      mode: "step",
      query,
      stepContent: step.summary || step.segment?.text || "",
      stepCategory: step.category || "learning",
      stepTitle: step.segment?.title || step.segment?.videoTitle || "",
    });

    if (result.data?.audio) {
      const binary = atob(result.data.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (err) {
    devWarn("[StepAudio] Generation failed:", err.message);
    return null;
  }
}

/**
 * Generate key takeaways for a single learning path step.
 *
 * @param {Object} step - The path step object
 * @param {string} query - The original user query
 * @returns {Promise<string[]>} Array of 2-3 takeaway strings
 */
export async function generateStepTakeaways(step, query) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const fn = httpsCallable(functions, "extractIntent");

    const content = step.summary || step.segment?.text || "";
    const prompt = `You are a UE5 instructor highlighting KEY TAKEAWAYS for a learner.

The learner asked: "${query}"
This is a ${step.category || "learning"} step:

"${content.substring(0, 600)}"

Generate exactly 3 key takeaways the learner MUST know from this step. Each takeaway should be:
- One concise sentence (under 15 words)
- Specific to the actual content (not generic advice)
- Actionable or insightful

Return ONLY a JSON array of 3 strings. Example:
["Takeaway one", "Takeaway two", "Takeaway three"]`;

    const result = await fn({ query: prompt });
    const text = result.data?.intent || "";

    // Parse JSON array from response
    const match = typeof text === "string" ? text.match(/\[.*\]/s) : null;
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        devLog("[Takeaways] Generated", parsed.length, "takeaways");
        return parsed.slice(0, 3);
      }
    }

    // If intent came back as an object (original extractIntent behavior),
    // create takeaways from it
    if (typeof text === "object" && text.goal) {
      return [
        text.goal,
        text.problem_description || "Review the step content carefully",
        `Key systems: ${(text.systems || []).join(", ") || "UE5 fundamentals"}`,
      ];
    }

    return [
      "Review this step carefully",
      "Pay attention to the specific details",
      "Practice applying this concept",
    ];
  } catch (err) {
    devWarn("[Takeaways] Generation failed:", err.message);
    return [
      "Review this step carefully",
      "Pay attention to the specific details",
      "Practice applying this concept",
    ];
  }
}

/**
 * Generate a cohesive multi-section narration for an entire learning path.
 * User-triggered (not automatic) to control costs.
 *
 * @param {Object} pathResult - The full path result object
 * @param {string} query - The original user query
 * @returns {Promise<Map<number, {script: string, audioUrl: string|null}>|null>}
 */
export async function generatePathNarration(pathResult, query) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const genFn = httpsCallable(functions, "generateAudioBriefing", { timeout: 300000 });

    // Build steps payload for the CF
    const steps = pathResult.path.map((step) => ({
      title: step.segment?.title || step.segment?.videoTitle || "",
      summary: step.summary || step.segment?.text?.substring(0, 300) || "",
      category: step.category || "learning",
    }));

    devLog("[PathNarration] Requesting narration for", steps.length, "steps");

    const result = await genFn({
      mode: "narrate",
      query,
      steps,
    });

    if (result.data?.sections && Array.isArray(result.data.sections)) {
      const narrationMap = new Map();

      for (const section of result.data.sections) {
        let audioUrl = null;
        if (section.audio) {
          const binary = atob(section.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/wav" });
          audioUrl = URL.createObjectURL(blob);
        }

        narrationMap.set(section.stepIndex, {
          script: section.script || "",
          audioUrl,
        });
      }

      devLog("[PathNarration] Generated", narrationMap.size, "sections");
      return narrationMap;
    }

    return null;
  } catch (err) {
    devWarn("[PathNarration] Generation failed:", err.message);
    return null;
  }
}
