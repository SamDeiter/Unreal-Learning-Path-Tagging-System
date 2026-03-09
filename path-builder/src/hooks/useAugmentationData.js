/**
 * useAugmentationData Hook
 *
 * Fetches augmentation_summary.json once and provides a lookup function
 * to get pedagogical quality data for any course by its code.
 *
 * Returns:
 *  - getCourseSummary(courseCode) → { avgGrade, avgScore, verdict, videoCount, ... } | null
 *  - getVideoKeys(courseCode) → ["100_01/02_Documentation", ...] | []
 *  - loading: boolean
 */
import { useState, useEffect, useRef } from "react";

// Singleton cache so multiple components don't re-fetch
let cachedData = null;
let cachedVideoKeys = null;
let fetchPromise = null;

function gradeFromScore(score) {
  if (score >= 45) return "A";
  if (score >= 39) return "B";
  if (score >= 33) return "C";
  if (score >= 22) return "D";
  return "F";
}

export function useAugmentationData() {
  const [courseMap, setCourseMap] = useState(() => cachedData);
  const [videoKeysMap, setVideoKeysMap] = useState(() => cachedVideoKeys);
  const [loading, setLoading] = useState(() => !cachedData);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (cachedData) return;

    if (!fetchPromise) {
      fetchPromise = fetch(`${import.meta.env.BASE_URL}augmentation_summary.json`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
    }

    fetchPromise.then((data) => {
      if (!data || !data.videos) {
        if (mounted.current) setLoading(false);
        return;
      }

      // Build course-level aggregates
      const map = {};
      for (const v of data.videos) {
        const code = v.course;
        if (!map[code]) {
          map[code] = {
            videos: [],
            totalScore: 0,
            totalProcedural: 0,
            totalConceptual: 0,
            totalTheoryBreaks: 0,
            totalWarnings: 0,
            courseTitle: v.course_title || "",
          };
        }
        map[code].videos.push(v);
        map[code].totalScore += v.score || 0;
        map[code].totalProcedural += v.procedural_pct || 0;
        map[code].totalConceptual += v.conceptual_pct || 0;
        map[code].totalTheoryBreaks += v.theory_breaks || 0;
        map[code].totalWarnings += v.warnings || 0;
      }

      // Compute averages
      const result = {};
      for (const [code, c] of Object.entries(map)) {
        const n = c.videos.length;
        const avgScore = Math.round(c.totalScore / n);
        result[code] = {
          avgScore,
          avgGrade: gradeFromScore(avgScore),
          avgProcedural: Math.round(c.totalProcedural / n),
          avgConceptual: Math.round(c.totalConceptual / n),
          theoryBreaks: c.totalTheoryBreaks,
          warnings: c.totalWarnings,
          videoCount: n,
          courseTitle: c.courseTitle,
          // Verdict: majority rules
          verdict: avgScore < 33 ? "NEEDS_AUGMENTATION" : avgScore < 45 ? "ADEQUATE" : "STRONG",
        };
      }

      // Build video keys map: courseCode → [videoKey1, videoKey2, ...]
      const vkMap = {};
      for (const v of data.videos) {
        const code = v.course;
        if (!vkMap[code]) vkMap[code] = [];
        vkMap[code].push(v.key);
      }

      cachedData = result;
      cachedVideoKeys = vkMap;
      if (mounted.current) {
        setCourseMap(result);
        setVideoKeysMap(vkMap);
        setLoading(false);
      }
    });

    return () => {
      mounted.current = false;
    };
  }, []);

  const getCourseSummary = (courseCode) => {
    if (!courseMap || !courseCode) return null;
    return courseMap[courseCode] || null;
  };

  const getVideoKeys = (courseCode) => {
    if (!videoKeysMap || !courseCode) return [];
    return videoKeysMap[courseCode] || [];
  };

  return { getCourseSummary, getVideoKeys, loading };
}
