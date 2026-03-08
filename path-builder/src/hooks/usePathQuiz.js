/**
 * usePathQuiz — Shared quiz generation + scoring hook.
 *
 * Used by both BespokePath and AdaptivePath to manage:
 *   - On-demand quiz generation (aggregated from all path steps)
 *   - Quiz score tracking
 *   - Quiz visibility toggle
 *
 * @param {Object} options
 * @param {Object|null} options.pathData  - The path result object ({ path, query })
 * @param {string}      options.query     - The user's query (fallback if pathData.query missing)
 * @param {Function}    [options.onComplete] - Optional callback when quiz finishes (e.g., analytics)
 * @returns {{
 *   quizzes: Map, quizLoading: number|null, quizScores: Map, showQuiz: number|null,
 *   handleTakeQuiz: Function, handleQuizComplete: Function, resetQuiz: Function
 * }}
 */

import { useState, useCallback } from "react";
import { generateQuizForStep } from "../services/quizService";

export default function usePathQuiz({ pathData, query, onComplete } = {}) {
  const [quizzes, setQuizzes] = useState(new Map());
  const [quizLoading, setQuizLoading] = useState(null);
  const [quizScores, setQuizScores] = useState(new Map());
  const [showQuiz, setShowQuiz] = useState(null);

  /**
   * Generate or show a quiz for the given step index.
   * Uses aggregated content from ALL path steps for a comprehensive quiz.
   */
  const handleTakeQuiz = useCallback(
    async (stepIndex) => {
      if (quizzes.has(stepIndex)) {
        setShowQuiz(stepIndex);
        return;
      }
      if (!pathData) return;

      setQuizLoading(stepIndex);

      // Aggregate ALL step content for a comprehensive quiz
      const aggregatedStep = {
        summary: pathData.path
          .map((s) => (s.summary || s.segment?.text || "").substring(0, 400))
          .join("\n\n"),
        segment: pathData.path[0]?.segment,
        category: "comprehensive",
      };

      const questions = await generateQuizForStep(aggregatedStep, pathData.query || query, 3);
      setQuizzes((prev) => new Map(prev).set(stepIndex, questions));
      setQuizLoading(null);
      setShowQuiz(stepIndex);
    },
    [quizzes, pathData, query]
  );

  /**
   * Record the quiz score and close the quiz panel.
   */
  const handleQuizComplete = useCallback(
    ({ stepIndex, score, total }) => {
      setQuizScores((prev) => new Map(prev).set(stepIndex, { score, total }));
      setShowQuiz(null);

      if (onComplete) {
        onComplete({ stepIndex, score, total });
      }
    },
    [onComplete]
  );

  /**
   * Reset all quiz state (e.g., when starting a new path).
   */
  const resetQuiz = useCallback(() => {
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);
    setQuizLoading(null);
  }, []);

  return {
    quizzes,
    quizLoading,
    quizScores,
    showQuiz,
    handleTakeQuiz,
    handleQuizComplete,
    resetQuiz,
  };
}
