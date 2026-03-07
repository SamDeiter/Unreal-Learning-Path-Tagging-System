/**
 * stepBriefingService.js — Per-step audio and key takeaways generation.
 *
 * - generateStepAudio(): Calls generateAudioBriefing CF with mode="step"
 * - generateStepTakeaways(): Calls extractIntent CF for key learning points
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { retryWithBackoff } from "../utils/retryWithBackoff";

/**
 * Generate a short audio briefing for a single learning path step.
 *
 * @param {Object} step - The path step object
 * @param {string} query - The original user query
 * @param {Object} [options] - Optional position + source info
 * @param {string} [options.stepPosition] - "first" | "middle" | "last"
 * @param {Array}  [options.sourceLinks]  - [{title, url}] for further reading
 * @returns {Promise<string|null>} Blob URL for the audio, or null on failure
 */
export async function generateStepAudio(step, query, options = {}) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const genFn = httpsCallable(functions, "generateAudioBriefing", { timeout: 60000 });

    const payload = {
      mode: "step",
      query,
      stepContent: step.summary || step.segment?.text || "",
      stepCategory: step.category || "learning",
      stepTitle: step.segment?.title || step.segment?.videoTitle || "",
    };

    if (options.stepPosition) payload.stepPosition = options.stepPosition;
    if (options.sourceLinks?.length) payload.sourceLinks = options.sourceLinks;
    if (options.voiceName) payload.voiceName = options.voiceName;

    const result = await retryWithBackoff(() => genFn(payload), {
      maxRetries: 2,
      label: "stepAudio",
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
 * Generate deep-dive sub-sections for a learning path step.
 *
 * @param {Object} step - The path step object
 * @param {string} query - The original user query
 * @returns {Promise<Array|null>} Array of {title, content, type}, or null on failure
 */
export async function generateStepDeepDive(step, query, options = {}) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const genFn = httpsCallable(functions, "generateAudioBriefing", { timeout: 60000 });

    const payload = {
      mode: "deepdive",
      query,
      stepContent: step.summary || step.segment?.text || "",
      stepCategory: step.category || "learning",
      stepTitle: step.segment?.title || step.segment?.videoTitle || "",
    };
    if (options.userLevel) payload.userLevel = options.userLevel;
    if (options.existingTakeaways?.length) payload.existingTakeaways = options.existingTakeaways;

    const result = await retryWithBackoff(() => genFn(payload), {
      maxRetries: 2,
      label: "stepDeepDive",
    });

    if (result.data?.sections?.length) {
      devLog(`[DeepDive] Generated ${result.data.sections.length} sub-sections`);
      return {
        sections: result.data.sections,
        editorContext: result.data.editorContext || "",
      };
    }
    return null;
  } catch (err) {
    devWarn("[DeepDive] Generation failed:", err.message);
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
    const fn = httpsCallable(functions, "generateAudioBriefing");

    const content = step.summary || step.segment?.text || step.description || "";
    const actionSteps = step.action || step.segment?.action || "";

    const title = step.segment?.title || step.segment?.videoTitle || "this topic";
    devLog(
      `[Takeaways] Requesting for "${title}" (content length: ${content.length}, category: ${step.category})`
    );

    const result = await retryWithBackoff(
      () =>
        fn({
          mode: "takeaways",
          query,
          stepContent: content,
          stepCategory: step.category || "learning",
          stepAction: actionSteps,
          stepTitle: title,
        }),
      { maxRetries: 2, label: "stepTakeaways" }
    );

    devLog("[Takeaways] CF response:", JSON.stringify(result.data)?.substring(0, 200));

    if (result.data?.takeaways && Array.isArray(result.data.takeaways)) {
      devLog("[Takeaways] Generated", result.data.takeaways.length, "takeaways");
      return result.data.takeaways.slice(0, 3);
    }

    devWarn("[Takeaways] CF returned no takeaways array, using content-aware fallback");
    return buildContentAwareFallback(step, title);
  } catch (err) {
    devWarn("[Takeaways] CF call failed:", err.message);
    return buildContentAwareFallback(
      step,
      step.segment?.title || step.segment?.videoTitle || "this topic"
    );
  }
}

/**
 * Build takeaways from the step's own content rather than using generic boilerplate.
 * Extracts key sentences and frames them by category.
 */
function buildContentAwareFallback(step, title) {
  const text = step.summary || step.segment?.text || "";
  const category = step.category || "learning";

  // Extract first 2-3 meaningful sentences from the content
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20 && s.length < 200)
    .slice(0, 5);

  if (sentences.length >= 2) {
    const categoryVerb =
      {
        prerequisite: "Understand",
        foundation: "Understand",
        diagnosis: "Identify",
        core: "Apply",
        fix: "Apply",
        practice: "Practice",
        transfer: "Extend",
      }[category] || "Review";

    // Build takeaways from actual content
    const takeaways = [];

    // First takeaway: extract the core concept from the first sentence
    takeaways.push(
      `${categoryVerb}: ${sentences[0].replace(/^(This|In this|The)\s+/i, "").trim()}`
    );

    // Second takeaway: actionable item from the content
    if (sentences.length > 1) {
      takeaways.push(sentences[1].trim());
    }

    // Third takeaway: encourage hands-on practice with specifics
    const ue5Terms = text.match(
      /\b(Material Editor|Blueprint|Niagara|Lumen|Nanite|World Partition|Level Streaming|Animation Blueprint|Behavior Tree|Widget Blueprint|Sequencer|MetaSound|Chaos|Mass Entity|PCG|Water System|Foliage|Data Table)\b/i
    );
    if (ue5Terms) {
      takeaways.push(
        `Open ${ue5Terms[0]} in UE5 and experiment with the settings discussed in "${title}"`
      );
    } else if (sentences.length > 2) {
      takeaways.push(sentences[2].trim());
    } else {
      takeaways.push(
        `Practice these concepts in a UE5 test project focused on ${title.toLowerCase()}`
      );
    }

    return takeaways.slice(0, 3);
  }

  // Last resort: at least reference the title meaningfully
  return [
    `Focus on understanding the core techniques covered in "${title}"`,
    `Create a test project to practice ${title.toLowerCase()} hands-on`,
    `Note any UE5 editor settings or properties mentioned for future reference`,
  ];
}

/**
 * Generate a cohesive 2-phase narration for a learning path.
 * Phase 1 = Questions (foundation/diagnosis steps)
 * Phase 2 = Solution (fix/transfer steps)
 * User-triggered (not automatic) to control costs.
 *
 * @param {Object} pathResult - The full path result object
 * @param {string} query - The original user query
 * @returns {Promise<Map<number, {script: string, audioUrl: string|null, phase: string}>|null>}
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

    devLog("[PathNarration] Requesting 2-phase narration for", steps.length, "steps");

    const result = await retryWithBackoff(() => genFn({ mode: "narrate", query, steps }), {
      maxRetries: 1,
      label: "pathNarration",
    });

    if (result.data?.phases && Array.isArray(result.data.phases)) {
      const narrationMap = new Map();

      // Helper: convert base64 audio to blob URL
      const toBlobUrl = (base64) => {
        if (!base64) return null;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/wav" });
        return URL.createObjectURL(blob);
      };

      // Map each phase to the step indices that belong to it
      for (const phase of result.data.phases) {
        const audioUrl = toBlobUrl(phase.audio);
        const phaseCategories =
          phase.phase === "questions" ? ["foundation", "diagnosis"] : ["fix", "transfer"];

        // Assign this narration to all steps matching this phase's categories
        pathResult.path.forEach((step, idx) => {
          if (phaseCategories.includes(step.category)) {
            narrationMap.set(idx, {
              script: phase.script || "",
              audioUrl,
              phase: phase.phase,
            });
          }
        });
      }

      devLog(
        "[PathNarration] Mapped",
        narrationMap.size,
        "steps to",
        result.data.phases.length,
        "phases"
      );
      return narrationMap;
    }

    return null;
  } catch (err) {
    devWarn("[PathNarration] Generation failed:", err.message);
    return null;
  }
}
