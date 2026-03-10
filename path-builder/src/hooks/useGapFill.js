/**
 * useGapFill — Shared gap fill state + callbacks
 *
 * Encapsulates the 3-tier gap fill logic (library → bespoke → AI)
 * so it can be reused across AdaptivePath, BespokePath, and PathIntelligencePanel.
 */
import { useState, useCallback, useMemo } from "react";
import { generateGapFillStep, generateBespokeGapStep } from "../services/pathGapAnalyzer";

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
      } catch {
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
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
    },
    [addCourse]
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
    },
    [addCourse]
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
    },
    [addCourse]
  );

  return {
    fillResults,
    fillingGap,
    filledCount,
    handleFillGap,
    handleAddLibraryCourse,
    handleBespokeGenerate,
    handleAddSegment,
  };
}
