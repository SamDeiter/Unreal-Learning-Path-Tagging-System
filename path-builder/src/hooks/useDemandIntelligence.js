/**
 * useDemandIntelligence.js — React hook for Demand Intelligence
 *
 * Manages the lifecycle of demand report generation:
 *   - Loading / error / data states
 *   - Cached report re-use
 *   - Refresh trigger
 *   - Category filtering
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
export function useDemandIntelligence(engine = "UE5") {
  const { courses } = useTagData();

  // Seed from synchronous cache so we never flash a spinner if data exists
  const [report, setReport] = useState(() => getCachedReport(engine));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const abortRef = useRef(false);
  const lockRef = useRef(false);

  // Re-seed if engine changes dynamically (important when switching tabs)
  useEffect(() => {
    setReport(getCachedReport(engine));
  }, [engine]);

  /**
   * Generate (or re-use cached) demand report.
   * Uses a ref-based lock to prevent double-invocation from React StrictMode.
   */
  const generate = useCallback(async ({ skipCache = false, skipFirestore = false, firestoreOnly = false } = {}) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      devLog(`[useDemandIntelligence:${engine}] Generating report...`);
      const result = await generateDemandReport(courses, { skipCache, skipFirestore, firestoreOnly, engine });

      if (!abortRef.current) {
        setReport(result);
        devLog(`[useDemandIntelligence:${engine}] Report ready`);
      }
    } catch (err) {
      if (!abortRef.current) {
        devWarn(`[useDemandIntelligence:${engine}] Error:`, err.message);
        setError(err.message);
      }
    } finally {
      setLoading(false);
      lockRef.current = false;
    }
  }, [courses, engine]);

  /**
   * Force-refresh — clears cache and regenerates.
   */
  const refresh = useCallback(() => {
    clearDemandCache(engine);
    generate({ skipCache: true });
  }, [generate, engine]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  // ── Derived data ─────────────────────────────────────────

  // Filtered suggestions based on active category filter
  const filteredSuggestions = useMemo(() =>
    report?.suggestions?.filter(
      (s) => !categoryFilter || s.category === categoryFilter
    ) || []
  , [report?.suggestions, categoryFilter]);

  // Unique categories present in suggestions
  const availableCategories = useMemo(() =>
    [...new Set((report?.suggestions || []).map((s) => s.category))].sort()
  , [report?.suggestions]);

  // Summary stats — with fallback derivation from suggestion sources
  // When Firestore pre-computed data has empty trendingQuestions/painPoints
  // (e.g. Gemini Grounded Search returned 0 results), derive counts from
  // the relatedQuestion and painPoint fields embedded in suggestion sources.
  const _directTrending = report?.trendingQuestions?.length || 0;
  const _directPainPoints = Object.values(report?.painPointsByCategory || {}).flat().length;

  // Fallback 1: count unique relatedQuestion/painPoint fields in sources
  const _sourceTrending = useMemo(() =>
    new Set(
      (report?.suggestions || [])
        .flatMap((s) => s.sources || [])
        .filter((src) => src.relatedQuestion)
        .map((src) => src.relatedQuestion)
    ).size
  , [report?.suggestions]);

  const _sourcePainPoints = useMemo(() =>
    new Set(
      (report?.suggestions || [])
        .flatMap((s) => s.sources || [])
        .filter((src) => src.painPoint)
        .map((src) => src.painPoint)
    ).size
  , [report?.suggestions]);

  // Fallback 2: derive from suggestions themselves when sources are also empty
  // High-gap topics (gap > 30) indicate trending unmet demand
  const _topicTrending = useMemo(() =>
    (report?.suggestions || []).filter((s) => s.gap > 30).length
  , [report?.suggestions]);

  // Unique categories with at least one gap > 0 represent pain point areas
  const _categoryPainPoints = useMemo(() =>
    new Set(
      (report?.suggestions || [])
        .filter((s) => s.gap > 0)
        .map((s) => s.category)
    ).size
  , [report?.suggestions]);

  const _derivedTrending = _directTrending || _sourceTrending || _topicTrending;
  const _derivedPainPoints = _directPainPoints || _sourcePainPoints || _categoryPainPoints;

  const stats = useMemo(() =>
    report ? {
      totalSuggestions: report.suggestions?.length || 0,
      trendingQuestions: _derivedTrending,
      painPointCount: _derivedPainPoints,
      categoriesScanned: report.provenance?.communitySearch?.categoriesScanned || 0,
      generationTimeMs: report.generationTimeMs || 0,
      generatedAt: report.generatedAt || null,
    } : null
  , [report, _derivedTrending, _derivedPainPoints]);

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
