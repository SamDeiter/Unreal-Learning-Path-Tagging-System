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
export async function generateQuizForStep(step, userQuery, count = 2) {
  if (!step?.segment?.text) return [];

  const contentSnippet = step.segment.text.slice(0, 800);
  const sourceLabel =
    step.segment.type === "transcript"
      ? `Video: ${step.segment.videoTitle}`
      : step.segment.type === "epic_learning"
        ? `Article: ${step.segment.title}`
        : `Docs: ${step.segment.title}`;

  const prompt = `You are a UE5 instructor creating a quick comprehension quiz.

The learner asked: "${userQuery}"
They just studied this ${step.category} content from ${sourceLabel}:

"""
${contentSnippet}
"""

Generate exactly ${count} multiple-choice questions that test whether the learner understood the key concepts. Each question should:
- Be directly answerable from the content above
- Have exactly 4 choices (A, B, C, D)
- Have only ONE correct answer
- Include a 1-sentence explanation for the correct answer
- Be practical and UE5-specific (not generic trivia)

Return ONLY a JSON array with this exact format:
[{
  "stem": "What is the primary purpose of...",
  "choices": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct": "B",
  "explanation": "B is correct because..."
}]`;

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const quizFn = httpsCallable(functions, "extractIntent");

    const result = await quizFn({ text: prompt });
    const responseText = result.data?.intent || result.data?.text || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      devWarn("[Quiz] Could not parse quiz JSON from AI response");
      return fallbackQuestions(step);
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Validate structure
    const valid = questions.filter(
      (q) =>
        q.stem &&
        q.choices &&
        typeof q.choices === "object" &&
        Object.keys(q.choices).length === 4 &&
        q.correct &&
        ["A", "B", "C", "D"].includes(q.correct)
    );

    devLog(`[Quiz] Generated ${valid.length} questions for ${step.category} step`);
    return valid;
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
 * @param {number} questionsPerStep - Questions per step (default 2)
 * @returns {Promise<Map<number, Array>>} Map of step index → questions
 */
export async function generateQuizForPath(path, userQuery, questionsPerStep = 2) {
  if (!path || path.length === 0) return new Map();

  const results = await Promise.allSettled(
    path.map((step) => generateQuizForStep(step, userQuery, questionsPerStep))
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
