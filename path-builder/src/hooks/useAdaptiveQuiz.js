/**
 * useAdaptiveQuiz — hook for managing the diagnostic quiz flow
 *
 * Calls the generateAudioBriefing CF in "diagnostic" mode to get
 * 3-5 narrowing questions about the user's topic, then collects
 * answers to build a knowledge profile.
 */

import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../services/firebaseConfig";
import { findQuizImage } from "../data/quizImageBank";

const STAGES = {
  IDLE: "idle",
  LOADING: "loading",
  QUIZZING: "quizzing",
  COMPLETE: "complete",
  ERROR: "error",
};

const STORAGE_KEY = "ue5_learner_profile";

/** Load a previously saved learner profile from localStorage. */
function loadSavedProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.level && Array.isArray(parsed.gaps)) return parsed;
  } catch {
    /* corrupt data — ignore */
  }
  return null;
}

/** Persist a learner profile to localStorage. */
function saveProfile(profile) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...profile, savedAt: new Date().toISOString() })
    );
  } catch {
    /* storage full — ignore */
  }
}

/**
 * @returns {Object} Quiz state and handlers
 */
export default function useAdaptiveQuiz() {
  // Auto-restore saved profile on mount
  const saved = loadSavedProfile();
  const [stage, setStage] = useState(saved ? STAGES.COMPLETE : STAGES.IDLE);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [knowledgeProfile, setKnowledgeProfile] = useState(saved || null);
  const [error, setError] = useState(null);
  const hasSavedProfile = !!saved;

  /**
   * Generate diagnostic questions for a topic.
   * @param {string} query - The user's question/topic
   */
  const startDiagnostic = useCallback(async (query) => {
    setStage(STAGES.LOADING);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setKnowledgeProfile(null);

    try {
      const app = getFirebaseApp();
      const functions = getFunctions(app, "us-central1");
      const generateAudioBriefing = httpsCallable(functions, "generateAudioBriefing");

      const result = await generateAudioBriefing({
        query,
        mode: "diagnostic",
      });

      const data = result.data;

      if (!data.success || !data.questions || data.questions.length === 0) {
        throw new Error(data.error || "Failed to generate diagnostic questions.");
      }

      // Enrich questions with images from the quiz image bank
      const enriched = data.questions.map((q) => {
        const imageMatch = findQuizImage(q.concept);
        return imageMatch ? { ...q, image: imageMatch.image, imageHint: imageMatch.hint } : q;
      });

      setQuestions(enriched);
      setStage(STAGES.QUIZZING);
    } catch (err) {
      console.error("[AdaptiveQuiz] Error generating questions:", err);
      setError(err.message || "Failed to generate diagnostic questions. Please try again.");
      setStage(STAGES.ERROR);
    }
  }, []);

  /**
   * Submit an answer for the current question.
   * @param {number} selectedOption - Index of the selected option (0-3), or -1 for "I'm not sure"
   */
  const submitAnswer = useCallback(
    (selectedOption) => {
      const question = questions[currentIndex];
      if (!question) return;

      const isCorrect = selectedOption !== -1 && selectedOption === question.correctIndex;

      const answer = {
        questionIndex: currentIndex,
        selectedOption,
        concept: question.concept,
        correct: selectedOption === -1 ? false : isCorrect,
        unsure: selectedOption === -1,
      };

      const updatedAnswers = [...answers, answer];
      setAnswers(updatedAnswers);

      // Move to next question or complete
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Build knowledge profile from all answers
        const profile = buildKnowledgeProfile(updatedAnswers, questions);
        setKnowledgeProfile(profile);
        saveProfile(profile);
        setStage(STAGES.COMPLETE);
      }
    },
    [currentIndex, questions, answers]
  );

  /**
   * Reset the quiz to allow a new diagnostic.
   */
  const reset = useCallback(() => {
    setStage(STAGES.IDLE);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setKnowledgeProfile(null);
    setError(null);
  }, []);

  /**
   * Clear saved profile and reset — used for "Retake Assessment".
   */
  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setKnowledgeProfile(null);
    setStage(STAGES.IDLE);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setError(null);
  }, []);

  return {
    stage,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    knowledgeProfile,
    error,
    hasSavedProfile,
    startDiagnostic,
    submitAnswer,
    reset,
    clearProfile,
    STAGES,
  };
}

/**
 * Build a knowledge profile from quiz answers.
 * @param {Array} answers - All collected answers
 * @param {Array} questions - The original questions
 * @returns {{ knows: string[], gaps: string[], level: string }}
 */
export function buildKnowledgeProfile(answers, questions) {
  const knows = [];
  const gaps = [];

  answers.forEach((answer) => {
    const concept = answer.concept || `concept_${answer.questionIndex}`;
    if (answer.correct) {
      knows.push(concept);
    } else {
      gaps.push(concept);
    }
  });

  // Weighted scoring: advanced questions count more than beginner ones
  const score = answers.reduce((sum, a) => {
    const q = questions[a.questionIndex];
    const weight = q?.difficulty || 1;
    return sum + (a.correct ? weight : 0);
  }, 0);
  const maxScore = questions.reduce((sum, q) => sum + (q?.difficulty || 1), 0);
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let level;
  if (ratio >= 0.8) {
    level = "advanced";
  } else if (ratio >= 0.4) {
    level = "intermediate";
  } else {
    level = "beginner";
  }

  return { knows, gaps, level };
}
