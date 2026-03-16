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
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
} from "../services/narratorService";
import { generateChallenge } from "../services/challengeService";
import { signInWithGoogle, onAuthChange } from "../services/googleAuthService";
import { recordPathCompletion, getStreakInfo } from "../services/learningProgressService";
import { detectPersona, getPersonaMessaging } from "../services/PersonaService";
import { createCheckpoint, generateModuleQuiz } from "../services/checkpointService";
import { determineAction, applyReplan } from "../services/replanEngine";
import quizData from "../data/quiz_questions.json";
import { logVideoFeedback } from "../services/feedbackService";

// Player stages — exported so components can reference them
export const STAGES = {
  INTRO: "intro",
  PLAYING: "playing",
  QUIZ: "quiz",
  CHALLENGE: "challenge",
  BRIDGE: "bridge",
  CHECKPOINT: "checkpoint",
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

  // ── Checkpoint state ──
  const [checkpoints, setCheckpoints] = useState([]);
  const [currentCheckpoint, setCurrentCheckpoint] = useState(null);
  const [checkpointQuiz, setCheckpointQuiz] = useState([]);
  const [replanState, setReplanState] = useState({ replanHistory: [], _optionalModules: [], _suggestExit: false });

  // Track video start time for skip detection (set when learning actually starts)
  const vidStartRef = useRef(0);

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

  // Detect persona to tailor messaging
  const detectedPersona = useMemo(() => {
    // If we have courses, use their tags to help detect the persona
    const courseTags = courses.flatMap((c) => c.canonical_tags || []);
    return detectPersona(problemSummary || "", courseTags);
  }, [problemSummary, courses]);

  const personaMessaging = useMemo(() => {
    if (!detectedPersona) return null;
    return getPersonaMessaging(detectedPersona);
  }, [detectedPersona]);

  const introContent = useMemo(() => {
    // Pass the detected persona down so narrator service can use it if needed,
    // but we will also pass the messaging explicitly to the IntroCard.
    return generatePathIntro({ problemSummary, courses, diagnosis, persona: detectedPersona });
  }, [problemSummary, courses, diagnosis, detectedPersona]);

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
    vidStartRef.current = Date.now();
    setStage(STAGES.PLAYING);
  }, []);

  const handleVideoComplete = useCallback(() => {
    // Log "watched" signal (fire-and-forget)
    if (currentCourse && currentVideo && user?.uid) {
      logVideoFeedback(
        user.uid,
        currentCourse.code,
        currentVideo.key || currentVideo.title,
        "watched"
      );
    }
    vidStartRef.current = Date.now();

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
  }, [hasMoreVideos, currentCourse, currentVideo, nextCourse, onComplete, user]);

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
    // Log "skipped" if user clicks Next within 30s of starting
    const elapsed = Date.now() - vidStartRef.current;
    if (elapsed < 30000 && currentCourse && currentVideo && user?.uid) {
      logVideoFeedback(
        user.uid,
        currentCourse.code,
        currentVideo.key || currentVideo.title,
        "skipped"
      );
    }
    vidStartRef.current = Date.now();

    if (hasMoreVideos) {
      setVideoIndex((prev) => prev + 1);
    } else if (nextCourse) {
      // Go to first video of next course
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
    }
  }, [hasMoreVideos, nextCourse, currentCourse, currentVideo, user]);

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
    // Check if this is the last course in a module boundary
    // If so, trigger a checkpoint before advancing
    const isLastInModule = !hasMoreVideos && currentCourse;

    if (isLastInModule && currentCourse?._moduleId) {
      // Prepare checkpoint for this module
      const cp = createCheckpoint(
        currentCourse._moduleId,
        problemSummary || ""
      );
      setCurrentCheckpoint(cp);

      // Generate quiz questions asynchronously
      const moduleData = {
        title: currentCourse._moduleName || currentCourse.title,
        steps: courses.filter((c) => c._moduleId === currentCourse._moduleId),
      };
      generateModuleQuiz(moduleData, problemSummary || "")
        .then((questions) => setCheckpointQuiz(questions))
        .catch(() => setCheckpointQuiz([]));

      setStage(STAGES.CHECKPOINT);
      return;
    }

    if (nextCourse) {
      // Auto-advance to next course (bridge card removed)
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
      setStage(STAGES.PLAYING);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }
  }, [nextCourse, onComplete, hasMoreVideos, currentCourse, courses, problemSummary]);

  // ── Checkpoint handlers ──
  const handleCheckpointSubmit = useCallback((completedCheckpoint) => {
    // Store checkpoint
    setCheckpoints((prev) => [...prev, completedCheckpoint]);

    // Run replanning engine
    const remainingModules = courses
      .slice(currentIndex + 1)
      .filter((c) => c._moduleId)
      .map((c) => ({ id: c._moduleId, title: c._moduleName || c.title }));

    const action = determineAction(completedCheckpoint, remainingModules, checkpoints);
    const newReplanState = applyReplan(action, replanState);
    setReplanState(newReplanState);

    // Advance to next course or complete
    if (nextCourse) {
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
      setStage(STAGES.PLAYING);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }

    setCurrentCheckpoint(null);
    setCheckpointQuiz([]);
  }, [courses, currentIndex, checkpoints, replanState, nextCourse, onComplete]);

  const handleCheckpointSkip = useCallback((skippedCheckpoint) => {
    setCheckpoints((prev) => [...prev, skippedCheckpoint]);

    if (nextCourse) {
      setCurrentIndex((prev) => prev + 1);
      setVideoIndex(0);
      setStage(STAGES.PLAYING);
    } else {
      setStage(STAGES.COMPLETE);
      onComplete?.();
    }

    setCurrentCheckpoint(null);
    setCheckpointQuiz([]);
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

    // Checkpoint state
    checkpoints,
    currentCheckpoint,
    checkpointQuiz,
    replanState,

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
    personaMessaging,
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
    handleCheckpointSubmit,
    handleCheckpointSkip,
    handleContinue,
    handleSkipTo,
    handleFinish,
    onExit,
  };
}
