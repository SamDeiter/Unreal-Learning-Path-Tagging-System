/**
 * useAuthoringWorkbench.js — State management for the Instructor Review UI
 *
 * Manages the authoring workflow:
 *   1. Topic input → AI generates learning path outline
 *   2. Review chapters and steps → approve/edit structure
 *   3. Generate video briefs per step
 *   4. Link videos to steps
 *   5. Export as SCORM 1.2 or V3 viewer package
 *
 * Plugs into:
 *   - bespokePathService → generates V2 path
 *   - editorialPass → enriches teaching fields
 *   - videoBriefService → recording briefs
 *   - scormExportService → SCORM export
 *   - v3Adapter → V3 viewer export
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { devLog, devWarn } from "../utils/logger";
import { DIFFICULTY_LEVELS, LESSON_TYPES } from "../schemas/LearningPathV2";

// ── Workflow Stages ────────────────────────────────────────

export const AUTHORING_STAGES = {
  PLAN: "plan",           // Enter topic → generate outline
  REVIEW: "review",       // Review/edit AI-generated chapters and steps
  BRIEF: "brief",         // Generate recording briefs
  LINK: "link",           // Link video URLs to steps
  EXPORT: "export",       // Export to SCORM or V3
};

const STAGE_ORDER = [
  AUTHORING_STAGES.PLAN,
  AUTHORING_STAGES.REVIEW,
  AUTHORING_STAGES.BRIEF,
  AUTHORING_STAGES.LINK,
  AUTHORING_STAGES.EXPORT,
];

const STORAGE_KEY = "authoring-workbench-state";
const DRAFTS_KEY = "authoring-workbench-drafts";

// ── Auto-Name Modules ─────────────────────────────────────
// Replaces generic Bloom's taxonomy titles ("Understand", "Implement",
// "Apply & Verify") with descriptive names derived from the lessons inside.

const GENERIC_TITLES = new Set([
  "understand", "implement", "apply", "apply & verify",
  "analyze", "evaluate", "create", "remember",
  "foundation", "core", "practice", "prerequisite",
  "prerequisites", "core steps",
]);

function autoNameModules(path) {
  if (!path?.sections) return path;
  const updated = structuredClone(path);
  updated.sections.forEach((section) => {
    const title = (section.title || "").trim();
    if (!title || GENERIC_TITLES.has(title.toLowerCase())) {
      const firstLesson = section.steps?.[0]?.title;
      if (firstLesson && firstLesson !== "New Lesson") {
        section.title = firstLesson;
      } else {
        section.title = "";
      }
    }
  });
  return updated;
}

// ── Auto-Add Quizzes ──────────────────────────────────────
// Ensures every module ends with a Quiz lesson.

function autoAddQuizzes(path) {
  if (!path?.sections) return path;
  const updated = structuredClone(path);
  updated.sections.forEach((section) => {
    const steps = section.steps || [];
    const hasQuiz = steps.some((s) => s.lessonType === "Quiz");
    if (!hasQuiz) {
      steps.push({
        id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Knowledge Check",
        lessonType: "Quiz",
        whyThisMatters: "Test your understanding of the concepts covered in this module.",
        whatToDo: [],
        howToVerify: [],
        commonMistake: "",
        takeaway: "",
        summary: "A short quiz to reinforce what you learned in this module.",
        category: section.phase || "core",
        completionType: "verify",
        estimatedMinutes: 3,
        source: {},
        video: null,
        goDeeper: [],
        quiz: { questions: [] },
        _editorialStatus: "raw",
      });
      section.steps = steps;
    }
  });
  return updated;
}

// Helper: read saved state from localStorage
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Helper: read saved drafts list
function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function useAuthoringWorkbench() {
  // ── State (restored from localStorage if available) ─────

  const saved = loadState();
  const [stage, setStage] = useState(saved?.stage || AUTHORING_STAGES.PLAN);
  const [topic, setTopic] = useState(saved?.topic || "");
  const [v2Path, setV2Path] = useState(() => autoAddQuizzes(autoNameModules(saved?.v2Path)) || null);
  const [briefs, setBriefs] = useState(saved?.briefs || []);
  const [briefMarkdown, setBriefMarkdown] = useState(saved?.briefMarkdown || "");
  const [loading, setLoading] = useState(false);
  const [generatingQuizFor, setGeneratingQuizFor] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [savedDrafts, setSavedDrafts] = useState(loadDrafts);

  // ── Auto-save to localStorage ───────────────────────────

  useEffect(() => {
    // Only save if there's meaningful content
    if (!topic && !v2Path) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const state = { stage, topic, v2Path, briefs, briefMarkdown };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [stage, topic, v2Path, briefs, briefMarkdown]);

  // ── Stage Navigation ─────────────────────────────────────

  const currentStageIndex = STAGE_ORDER.indexOf(stage);

  const canGoNext = useCallback(() => {
    switch (stage) {
      case AUTHORING_STAGES.PLAN:
        return v2Path !== null;
      case AUTHORING_STAGES.REVIEW:
        return v2Path?.sections?.length > 0;
      case AUTHORING_STAGES.BRIEF:
        return briefs.length > 0;
      case AUTHORING_STAGES.LINK:
        return true; // Linking is optional
      case AUTHORING_STAGES.EXPORT:
        return false; // Last stage
      default:
        return false;
    }
  }, [stage, v2Path, briefs]);

  const goNext = useCallback(() => {
    const nextIdx = currentStageIndex + 1;
    if (nextIdx < STAGE_ORDER.length) {
      setStage(STAGE_ORDER[nextIdx]);
      setError(null);
    }
  }, [currentStageIndex]);

  const goBack = useCallback(() => {
    const prevIdx = currentStageIndex - 1;
    if (prevIdx >= 0) {
      setStage(STAGE_ORDER[prevIdx]);
      setError(null);
    }
  }, [currentStageIndex]);

  const goToStage = useCallback((targetStage) => {
    if (STAGE_ORDER.includes(targetStage)) {
      setStage(targetStage);
      setError(null);
    }
  }, []);

  // ── Plan: Generate Learning Path ─────────────────────────

  const generatePlan = useCallback(async (inputTopic) => {
    if (!inputTopic?.trim()) {
      setError("Please enter a topic");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 2, label: "Generating outline..." });

    try {
      // Lazy-load to avoid bundling on mount
      const { generateBespokePath } = await import("../services/bespokePathService");

      setProgress({ current: 1, total: 2, label: "Searching & sequencing content..." });

      const result = await generateBespokePath(inputTopic);

      if (!result?.v2Path) {
        throw new Error(result?.error || "Failed to generate learning path outline");
      }

      const namedPath = autoAddQuizzes(autoNameModules(result.v2Path));

      // ── Persist to localStorage FIRST ──────────────────────
      // This ensures the result survives even if the user clicks
      // away from the Authoring tab and the component unmounts.
      try {
        const persistState = {
          stage: AUTHORING_STAGES.REVIEW,
          topic: inputTopic,
          v2Path: namedPath,
          briefs: [],
          briefMarkdown: "",
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState));
      } catch (e) {
        devWarn("[Authoring] localStorage persist failed:", e.message);
      }

      // ── Auto-save as a draft card ─────────────────────────
      try {
        const draft = {
          id: Date.now().toString(),
          topic: inputTopic,
          title: namedPath?.title || inputTopic,
          sectionCount: namedPath?.sections?.length || 0,
          stepCount: (namedPath?.sections || []).reduce((s, sec) => s + (sec.steps?.length || 0), 0),
          stage: AUTHORING_STAGES.REVIEW,
          savedAt: new Date().toISOString(),
          state: { stage: AUTHORING_STAGES.REVIEW, topic: inputTopic, v2Path: namedPath, briefs: [], briefMarkdown: "" },
        };
        const existingDrafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]");
        const idx = existingDrafts.findIndex((d) => d.topic === inputTopic);
        if (idx >= 0) existingDrafts[idx] = draft;
        else existingDrafts.unshift(draft);
        const trimmed = existingDrafts.slice(0, 10);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed));
        setSavedDrafts(trimmed);
      } catch (e) {
        devWarn("[Authoring] Auto-draft save failed:", e.message);
      }

      // ── Then update React state (no-op if unmounted) ───────
      setV2Path(namedPath);
      setTopic(inputTopic);
      setStage(AUTHORING_STAGES.REVIEW);

      setProgress({ current: 2, total: 2, label: "Plan ready!" });
      devLog(`[Authoring] Plan generated: "${inputTopic}" → ${result.v2Path.sections?.length} sections`);
    } catch (err) {
      devWarn("[Authoring] Plan generation failed:", err.message);
      setError(`Failed to generate plan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Review: Edit Sections/Steps ──────────────────────────

  const updateStepField = useCallback((sectionIdx, stepIdx, field, value) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      if (updated.sections?.[sectionIdx]?.steps?.[stepIdx]) {
        updated.sections[sectionIdx].steps[stepIdx][field] = value;
      }
      return updated;
    });
  }, []);

  const removeStep = useCallback((sectionIdx, stepIdx) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      if (updated.sections?.[sectionIdx]?.steps) {
        updated.sections[sectionIdx].steps.splice(stepIdx, 1);
      }
      return updated;
    });
  }, []);

  const reorderStep = useCallback((sectionIdx, stepIdx, direction) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const steps = updated.sections?.[sectionIdx]?.steps;
      if (!steps) return prev;

      const targetIdx = stepIdx + direction;
      if (targetIdx < 0 || targetIdx >= steps.length) return prev;

      [steps[stepIdx], steps[targetIdx]] = [steps[targetIdx], steps[stepIdx]];
      return updated;
    });
  }, []);

  // ── Review: Edit Section (Module) Fields ─────────────────

  const updateSectionField = useCallback((sectionIdx, field, value) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      if (updated.sections?.[sectionIdx]) {
        updated.sections[sectionIdx][field] = value;
      }
      return updated;
    });
  }, []);

  // ── Review: Add Lesson to a Module ──────────────────────

  const addLesson = useCallback((sectionIdx, lessonType = "Video") => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const section = updated.sections?.[sectionIdx];
      if (!section) return prev;
      const newStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "New Lesson",
        lessonType,
        whyThisMatters: "",
        whatToDo: [],
        howToVerify: [],
        commonMistake: "",
        takeaway: "",
        summary: "",
        category: section.phase || "core",
        completionType: lessonType === "Quiz" ? "verify" : "do",
        estimatedMinutes: 3,
        source: {},
        video: null,
        goDeeper: [],
        quiz: lessonType === "Quiz" ? { questions: [{ text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }] } : null,
        _editorialStatus: "raw",
      };
      section.steps = [...(section.steps || []), newStep];
      return updated;
    });
  }, []);

  // ── Review: Quiz Authoring ──────────────────────────────

  const addQuizQuestion = useCallback((sectionIdx, stepIdx) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const step = updated.sections?.[sectionIdx]?.steps?.[stepIdx];
      if (!step) return prev;
      if (!step.quiz) step.quiz = { questions: [] };
      step.quiz.questions.push({ text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" });
      return updated;
    });
  }, []);

  const removeQuizQuestion = useCallback((sectionIdx, stepIdx, questionIdx) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const step = updated.sections?.[sectionIdx]?.steps?.[stepIdx];
      if (!step?.quiz?.questions) return prev;
      step.quiz.questions.splice(questionIdx, 1);
      return updated;
    });
  }, []);

  const updateQuizQuestion = useCallback((sectionIdx, stepIdx, questionIdx, field, value) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const q = updated.sections?.[sectionIdx]?.steps?.[stepIdx]?.quiz?.questions?.[questionIdx];
      if (!q) return prev;
      q[field] = value;
      return updated;
    });
  }, []);

  const generateQuizForStep = useCallback(async (sectionIdx, stepIdx) => {
    if (!v2Path) return;
    const section = v2Path.sections[sectionIdx];
    const step = section?.steps?.[stepIdx];
    if (!step) return;

    setGeneratingQuizFor(`${sectionIdx}-${stepIdx}`);
    setError(null);

    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const { getFirebaseApp } = await import("../services/firebaseConfig");
      const { retryWithBackoff } = await import("../utils/retryWithBackoff");
      const app = getFirebaseApp();
      const functions = getFunctions(app, "us-central1");
      const classifyFn = httpsCallable(functions, "classifySegments");

      const prompt = `You are an expert Unreal Engine 5 instructor creating a multiple-choice quiz.
Create exactly 3 quiz questions for this lesson:
Course Topic: ${v2Path.title || topic}
Module: ${section.title}
Lesson Title: ${step.title}
Lesson Context: ${step.whyThisMatters || step.summary || 'Test knowledge on this topic'}

Return a valid JSON array of question objects matching this exact format:
[
  {
    "text": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Why this is correct."
  }
]
Constraints:
1. Provide exactly 4 options per question.
2. Return ONLY valid JSON, no markdown formatting.
3. Make the questions relevant to Unreal Engine 5.`;

      const result = await retryWithBackoff(() => classifyFn({ prompt }), {
        maxRetries: 2,
        baseDelayMs: 1000,
        label: "generateQuiz",
      });
      const responseText = result.data?.text || "";
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Failed to parse AI response into JSON array.");
      
      let jsonStr = jsonMatch[0]
        .replace(/```json?\s*/gi, "")
        .replace(/```\s*/g, "");
      
      const generatedQuestions = JSON.parse(jsonStr);

      if (Array.isArray(generatedQuestions)) {
        setV2Path((prev) => {
          if (!prev) return prev;
          const updated = structuredClone(prev);
          if (!updated.sections[sectionIdx].steps[stepIdx].quiz) {
            updated.sections[sectionIdx].steps[stepIdx].quiz = { questions: [] };
          }
          updated.sections[sectionIdx].steps[stepIdx].quiz.questions = generatedQuestions;
          return updated;
        });
      }
      devLog(`[Authoring] Automatically generated ${generatedQuestions.length} quiz questions for Step ${stepIdx}.`);
    } catch (err) {
      devWarn("[Authoring] Quiz generation failed:", err.message);
      setError(`Failed to generate quiz: ${err.message}`);
    } finally {
      setGeneratingQuizFor(null);
    }
  }, [v2Path, topic]);

  // ── Review: Course-Level Metadata ───────────────────────

  const updateCourseField = useCallback((field, value) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  // ── Brief: Generate Video Briefs ─────────────────────────

  const generateBriefs = useCallback(async () => {
    if (!v2Path) {
      setError("No learning path to generate briefs for");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 1, label: "Generating recording briefs..." });

    try {
      const { generateCourseBriefPackage } = await import("../services/videoBriefService");

      const result = await generateCourseBriefPackage(v2Path, {
        onProgress: (current, total) => {
          setProgress({ current, total, label: `Generating brief ${current}/${total}...` });
        },
      });

      setBriefs(result.briefs || []);
      setBriefMarkdown(result.markdown || "");
      setStage(AUTHORING_STAGES.BRIEF);

      devLog(`[Authoring] Briefs generated: ${result.metadata?.briefsGenerated}/${result.metadata?.totalSteps}`);
    } catch (err) {
      devWarn("[Authoring] Brief generation failed:", err.message);
      setError(`Failed to generate briefs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [v2Path]);

  // ── Brief: Edit Fields ──────────────────────────────────

  const updateBriefField = useCallback((briefIdx, field, value) => {
    setBriefs((prev) => {
      const updated = [...prev];
      if (updated[briefIdx]) {
        updated[briefIdx] = { ...updated[briefIdx], [field]: value };
      }
      return updated;
    });
  }, []);

  const updateBriefListItem = useCallback((briefIdx, field, itemIdx, value) => {
    setBriefs((prev) => {
      const updated = [...prev];
      if (updated[briefIdx]?.[field]) {
        const list = [...updated[briefIdx][field]];
        list[itemIdx] = value;
        updated[briefIdx] = { ...updated[briefIdx], [field]: list };
      }
      return updated;
    });
  }, []);

  // ── Link: Assign Video URLs ──────────────────────────────

  const linkVideo = useCallback((sectionIdx, stepIdx, videoUrl, videoTitle) => {
    setV2Path((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const step = updated.sections?.[sectionIdx]?.steps?.[stepIdx];
      if (step) {
        step.video = {
          ...(step.video || {}),
          url: videoUrl,
          title: videoTitle || step.title,
        };
      }
      return updated;
    });
  }, []);

  // ── Export ────────────────────────────────────────────────

  const exportScorm = useCallback(async () => {
    if (!v2Path) return;
    setLoading(true);
    setError(null);

    try {
      const { exportV2ScormPackage } = await import("../services/scormExportService");
      await exportV2ScormPackage(v2Path);
      devLog("[Authoring] SCORM package exported");
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [v2Path]);

  const exportV3 = useCallback(async () => {
    if (!v2Path) return;
    setLoading(true);
    setError(null);

    try {
      // Convert V2 path to V3 COURSE_LIBRARY format
      const { convertV2ToV3Package } = await import("../schemas/v3Adapter");
      const courseLibrary = convertV2ToV3Package(v2Path);

      // Save to localStorage for the viewer to read
      localStorage.setItem("v3_viewer_course_data", JSON.stringify(courseLibrary));

      // Open the viewer in a new tab
      const viewerUrl = `${window.location.origin}/Unreal-Learning-Path-Tagging-System/viewer-v3/index.html`;
      window.open(viewerUrl, "_blank");

      devLog("[Authoring] V3 viewer opened in new tab");
    } catch (err) {
      setError(`V3 export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [v2Path]);

  const downloadBriefMarkdown = useCallback(() => {
    if (!briefMarkdown) return;

    const blob = new Blob([briefMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording_brief_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [briefMarkdown]);

  // ── Draft Management ──────────────────────────────────────

  const saveDraft = useCallback(() => {
    if (!v2Path || !topic) return;
    const draft = {
      id: Date.now().toString(),
      topic,
      title: v2Path?.title || topic,
      sectionCount: v2Path?.sections?.length || 0,
      stepCount: (v2Path?.sections || []).reduce((s, sec) => s + (sec.steps?.length || 0), 0),
      stage,
      savedAt: new Date().toISOString(),
      state: { stage, topic, v2Path, briefs, briefMarkdown },
    };
    const drafts = loadDrafts();
    // Replace existing draft with same topic, or add new
    const idx = drafts.findIndex((d) => d.topic === topic);
    if (idx >= 0) drafts[idx] = draft;
    else drafts.unshift(draft);
    // Keep max 10 drafts
    const trimmed = drafts.slice(0, 10);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed));
    setSavedDrafts(trimmed);
    devLog(`[Authoring] Draft saved: "${topic}"`);
  }, [v2Path, topic, stage, briefs, briefMarkdown]);

  const loadDraft = useCallback((draftId) => {
    const drafts = loadDrafts();
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft?.state) return;
    setStage(draft.state.stage || AUTHORING_STAGES.PLAN);
    setTopic(draft.state.topic || "");
    setV2Path(autoAddQuizzes(autoNameModules(draft.state.v2Path)) || null);
    setBriefs(draft.state.briefs || []);
    setBriefMarkdown(draft.state.briefMarkdown || "");
    setError(null);
    devLog(`[Authoring] Draft loaded: "${draft.topic}"`);
  }, []);

  const deleteDraft = useCallback((draftId) => {
    const drafts = loadDrafts().filter((d) => d.id !== draftId);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    setSavedDrafts(drafts);
  }, []);

  // ── Computed Stats (auto-calculated, not editable) ────────

  const courseStats = useMemo(() => {
    const sections = v2Path?.sections || [];
    const totalLessons = sections.reduce((s, sec) => s + (sec.steps?.length || 0), 0);
    const totalMinutes = sections.reduce((s, sec) =>
      s + (sec.steps || []).reduce((m, st) => m + (st.estimatedMinutes || 3), 0), 0);
    const linkedVideos = sections.reduce((s, sec) =>
      s + (sec.steps || []).filter((st) => st.video?.url || st.video?.youtubeId || st.video?.driveId).length, 0);
    const quizCount = sections.reduce((s, sec) =>
      s + (sec.steps || []).filter((st) => st.lessonType === "Quiz" || st.quiz).length, 0);
    return { totalLessons, totalMinutes, linkedVideos, quizCount, moduleCount: sections.length };
  }, [v2Path]);

  // ── Reset ────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStage(AUTHORING_STAGES.PLAN);
    setTopic("");
    setV2Path(null);
    setBriefs([]);
    setBriefMarkdown("");
    setLoading(false);
    setError(null);
    setProgress({ current: 0, total: 0, label: "" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Return ───────────────────────────────────────────────

  return {
    // State
    stage,
    topic,
    v2Path,
    briefs,
    briefMarkdown,
    loading,
    error,
    progress,
    courseStats,

    // Constants (for dropdowns)
    DIFFICULTY_LEVELS,
    LESSON_TYPES,

    // Navigation
    canGoNext,
    goNext,
    goBack,
    goToStage,
    currentStageIndex,
    stageOrder: STAGE_ORDER,

    // Actions
    generatePlan,
    updateStepField,
    removeStep,
    reorderStep,
    updateSectionField,
    addLesson,
    addQuizQuestion,
    removeQuizQuestion,
    updateQuizQuestion,
    generateQuizForStep,
    generatingQuizFor,
    updateCourseField,
    generateBriefs,
    updateBriefField,
    updateBriefListItem,
    linkVideo,
    exportScorm,
    exportV3,
    downloadBriefMarkdown,
    reset,

    // Draft management
    savedDrafts,
    saveDraft,
    loadDraft,
    deleteDraft,
  };
}
