/**
 * pathNarration.js — Stage 3: Bridge Narration
 *
 * Generates transitional text between path steps to create a
 * coherent narrative flow.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { retryWithBackoff } from "../utils/retryWithBackoff";

// ── Constants ──────────────────────────────────────────────────────────
const FALLBACK_NARRATION_TEMPLATES = {
  "foundation→diagnosis":
    "Now that you understand the core concept, let's look at how to identify when things go wrong.",
  "diagnosis→fix": "With the problem identified, here's how to resolve it step by step.",
  "fix→transfer":
    "Great — you've fixed the issue. Let's see how this knowledge applies to other scenarios.",
  default: "Let's continue to the next part of your learning path.",
};

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
        Math.ceil(narrationPrompt.length / 4),
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
