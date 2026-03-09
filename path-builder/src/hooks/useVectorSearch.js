/**
 * useVectorSearch — Async vector search hook for course matching
 *
 * Fires findRelevantSegments after a debounce, maps segment results
 * back to course codes, and returns merged results.
 * Keeps the UI responsive by running async alongside keyword matches.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { findRelevantSegments } from "../services/pathSearch";

const DEBOUNCE_MS = 400;
const TOP_K = 15;

/**
 * @param {string} query  — The user's search query
 * @param {Array}  courses — Full course catalog for code→course mapping
 * @returns {{ vectorResults: Array, isSearching: boolean }}
 */
export function useVectorSearch(query, courses) {
  const [vectorResults, setVectorResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  // Build a lookup: courseCode → course object
  const courseMap = useRef(new Map());
  useEffect(() => {
    const map = new Map();
    courses.forEach((c) => map.set(c.code, c));
    courseMap.current = map;
  }, [courses]);

  const runSearch = useCallback(async (q, signal) => {
    try {
      setIsSearching(true);
      const { segments } = await findRelevantSegments(q, TOP_K);
      if (signal?.aborted) return;

      // Map segments → unique courses with scores
      const scoreMap = new Map();
      segments.forEach((seg) => {
        const code = seg.courseCode || seg.video_code;
        if (!code) return;
        const existing = scoreMap.get(code) || 0;
        scoreMap.set(code, existing + (seg.similarity || 0.5));
      });

      // Convert to course objects, sorted by aggregated score
      const results = [...scoreMap.entries()]
        .map(([code, score]) => ({
          course: courseMap.current.get(code),
          vectorScore: score,
        }))
        .filter((r) => r.course)
        .sort((a, b) => b.vectorScore - a.vectorScore)
        .map((r) => r.course);

      if (!signal?.aborted) {
        setVectorResults(results);
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.warn("[useVectorSearch] Search failed:", err.message);
        setVectorResults([]);
      }
    } finally {
      if (!signal?.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    // Clear previous
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = (query || "").trim();
    if (trimmed.length < 3) {
      setVectorResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(() => {
      runSearch(trimmed, controller.signal);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerRef.current);
      controller.abort();
    };
  }, [query, runSearch]);

  return { vectorResults, isSearching };
}
