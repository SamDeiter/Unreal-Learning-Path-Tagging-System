/**
 * quizService.js — AI-generated MCQ quiz engine
 *
 * Generates multiple-choice questions from transcript/content chunks
 * using the extractIntent Cloud Function (Gemini) with a quiz-generation prompt.
 *
 * Each question tests comprehension of a specific path step and includes:
 * - A stem (question text)
 * - 4 answer choices (A-D)
 * - The correct answer key
 * - A brief explanation for the correct answer
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";

/**
 * Generate quiz questions for a single path step.
 *
 * @param {Object} step - A sequenced path step from bespokePathService
 * @param {string} step.segment.text - The content text to quiz on
 * @param {string} step.category - foundation|diagnosis|fix|transfer
 * @param {string} userQuery - The original user query for context
 * @param {number} count - Number of questions to generate (default 2)
 * @returns {Promise<Array<{stem: string, choices: {A:string, B:string, C:string, D:string}, correct: string, explanation: string}>>}
 */
export async function generateQuizForStep(step, userQuery, count = 3) {
  if (!step?.segment?.text && !step?.summary) return [];

  const contentSnippet = (step.summary || step.segment?.text || "").slice(0, 1500);

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const quizFn = httpsCallable(functions, "generateAudioBriefing");

    const result = await quizFn({
      mode: "quiz",
      query: userQuery,
      stepContent: contentSnippet,
      stepCategory: step.category || "learning",
      quizCount: count,
    });

    if (result.data?.questions && Array.isArray(result.data.questions)) {
      devLog(
        `[Quiz] Generated ${result.data.questions.length} questions for ${step.category} step`
      );
      recordTokenUsage(
        "quizGeneration",
        Math.ceil(contentSnippet.length / 4),
        Math.ceil(JSON.stringify(result.data.questions).length / 4)
      );
      return result.data.questions;
    }

    return fallbackQuestions(step);
  } catch (err) {
    devWarn("[Quiz] AI quiz generation failed:", err.message);
    return fallbackQuestions(step);
  }
}

/**
 * Generate quiz questions for an entire bespoke path.
 * Generates questions for each step in parallel.
 *
 * @param {Array} path - Sequenced path from bespokePathService
 * @param {string} userQuery - Original query
 * @param {number} totalQuestions - Total target number of questions for the entire path
 * @returns {Promise<Map<number, Array>>} Map of step index → questions
 */
export async function generateQuizForPath(path, userQuery, totalQuestions = 5) {
  if (!path || path.length === 0 || totalQuestions <= 0) return new Map();

  // Distribute totalQuestions across all steps
  const baseCount = Math.floor(totalQuestions / path.length);
  let remainder = totalQuestions % path.length;

  const results = await Promise.allSettled(
    path.map((step) => {
      let countForStep = baseCount;
      if (remainder > 0) {
        countForStep++;
        remainder--;
      }
      if (countForStep === 0) return Promise.resolve([]); // Skip generating if 0 for this step
      return generateQuizForStep(step, userQuery, countForStep);
    })
  );

  const quizMap = new Map();
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      quizMap.set(i, result.value);
    }
  });

  devLog(`[Quiz] Generated quizzes for ${quizMap.size}/${path.length} steps`);
  return quizMap;
}

/**
 * Score a single answer.
 *
 * @param {Object} question - The question object
 * @param {string} selectedAnswer - The user's answer key (A/B/C/D)
 * @returns {{isCorrect: boolean, correctAnswer: string, explanation: string}}
 */
export function scoreAnswer(question, selectedAnswer) {
  const isCorrect = selectedAnswer === question.correct;
  return {
    isCorrect,
    correctAnswer: question.correct,
    explanation: question.explanation || "",
  };
}

/**
 * Calculate overall quiz score for a path.
 *
 * @param {Map<number, Array>} quizMap - Step index → questions
 * @param {Map<string, string>} answers - Question ID → selected answer
 * @returns {{total: number, correct: number, percentage: number, byStep: Object}}
 */
export function calculatePathScore(quizMap, answers) {
  let total = 0;
  let correct = 0;
  const byStep = {};

  for (const [stepIndex, questions] of quizMap) {
    let stepCorrect = 0;
    for (let q = 0; q < questions.length; q++) {
      const qId = `${stepIndex}-${q}`;
      total++;
      if (answers.has(qId) && answers.get(qId) === questions[q].correct) {
        correct++;
        stepCorrect++;
      }
    }
    byStep[stepIndex] = {
      total: questions.length,
      correct: stepCorrect,
      percentage: Math.round((stepCorrect / questions.length) * 100),
    };
  }

  return {
    total,
    correct,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    byStep,
  };
}

/**
 * Fallback questions when AI generation fails.
 * Returns generic comprehension questions based on category.
 */
function fallbackQuestions(step) {
  const categoryQuestions = {
    foundation: {
      stem: "Based on the content you just read, what is the fundamental concept being explained?",
      choices: {
        A: "A performance optimization technique",
        B: "A core architectural pattern in UE5",
        C: "A debugging methodology",
        D: "A deployment configuration",
      },
      correct: "B",
      explanation: "Foundation content typically covers core architectural patterns and concepts.",
    },
    diagnosis: {
      stem: "What is the key indicator that helps identify this type of problem?",
      choices: {
        A: "Compile-time errors in the build log",
        B: "Visual artifacts or unexpected behavior at runtime",
        C: "Missing asset references in the content browser",
        D: "Network timeout errors in the output log",
      },
      correct: "B",
      explanation: "Diagnosis content focuses on identifying symptoms and root causes at runtime.",
    },
    fix: {
      stem: "What is the recommended first step when applying this fix?",
      choices: {
        A: "Restart the editor immediately",
        B: "Back up the project and verify the issue is reproducible",
        C: "Delete all derived data caches",
        D: "Update to the latest engine version",
      },
      correct: "B",
      explanation: "Always back up and verify reproducibility before applying fixes.",
    },
    transfer: {
      stem: "How can this knowledge be applied to other areas of UE5 development?",
      choices: {
        A: "It only applies to this specific use case",
        B: "The underlying pattern is reusable across similar systems",
        C: "It requires a completely different approach in other contexts",
        D: "It's only relevant for legacy projects",
      },
      correct: "B",
      explanation: "Transfer knowledge emphasizes reusable patterns across different contexts.",
    },
  };

  const q = categoryQuestions[step.category] || categoryQuestions.foundation;
  return [q];
}
