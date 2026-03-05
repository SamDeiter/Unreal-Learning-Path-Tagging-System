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

    const result = await genFn(payload);

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
    const fn = httpsCallable(functions, "generateAudioBriefing");

    const content = step.summary || step.segment?.text || step.description || "";
    const actionSteps = step.action || step.segment?.action || "";

    const result = await fn({
      mode: "takeaways",
      query,
      stepContent: content,
      stepCategory: step.category || "learning",
      stepAction: actionSteps,
    });

    if (result.data?.takeaways && Array.isArray(result.data.takeaways)) {
      devLog("[Takeaways] Generated", result.data.takeaways.length, "takeaways");
      return result.data.takeaways.slice(0, 3);
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

    const result = await genFn({
      mode: "narrate",
      query,
      steps,
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
