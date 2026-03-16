/**
 * checkpointService.js — Module Verification Checkpoints
 *
 * Provides the data schema, quiz generation, and verdict evaluation
 * for module-level exit checks in the learning path player.
 *
 * Each module gets a checkpoint after completion that collects:
 *   - Confidence before/after (1-5 Likert)
 *   - 1-3 targeted quiz questions derived from howToVerify fields
 *   - "Did this help with your actual issue?" prompt
 *
 * The checkpoint is evaluated into a deterministic verdict:
 *   pass | struggle | irrelevant | skipped
 *
 * That verdict drives the replanning engine (replanEngine.js).
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { retryWithBackoff } from "../utils/retryWithBackoff";

// ── Schema ─────────────────────────────────────────────────────────

/**
 * Create a blank ModuleCheckpoint.
 * @param {string} moduleId - The module this checkpoint belongs to
 * @param {string} originalProblem - The learner's original problem statement
 * @returns {Object} ModuleCheckpoint
 */
export function createCheckpoint(moduleId, originalProblem = "") {
  return {
    moduleId,
    confidenceBefore: 0,       // 1-5 Likert, 0 = not yet answered
    confidenceAfter: 0,        // 1-5 Likert, 0 = not yet answered
    quizResult: {
      correct: 0,
      total: 0,
      questions: [],           // { question, options, correctIndex, selectedIndex }[]
    },
    helpedWithIssue: null,     // 'yes' | 'partially' | 'no' | null
    verdict: null,             // 'pass' | 'struggle' | 'irrelevant' | 'skipped' | null
    timestamp: null,           // set on submission
    originalProblem,
  };
}

// ── Quiz Generation ────────────────────────────────────────────────

/**
 * Generate 1-3 targeted verification questions for a module.
 *
 * Uses the module's howToVerify fields from its steps + the original
 * problem statement to produce questions that test actual understanding,
 * not rote recall.
 *
 * @param {Object} module - Module object with steps[] containing howToVerify[]
 * @param {string} learnerGoal - The original problem/question
 * @returns {Promise<Array>} Quiz questions array
 */
export async function generateModuleQuiz(module, learnerGoal = "") {
  // Collect all howToVerify items from the module's steps
  const verifyItems = [];
  const steps = module.steps || module.courses || [];
  for (const step of steps) {
    if (step.howToVerify && Array.isArray(step.howToVerify)) {
      verifyItems.push(...step.howToVerify);
    }
  }

  // If no verification items exist, produce a simple self-report question
  if (verifyItems.length === 0) {
    return [
      {
        question: `Can you explain the main concept from "${module.title || module.name || "this module"}" in your own words?`,
        type: "self-report",
        options: null,
        correctIndex: null,
      },
    ];
  }

  // Try LLM-generated quiz, fall back to deterministic
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments", { timeout: 60000 });

    const moduleTitle = module.title || module.name || "Module";
    const stepTitles = steps.map((s) => s.title || s.name || "Step").join(", ");

    const prompt = `You are a UE5 instructor creating quick verification questions.

Module: "${moduleTitle}"
Steps covered: ${stepTitles}
Learner's original problem: "${learnerGoal}"

Verification criteria from the module:
${verifyItems.map((v, i) => `${i + 1}. ${v}`).join("\n")}

Generate 1-3 multiple choice questions that test whether the learner actually understood and can apply the module content to their problem. Each question should have 4 options.

Return JSON array:
[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of the correct answer"
  }
]

Rules:
- Questions should test application, not memorization
- Connect at least one question to the learner's original problem
- Options should be plausible UE5 scenarios, not obviously wrong
- Return ONLY the JSON array, no markdown fences`;

    const result = await retryWithBackoff(
      () => classifyFn({ prompt }),
      { maxRetries: 1, baseDelayMs: 1500, label: "checkpointQuiz" }
    );

    const responseText = result.data?.text || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      recordTokenUsage(
        "checkpointQuiz",
        Math.ceil(prompt.length / 4),
        Math.ceil(responseText.length / 4)
      );
      devLog(`[Checkpoint] Generated ${questions.length} quiz questions for "${moduleTitle}"`);
      return questions.map((q) => ({ ...q, type: "multiple-choice" }));
    }
  } catch (err) {
    devWarn(`[Checkpoint] LLM quiz generation failed: ${err.message}, using deterministic fallback`);
  }

  // Deterministic fallback: convert howToVerify items into self-report checks
  return verifyItems.slice(0, 3).map((item) => ({
    question: item,
    type: "self-report",
    options: ["Yes, I can do this", "I think so, but not sure", "No, I need more help"],
    correctIndex: 0,
    explanation: null,
  }));
}

// ── Verdict Evaluation ─────────────────────────────────────────────

/**
 * Evaluate a completed checkpoint into a deterministic verdict.
 *
 * Verdict matrix:
 *  - pass:       quiz ≥ 67% AND confidence improved AND helped = yes/partially
 *  - struggle:   quiz < 67% OR confidence dropped
 *  - irrelevant: helped = 'no' regardless of quiz/confidence
 *  - skipped:    checkpoint was dismissed without answering
 *
 * @param {Object} checkpoint - Completed ModuleCheckpoint
 * @returns {string} 'pass' | 'struggle' | 'irrelevant' | 'skipped'
 */
export function evaluateCheckpoint(checkpoint) {
  // Skipped — no data submitted
  if (!checkpoint.timestamp) return "skipped";
  if (checkpoint.confidenceBefore === 0 && checkpoint.confidenceAfter === 0) return "skipped";

  // Irrelevant — learner says it didn't help with their issue
  if (checkpoint.helpedWithIssue === "no") return "irrelevant";

  // Quiz score (if quiz was taken)
  const quizScore = checkpoint.quizResult.total > 0
    ? checkpoint.quizResult.correct / checkpoint.quizResult.total
    : 1; // No quiz = assume pass on this dimension

  // Confidence delta
  const confidenceDelta = checkpoint.confidenceAfter - checkpoint.confidenceBefore;

  // Struggle — quiz below threshold OR confidence dropped significantly
  if (quizScore < 0.67) return "struggle";
  if (confidenceDelta < -1) return "struggle";

  // Pass — everything checks out
  return "pass";
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Summarize an array of checkpoints for the effectiveness report.
 * @param {Array} checkpoints - Array of ModuleCheckpoint objects
 * @returns {Object} Summary statistics
 */
export function summarizeCheckpoints(checkpoints) {
  const total = checkpoints.length;
  const counts = { pass: 0, struggle: 0, irrelevant: 0, skipped: 0 };
  let totalQuizCorrect = 0;
  let totalQuizQuestions = 0;
  const confidenceJourney = [];

  for (const cp of checkpoints) {
    const verdict = cp.verdict || evaluateCheckpoint(cp);
    counts[verdict] = (counts[verdict] || 0) + 1;
    totalQuizCorrect += cp.quizResult.correct;
    totalQuizQuestions += cp.quizResult.total;
    confidenceJourney.push({
      moduleId: cp.moduleId,
      before: cp.confidenceBefore,
      after: cp.confidenceAfter,
      verdict,
    });
  }

  return {
    total,
    counts,
    quizAccuracy: totalQuizQuestions > 0 ? totalQuizCorrect / totalQuizQuestions : null,
    confidenceJourney,
    overallEffectiveness: total > 0
      ? ((counts.pass + counts.irrelevant * 0.5) / total * 100).toFixed(0) + "%"
      : "N/A",
  };
}
