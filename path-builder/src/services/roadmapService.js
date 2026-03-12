/**
 * roadmapService.js — Frontend orchestrator for goal-first learning roadmaps.
 *
 * Architecture: "LLM plans the roadmap, RAG fills each node."
 *
 * 1. Calls queryLearningPath Cloud Function with mode: "goal-build"
 * 2. Receives roadmap skeleton (4-6 milestones)
 * 3. For each milestone: calls generateBespokePath(searchQuery)
 * 4. Returns assembled roadmap with micro-paths
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { generateBespokePath } from "./bespokePathService";
import { devLog, devWarn } from "../utils/logger";

// ── Goal-build intent detection (mirrors backend routing.js) ────────

const GOAL_BUILD_INDICATORS = [
  "new to ue5",
  "new to unreal",
  "beginner",
  "from scratch",
  "first game",
  "first project",
  "want to make",
  "want to build",
  "want to create",
  "want to learn",
  "learn unreal",
  "learn ue5",
  "just starting",
  "getting started",
  "how do i start",
  "where do i start",
  "roadmap",
  "learning path for",
  "complete beginner",
  "never used unreal",
  "teach me",
];

const PROBLEM_INDICATORS = [
  "error", "crash", "bug", "broken", "not working", "fails",
  "doesn't", "won't", "can't", "issue", "problem", "fix",
  "debug", "null", "access violation", "flicker", "artifact",
];

/**
 * Detect if a query should route to goal-build mode.
 * @param {string} query
 * @returns {boolean}
 */
export function isGoalBuildQuery(query) {
  if (!query) return false;
  const q = query.toLowerCase();
  const hasGoal = GOAL_BUILD_INDICATORS.some((ind) => q.includes(ind));
  const hasProblem = PROBLEM_INDICATORS.some((ind) => q.includes(ind));
  return hasGoal && !hasProblem;
}

// ── Roadmap generation ──────────────────────────────────────────────

/**
 * Generate a goal-first learning roadmap.
 *
 * Step 1: Get roadmap skeleton from backend (LLM planner)
 * Step 2: Fill each milestone with a bespoke micro-path (RAG)
 *
 * @param {string} query - Broad learner goal
 * @param {object} [options]
 * @param {string} [options.persona] - Optional persona ID
 * @param {function} [options.onMilestoneReady] - Callback when a milestone path is filled
 * @returns {Promise<object>} Complete roadmap with micro-paths
 */
export async function generateRoadmap(query, options = {}) {
  const { persona, onMilestoneReady } = options;

  devLog("[Roadmap] Starting goal-build flow for:", query);

  // ── Step 1: Get roadmap skeleton from backend ──
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  const queryFn = httpsCallable(functions, "queryLearningPath");

  const skeletonResult = await queryFn({
    query,
    mode: "goal-build",
    persona,
  });

  const skeleton = skeletonResult.data;
  if (!skeleton?.success || !skeleton?.roadmap?.length) {
    throw new Error("Failed to generate roadmap skeleton");
  }

  devLog(`[Roadmap] Got skeleton: ${skeleton.roadmap.length} milestones, title: "${skeleton.title}"`);

  // ── Step 2: Fill each milestone with a bespoke micro-path ──
  const filledRoadmap = { ...skeleton };

  // Process milestones progressively (not all at once to manage load)
  for (let i = 0; i < filledRoadmap.roadmap.length; i++) {
    const milestone = filledRoadmap.roadmap[i];
    devLog(`[Roadmap] Filling milestone ${i + 1}/${filledRoadmap.roadmap.length}: "${milestone.title}"`);

    try {
      const pathResult = await generateBespokePath(milestone.searchQuery);

      milestone.microPath = {
        path: pathResult.path || [],
        v2Path: pathResult.v2Path || null,
        bridges: pathResult.bridges || [],
        gaps: pathResult.gaps,
        isAiGenerated: pathResult.isAiGenerated || false,
        stepCount: pathResult.path?.length || 0,
      };
      milestone.coverage = {
        status: pathResult.path?.length >= 3 ? "good" : pathResult.path?.length >= 1 ? "partial" : "weak",
        corpusSteps: pathResult.path?.filter(s => s.segment?.type !== "ai_generated").length || 0,
        totalSteps: pathResult.path?.length || 0,
      };

      devLog(`[Roadmap] Milestone ${i + 1} filled: ${milestone.coverage.totalSteps} steps (${milestone.coverage.status})`);
    } catch (err) {
      devWarn(`[Roadmap] Failed to fill milestone ${i + 1}:`, err.message);
      milestone.microPath = null;
      milestone.coverage = { status: "error", error: err.message };
    }

    // Notify caller of progressive updates
    if (onMilestoneReady) {
      onMilestoneReady(i, milestone, { ...filledRoadmap });
    }
  }

  devLog("[Roadmap] All milestones filled. Roadmap complete.");
  return filledRoadmap;
}
