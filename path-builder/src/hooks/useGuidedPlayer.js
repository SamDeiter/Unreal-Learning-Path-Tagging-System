/**
 * useGuidedPlayer — Controller hook for the GuidedPlayer experience.
 * Extracts all state, effects, and handlers from the view component.
 *
 * @param {Object} params
 * @param {Array} params.courses - Ordered list of courses in the path
 * @param {Object} params.diagnosis - AI diagnosis of the user's problem
 * @param {string} params.problemSummary - User's problem text
 * @param {Object} params.pathSummary - AI-generated path summary
 * @param {Function} params.onComplete - Called when the full path is completed
 * @param {Function} params.onExit - Called when the user exits the path
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
} from "../services/narratorService";
import { generateChallenge } from "../services/challengeService";
import { signInWithGoogle, onAuthChange } from "../services/googleAuthService";
import { recordPathCompletion, getStreakInfo } from "../services/learningProgressService";
import quizData from "../data/quiz_questions.json";

// Player stages — exported so components can reference them
export const STAGES = {
  INTRO: "intro",
  PLAYING: "playing",
  QUIZ: "quiz",
  CHALLENGE: "challenge",
  BRIDGE: "bridge",
  COMPLETE: "complete",
};

export default function useGuidedPlayer({
  courses,
  diagnosis,
  problemSummary,
  pathSummary,
  onComplete,
  onExit,
}) {
  // ── Core state ──
  const [stage, setStage] = useState(STAGES.INTRO);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [reflectionText, setReflectionText] = useState("");

  // ── Auth state ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("[GuidedPlayer] Sign in failed:", error);
    }
    setAuthLoading(false);
  }, []);

  // ── Derived data ──
  const currentCourse = courses[currentIndex] || null;
  const nextCourse = courses[currentIndex + 1] || null;
  const currentVideos = currentCourse?.videos || [];
  const currentVideo = currentVideos[videoIndex] || currentVideos[0] || null;
  const hasMoreVideos = videoIndex < currentVideos.length - 1;
  const hasPreviousVideo = videoIndex > 0 || currentIndex > 0;
  const hasNextVideo = hasMoreVideos || !!nextCourse;
  const courseVideoCount = currentVideos.length;

  const introContent = useMemo(
    () => generatePathIntro({ problemSummary, courses, diagnosis }),
    [problemSummary, courses, diagnosis]
  );

  const streak = useMemo(() => getStreakInfo(), []);

  // ── Progress tracking ──
  const totalVideoCount = useMemo(
    () => courses.reduce((sum, c) => sum + (c.videos?.length || 1), 0),
    [courses]
  );
  const videosWatchedSoFar = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentIndex; i++) {
      count += courses[i]?.videos?.length || 1;
    }
    return count + videoIndex;
  }, [courses, currentIndex, videoIndex]);
  const progress = useMemo(
    () => generateProgressText(videosWatchedSoFar, totalVideoCount),
    [videosWatchedSoFar, totalVideoCount]
  );

  // ── Stage-dependent content (lazy — only computed when needed) ──
  const bridgeContent = useMemo(() => {
    if (stage !== STAGES.BRIDGE) return null;
    const objective = currentCourse?.gemini_outcomes?.[0] || null;
    return generateBridgeText(currentCourse, nextCourse, objective);
  }, [stage, currentCourse, nextCourse]);

  const challengeContent = useMemo(() => {
    if (stage !== STAGES.CHALLENGE) return null;
    return generateChallenge(currentCourse, problemSummary, currentVideo?.title, currentIndex);
  }, [stage, currentCourse, problemSummary, currentVideo, currentIndex]);

  // ── Handlers (stage transitions) ──
  const handleStartLearning = useCallback(() => {
    setStage(STAGES.PLAYING);
  }, []);

  const handleVideoComplete = useCallback(() => {
    // Reading steps skip quiz/challenge — go directly to next course or complete
    if (currentCourse?._readingStep) {
      if (nextCourse) {
        setCurrentIndex((prev) => prev + 1);
        setVideoIndex(0);
        setStage(STAGES.PLAYING);
      } else {
        setStage(STAGES.COMPLETE);
        onComplete?.();
      }
      return;
    }

    if (hasMoreVideos) {
      setVideoIndex((prev) => prev + 1);
    } else {
      const courseQuiz = quizData[currentCourse?.code];
      if (courseQuiz && Object.keys(courseQuiz).length > 0) {
        setStage(STAGES.QUIZ);
      } else {
        setStage(STAGES.CHALLENGE);
      }
    }
  }, [hasMoreVideos, currentCourse, nextCourse, onComplete]);

  const handlePreviousVideo = useCallback(() => {
    if (videoIndex > 0) {
      setVideoIndex((prev) => prev - 1);
    } else if (currentIndex > 0) {
      // Go to last video of previous course
      const prevVideos = courses[currentIndex - 1]?.videos || [];
      setCurrentIndex((prev) => prev - 1);
      setVideoIndex(Math.max(0, prevVideos.length - 1));
    }
  }, [videoIndex, currentIndex, courses]);

  const handleNextVideo = useCallback(() => {
    if (hasMoreVideos) {
      setVideoIndex((prev) => prev + 1);
    } else if (nextCourse) {
      // Go to first video of next course
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
    }
  }, [hasMoreVideos, nextCourse]);

  const handleBackToPath = useCallback(() => {
    // Reset to first course, first video, PLAYING stage
    setCurrentIndex(0);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  const handleQuizComplete = useCallback(() => {
    setStage(STAGES.CHALLENGE);
  }, []);

  const handleChallengeComplete = useCallback(() => {
    if (nextCourse) {
      // Auto-advance to next course (bridge card removed)
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
      setStage(STAGES.PLAYING);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }
  }, [nextCourse, onComplete]);

  const handleContinue = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  const handleSkipTo = useCallback((index) => {
    setCurrentIndex(index);
    setVideoIndex(0);
    setStage(STAGES.PLAYING);
  }, []);

  const handleFinish = useCallback(() => {
    const pathId = problemSummary
      ? `path-${problemSummary.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}-${Date.now()}`
      : `path-${Date.now()}`;
    recordPathCompletion(pathId, courses, reflectionText);
    onExit?.();
  }, [problemSummary, courses, reflectionText, onExit]);

  const wordCount = reflectionText.trim().split(/\s+/).filter(Boolean).length;

  return {
    // State
    stage,
    currentIndex,
    videoIndex,
    reflectionText,
    setReflectionText,
    user,
    authLoading,

    // Derived
    currentCourse,
    nextCourse,
    currentVideos,
    currentVideo,
    hasMoreVideos,
    hasPreviousVideo,
    hasNextVideo,
    courseVideoCount,
    introContent,
    streak,
    progress,
    bridgeContent,
    challengeContent,
    pathSummary,
    wordCount,
    courses,

    // Handlers
    handleSignIn,
    handleStartLearning,
    handleVideoComplete,
    handlePreviousVideo,
    handleNextVideo,
    handleBackToPath,
    handleQuizComplete,
    handleChallengeComplete,
    handleContinue,
    handleSkipTo,
    handleFinish,
    onExit,
  };
}
