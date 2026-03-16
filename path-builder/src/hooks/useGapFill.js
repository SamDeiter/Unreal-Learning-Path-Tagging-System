/**
 * useGapFill — Shared gap fill state + callbacks
 *
 * Encapsulates the 3-tier gap fill logic (library → bespoke → AI)
 * so it can be reused across AdaptivePath, BespokePath, and PathIntelligencePanel.
 */
import { useState, useCallback, useMemo } from "react";
import { generateGapFillStep, generateBespokeGapStep } from "../services/pathGapAnalyzer";
import { trackGapFillCompleted } from "../services/analyticsService";

export default function useGapFill(courses, addCourse, learningIntent) {
  const [fillResults, setFillResults] = useState({});
  const [fillingGap, setFillingGap] = useState(null);

  // Count how many gaps have been addressed
  const filledCount = useMemo(
    () =>
      Object.values(fillResults).filter(
        (r) => r && (r.addedCode || r.bespokeGenerated || r.addedSegments?.length > 0)
      ).length,
    [fillResults]
  );

  // ── Fill a gap topic using the 3-tier approach ──
  const handleFillGap = useCallback(
    async (topic) => {
      if (fillingGap) return;
      setFillingGap(topic);
      try {
        const steps = courses.map((c) => ({
          category: "core",
          segment: { title: c.title || "", text: c.description || "" },
        }));
        const existingCodes = courses.map((c) => c.code).filter(Boolean);
        const result = await generateGapFillStep(
          topic,
          learningIntent?.primaryGoal || "",
          steps,
          existingCodes
        );
        setFillResults((prev) => ({ ...prev, [topic]: result }));
        // Track completion with tier info
        trackGapFillCompleted(
          topic,
          result?.source || "error",
          false, // not yet accepted — user still needs to click Add
          learningIntent?.primaryGoal
        );
      } catch {
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
        trackGapFillCompleted(topic, "error", false, learningIntent?.primaryGoal);
      } finally {
        setFillingGap(null);
      }
    },
    [fillingGap, courses, learningIntent]
  );

  // ── Add a matched library course ──
  const handleAddLibraryCourse = useCallback(
    (courseMatch, topic) => {
      addCourse({
        code: courseMatch.code,
        title: courseMatch.title,
        role: "core",
        isGapFill: true,
        gapTopic: topic,
      });
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], addedCode: courseMatch.code },
      }));
      trackGapFillCompleted(topic, "library", true, learningIntent?.primaryGoal);
    },
    [addCourse, learningIntent]
  );

  // ── Generate a bespoke step from video segments ──
  const handleBespokeGenerate = useCallback(
    (segments, topic) => {
      const bespokeStep = generateBespokeGapStep(topic, segments);
      addCourse(bespokeStep);
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], bespokeGenerated: true },
      }));
      trackGapFillCompleted(topic, "bespoke", true, learningIntent?.primaryGoal);
    },
    [addCourse, learningIntent]
  );

  // ── Add a single video segment as a path step ──
  const handleAddSegment = useCallback(
    (segment, topic, segIndex) => {
      addCourse({
        code: `bespoke-${topic}-${segIndex}`,
        title: segment.title || `${topic} Segment`,
        description: segment.text || "",
        videoTitle: segment.videoTitle || "",
        role: "core",
        type: "bespoke-segment",
        isGapFill: true,
        gapTopic: topic,
      });
      setFillResults((prev) => ({
        ...prev,
        [topic]: {
          ...prev[topic],
          addedSegments: [...(prev[topic]?.addedSegments || []), segIndex],
        },
      }));
      trackGapFillCompleted(topic, "bespoke", true, learningIntent?.primaryGoal);
    },
    [addCourse, learningIntent]
  );

  // ── Bulk fill all unfilled gaps ──
  const [bulkFilling, setBulkFilling] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const handleFillAllGaps = useCallback(
    async (blindSpots = []) => {
      const unfilled = blindSpots.filter((bs) => !fillResults[bs.topic]);
      if (unfilled.length === 0 || bulkFilling) return;

      setBulkFilling(true);
      setBulkProgress({ done: 0, total: unfilled.length });

      for (let i = 0; i < unfilled.length; i++) {
        const topic = unfilled[i].topic;
        try {
          const steps = courses.map((c) => ({
            category: "core",
            segment: { title: c.title || "", text: c.description || "" },
          }));
          const existingCodes = courses.map((c) => c.code).filter(Boolean);
          const result = await generateGapFillStep(
            topic,
            learningIntent?.primaryGoal || "",
            steps,
            existingCodes
          );
          setFillResults((prev) => ({ ...prev, [topic]: result }));
          trackGapFillCompleted(
            topic,
            result?.source || "error",
            false,
            learningIntent?.primaryGoal
          );
        } catch {
          setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
        }
        setBulkProgress({ done: i + 1, total: unfilled.length });
      }

      setBulkFilling(false);
    },
    [courses, learningIntent, fillResults, bulkFilling]
  );

  return {
    fillResults,
    fillingGap,
    filledCount,
    handleFillGap,
    handleAddLibraryCourse,
    handleBespokeGenerate,
    handleAddSegment,
    handleFillAllGaps,
    bulkFilling,
    bulkProgress,
  };
}
