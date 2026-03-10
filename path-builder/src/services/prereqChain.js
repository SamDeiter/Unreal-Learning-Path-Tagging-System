/**
 * prereqChain.js — Prerequisite Chain Builder
 *
 * Builds a dependency graph between path steps using keyword overlap,
 * identifies floating steps and missing links.
 *
 * Exports:
 *   - buildPrereqChain()
 */

import { computeTopicOverlap } from "./pathSequencer";
import { devLog, devWarn } from "../utils/logger";

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
