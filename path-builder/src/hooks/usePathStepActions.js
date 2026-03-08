/**
 * usePathStepActions — Shared hook for step-level audio, takeaways, and deep dives.
 *
 * Used by both BespokePath and AdaptivePath to manage:
 *   - On-demand audio generation (with voice selection + next-step pre-gen)
 *   - On-demand takeaway generation (auto-loads on step change)
 *   - On-demand deep dive generation
 *
 * @param {Object}  options
 * @param {Object}  options.pathData   - The path result ({ path, query, ... })
 * @param {string}  options.query      - The user's query
 * @param {string}  [options.voiceName]  - Voice for audio generation (default: null = service default)
 * @param {string}  [options.userLevel]  - Learner level for deep dives (e.g. "beginner")
 * @param {number}  [options.activeStep] - Currently visible step index, used for auto-load
 * @returns {{
 *   stepAudio: Object, stepTakeaways: Object, stepDeepDives: Object,
 *   handleStepAudio: Function, handleStepTakeaways: Function,
 *   handleGoDeeper: Function, handleAudioEnded: Function,
 *   resetStepActions: Function, setActiveStepIndex: Function
 * }}
 */

import { useState, useCallback, useEffect } from "react";
import {
  generateStepAudio,
  generateStepTakeaways,
  generateStepDeepDive,
} from "../services/stepBriefingService";
import { fixEpicUrl } from "../utils/urlHelpers";

export default function usePathStepActions({
  pathData,
  query,
  voiceName = null,
  userLevel = "intermediate",
  activeStep = null,
} = {}) {
  // State: { [stepIndex]: { url|items|sections, loading, error } }
  const [stepAudio, setStepAudio] = useState({});
  const [stepTakeaways, setStepTakeaways] = useState({});
  const [stepDeepDives, setStepDeepDives] = useState({});

  // ── Audio ──────────────────────────────────────────────

  /**
   * Generate audio for a specific step. Includes:
   * - Step-position detection (first/middle/last) for greeting/outro
   * - Source link collection for final step narration
   * - Pre-generation of the next step's audio in background
   */
  const handleStepAudio = useCallback(
    async (stepIndex, step) => {
      // Allow passing step directly OR looking it up from pathData
      const resolvedStep = step || pathData?.path?.[stepIndex];
      if (!resolvedStep || stepAudio[stepIndex]?.url || stepAudio[stepIndex]?.loading) return;
      if (!pathData) return;

      setStepAudio((prev) => ({ ...prev, [stepIndex]: { loading: true } }));

      const totalSteps = pathData.path?.length ?? 0;
      const stepPosition =
        stepIndex === 0 ? "first" : stepIndex >= totalSteps - 1 ? "last" : "middle";

      // Collect source links for further reading (used in last step narration)
      const sourceLinks =
        stepPosition === "last" && pathData.path
          ? pathData.path
              .map((s) => ({
                title: s.segment?.title || s.segment?.videoTitle || "",
                url: fixEpicUrl(s.segment?.videoUrl || s.segment?.url || ""),
              }))
              .filter((s) => s.title)
          : [];

      try {
        const audioOpts = { stepPosition, sourceLinks };
        if (voiceName) audioOpts.voiceName = voiceName;

        const audioUrl = await generateStepAudio(resolvedStep, query, audioOpts);
        setStepAudio((prev) => ({
          ...prev,
          [stepIndex]: { url: audioUrl || null, loading: false },
        }));

        // Pre-generate next step's audio in background
        const nextIdx = stepIndex + 1;
        if (nextIdx < totalSteps && !stepAudio[nextIdx]) {
          const nextPosition = nextIdx >= totalSteps - 1 ? "last" : "middle";
          const nextOpts = { stepPosition: nextPosition };
          if (voiceName) nextOpts.voiceName = voiceName;

          generateStepAudio(pathData.path[nextIdx], query, nextOpts)
            .then((nextUrl) => {
              setStepAudio((prev) => {
                if (prev[nextIdx]) return prev; // Already loaded
                return { ...prev, [nextIdx]: { url: nextUrl || null, loading: false } };
              });
            })
            .catch(() => {}); // Swallow pre-gen errors
        }
      } catch {
        setStepAudio((prev) => ({ ...prev, [stepIndex]: { error: true, loading: false } }));
      }
    },
    [query, stepAudio, pathData, voiceName]
  );

  // ── Takeaways ──────────────────────────────────────────

  /**
   * Generate takeaways for a specific step.
   */
  const handleStepTakeaways = useCallback(
    async (stepIndex, step) => {
      const resolvedStep = step || pathData?.path?.[stepIndex];
      if (!resolvedStep || stepTakeaways[stepIndex]) return;

      setStepTakeaways((prev) => ({ ...prev, [stepIndex]: { loading: true } }));
      try {
        const result = await generateStepTakeaways(resolvedStep, query);
        setStepTakeaways((prev) => ({
          ...prev,
          [stepIndex]: { items: result, loading: false },
        }));
      } catch {
        setStepTakeaways((prev) => ({
          ...prev,
          [stepIndex]: { error: true, loading: false },
        }));
      }
    },
    [query, stepTakeaways, pathData]
  );

  /**
   * Auto-load takeaways when the active step changes.
   */
  useEffect(() => {
    if (!pathData?.path || pathData.path.length === 0) return;
    if (activeStep === null || activeStep === undefined || activeStep < 0) return;
    if (activeStep >= pathData.path.length) return;

    if (!stepTakeaways[activeStep]) {
      const step = pathData.path[activeStep];
      const idx = activeStep;
      const id = setTimeout(() => handleStepTakeaways(idx, step), 0);
      return () => clearTimeout(id);
    }
  }, [activeStep, pathData, handleStepTakeaways, stepTakeaways]);

  // ── Deep Dives ─────────────────────────────────────────

  /**
   * Generate a deep dive for a specific step (on demand).
   */
  const handleGoDeeper = useCallback(
    async (stepIndex) => {
      const step = pathData?.path?.[stepIndex];
      if (!step || stepDeepDives[stepIndex]?.sections || stepDeepDives[stepIndex]?.loading) return;

      setStepDeepDives((prev) => ({ ...prev, [stepIndex]: { loading: true } }));
      try {
        const result = await generateStepDeepDive(step, query, {
          userLevel,
          existingTakeaways: stepTakeaways[stepIndex]?.items || [],
        });
        setStepDeepDives((prev) => ({
          ...prev,
          [stepIndex]: {
            loading: false,
            sections: result?.sections || [],
            editorContext: result?.editorContext || "",
          },
        }));
      } catch {
        setStepDeepDives((prev) => ({
          ...prev,
          [stepIndex]: { loading: false, error: true },
        }));
      }
    },
    [pathData, query, userLevel, stepTakeaways, stepDeepDives]
  );

  // ── Utilities ──────────────────────────────────────────

  /**
   * Reset all step action state (call when generating a new path).
   */
  const resetStepActions = useCallback(() => {
    setStepAudio({});
    setStepTakeaways({});
    setStepDeepDives({});
  }, []);

  return {
    stepAudio,
    stepTakeaways,
    stepDeepDives,
    handleStepAudio,
    handleStepTakeaways,
    handleGoDeeper,
    resetStepActions,
  };
}
