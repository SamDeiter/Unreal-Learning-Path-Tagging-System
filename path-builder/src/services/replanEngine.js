/**
 * replanEngine.js — Post-Checkpoint Path Replanning
 *
 * After each module checkpoint, determines what to do next based on
 * the learner's verdict. The replanning engine can:
 *   - Continue normally (pass)
 *   - Insert remediation steps (struggle)
 *   - Skip similar modules (irrelevant)
 *   - Flag for report (skipped)
 *
 * All decisions are logged to replanHistory[] for the effectiveness report.
 */

import { devLog, devWarn } from "../utils/logger";

// ── Replanning Actions ─────────────────────────────────────────────

/**
 * @typedef {Object} ReplanAction
 * @property {'continue'|'remediate'|'skip-similar'|'suggest-exit'|'flag'} type
 * @property {string} reason - Human-readable explanation
 * @property {Object} [remediation] - Steps to insert (for 'remediate' type)
 * @property {string[]} [skipModuleIds] - Module IDs to mark optional (for 'skip-similar')
 */

/**
 * Determine the replanning action based on a single checkpoint verdict.
 *
 * @param {Object} checkpoint - The completed ModuleCheckpoint
 * @param {Array} remainingModules - Modules still ahead in the path
 * @param {Array} allCheckpoints - All checkpoints so far (for pattern detection)
 * @returns {ReplanAction}
 */
export function determineAction(checkpoint, remainingModules = [], allCheckpoints = []) {
  const verdict = checkpoint.verdict;

  switch (verdict) {
    case "pass":
      return {
        type: "continue",
        reason: `Module "${checkpoint.moduleId}" passed — learner demonstrated understanding.`,
      };

    case "struggle": {
      // Check if confidence dropped or quiz failed
      const confDelta = checkpoint.confidenceAfter - checkpoint.confidenceBefore;
      const quizScore = checkpoint.quizResult.total > 0
        ? checkpoint.quizResult.correct / checkpoint.quizResult.total
        : null;

      let reason = `Learner struggled with "${checkpoint.moduleId}"`;
      if (quizScore !== null && quizScore < 0.67) {
        reason += ` (quiz: ${Math.round(quizScore * 100)}%)`;
      }
      if (confDelta < -1) {
        reason += ` (confidence dropped by ${Math.abs(confDelta)})`;
      }

      return {
        type: "remediate",
        reason: reason + ". Inserting remediation before next module.",
        remediation: buildRemediationSteps(checkpoint),
      };
    }

    case "irrelevant": {
      // Find similar modules in the remaining path to skip
      const currentModule = checkpoint.moduleId;
      const similarModuleIds = findSimilarModules(currentModule, remainingModules);

      // Check for consecutive irrelevant verdicts → suggest exit
      const recentVerdicts = allCheckpoints.slice(-3).map((cp) => cp.verdict);
      const consecutiveIrrelevant = recentVerdicts.filter((v) => v === "irrelevant").length;

      if (consecutiveIrrelevant >= 2) {
        return {
          type: "suggest-exit",
          reason: `${consecutiveIrrelevant} consecutive modules marked irrelevant. The path may not address the learner's actual problem.`,
          skipModuleIds: similarModuleIds,
        };
      }

      return {
        type: "skip-similar",
        reason: `Module "${currentModule}" didn't help with the learner's issue. Marking ${similarModuleIds.length} similar modules as optional.`,
        skipModuleIds: similarModuleIds,
      };
    }

    case "skipped":
      return {
        type: "flag",
        reason: `Module "${checkpoint.moduleId}" was skipped without completing the checkpoint.`,
      };

    default:
      devWarn(`[ReplanEngine] Unknown verdict: ${verdict}`);
      return { type: "continue", reason: "Unknown verdict — continuing." };
  }
}

// ── Apply Replanning ───────────────────────────────────────────────

/**
 * Apply a replanning action to the current path state.
 *
 * @param {ReplanAction} action - The action to apply
 * @param {Object} pathState - Current path state object (mutable)
 * @returns {Object} Updated path state with applied changes
 */
export function applyReplan(action, pathState) {
  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: action.type,
    reason: action.reason,
  };

  const updatedHistory = [...(pathState.replanHistory || []), historyEntry];

  switch (action.type) {
    case "continue":
    case "flag":
      return { ...pathState, replanHistory: updatedHistory };

    case "remediate":
      if (action.remediation) {
        devLog(`[ReplanEngine] Inserting ${action.remediation.length} remediation step(s)`);
      }
      return {
        ...pathState,
        replanHistory: updatedHistory,
        _pendingRemediation: action.remediation || [],
      };

    case "skip-similar":
      if (action.skipModuleIds?.length) {
        devLog(`[ReplanEngine] Marking ${action.skipModuleIds.length} module(s) as optional`);
      }
      return {
        ...pathState,
        replanHistory: updatedHistory,
        _optionalModules: [
          ...(pathState._optionalModules || []),
          ...(action.skipModuleIds || []),
        ],
      };

    case "suggest-exit":
      devLog("[ReplanEngine] Suggesting path exit/pivot");
      return {
        ...pathState,
        replanHistory: updatedHistory,
        _suggestExit: true,
        _optionalModules: [
          ...(pathState._optionalModules || []),
          ...(action.skipModuleIds || []),
        ],
      };

    default:
      return { ...pathState, replanHistory: updatedHistory };
  }
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Build remediation steps for a struggle verdict.
 * Creates 1-2 bridge steps that recap the failed module's core concepts.
 */
function buildRemediationSteps(checkpoint) {
  return [
    {
      id: `remediation-${checkpoint.moduleId}-${Date.now()}`,
      type: "remediation",
      title: `Review: Key concepts from the previous module`,
      content: `Let's revisit the core ideas before moving on. Focus on the areas where you felt less confident.`,
      sourceModuleId: checkpoint.moduleId,
      confidenceTarget: checkpoint.confidenceAfter + 1,
    },
  ];
}

/**
 * Find modules in the remaining path that are topically similar
 * to the given module. For MVP, uses simple ID/title substring matching.
 * Can be enhanced with embedding similarity later.
 */
function findSimilarModules(moduleId, remainingModules) {
  // MVP: simple keyword extraction from the module ID
  const keywords = moduleId
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 3);

  return remainingModules
    .filter((mod) => {
      const modId = (mod.id || mod.title || "").toLowerCase();
      return keywords.some((kw) => modId.includes(kw));
    })
    .map((mod) => mod.id || mod.title);
}
