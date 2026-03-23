/**
 * useDemandIntelligence.js — React hook for Demand Intelligence
 *
 * Manages the lifecycle of demand report generation:
 *   - Loading / error / data states
 *   - Cached report re-use
 *   - Refresh trigger
 *   - Category filtering
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTagData } from "../context/TagDataContext";
import {
  generateDemandReport,
  clearDemandCache,
  getCachedReport,
} from "../services/demandIntelligenceService";
import { devLog, devWarn } from "../utils/logger";

/**
 * @returns {Object} hook state and actions
 */
export function useDemandIntelligence() {
  const { courses } = useTagData();

  // Seed from synchronous cache so we never flash a spinner if data exists
  const [report, setReport] = useState(() => getCachedReport());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const abortRef = useRef(false);
  const lockRef = useRef(false);

  /**
   * Generate (or re-use cached) demand report.
   * Uses a ref-based lock to prevent double-invocation from React StrictMode.
   */
  const generate = useCallback(async ({ skipCache = false } = {}) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      devLog("[useDemandIntelligence] Generating report...");
      const result = await generateDemandReport(courses, { skipCache });

      if (!abortRef.current) {
        setReport(result);
        devLog("[useDemandIntelligence] Report ready");
      }
    } catch (err) {
      if (!abortRef.current) {
        devWarn("[useDemandIntelligence] Error:", err.message);
        setError(err.message);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
      lockRef.current = false;
    }
  }, [courses]);

  /**
   * Force-refresh — clears cache and regenerates.
   */
  const refresh = useCallback(() => {
    clearDemandCache();
    generate({ skipCache: true });
  }, [generate]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  // ── Derived data ─────────────────────────────────────────

  // Filtered suggestions based on active category filter
  const filteredSuggestions = report?.suggestions?.filter(
    (s) => !categoryFilter || s.category === categoryFilter
  ) || [];

  // Unique categories present in suggestions
  const availableCategories = [
    ...new Set((report?.suggestions || []).map((s) => s.category)),
  ].sort();

  // Summary stats — with fallback derivation from suggestion sources
  // When Firestore pre-computed data has empty trendingQuestions/painPoints
  // (e.g. Gemini Grounded Search returned 0 results), derive counts from
  // the relatedQuestion and painPoint fields embedded in suggestion sources.
  const _directTrending = report?.trendingQuestions?.length || 0;
  const _directPainPoints = Object.values(report?.painPointsByCategory || {}).flat().length;

  const _derivedTrending = _directTrending || new Set(
    (report?.suggestions || [])
      .flatMap((s) => s.sources || [])
      .filter((src) => src.relatedQuestion)
      .map((src) => src.relatedQuestion)
  ).size;

  const _derivedPainPoints = _directPainPoints || new Set(
    (report?.suggestions || [])
      .flatMap((s) => s.sources || [])
      .filter((src) => src.painPoint)
      .map((src) => src.painPoint)
  ).size;

  const stats = report ? {
    totalSuggestions: report.suggestions?.length || 0,
    trendingQuestions: _derivedTrending,
    painPointCount: _derivedPainPoints,
    categoriesScanned: report.provenance?.communitySearch?.categoriesScanned || 0,
    generationTimeMs: report.generationTimeMs || 0,
    generatedAt: report.generatedAt || null,
  } : null;

  return {
    // State
    report,
    loading,
    error,
    stats,

    // Filtered views
    filteredSuggestions,
    availableCategories,
    categoryFilter,

    // Actions
    generate,
    refresh,
    setCategoryFilter,
  };
}

export default useDemandIntelligence;
