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

import { useState, useCallback } from "react";
import { devLog, devWarn } from "../utils/logger";

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

export default function useAuthoringWorkbench() {
  // ── State ────────────────────────────────────────────────

  const [stage, setStage] = useState(AUTHORING_STAGES.PLAN);
  const [topic, setTopic] = useState("");
  const [v2Path, setV2Path] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [briefMarkdown, setBriefMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });

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

      // generateBespokePath already runs editorialPass internally
      setV2Path(result.v2Path);
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
    generateBriefs,
    updateBriefField,
    updateBriefListItem,
    linkVideo,
    exportScorm,
    exportV3,
    downloadBriefMarkdown,
    reset,
  };
}
