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
} from "../services/demandIntelligenceService";
import { devLog, devWarn } from "../utils/logger";

/**
 * @returns {Object} hook state and actions
 */
export function useDemandIntelligence() {
  const { courses } = useTagData();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const abortRef = useRef(false);

  /**
   * Generate (or re-use cached) demand report.
   */
  const generate = useCallback(async ({ skipCache = false } = {}) => {
    if (loading) return;
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
    }
  }, [courses, loading]);

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

  // Summary stats
  const stats = report ? {
    totalSuggestions: report.suggestions?.length || 0,
    trendingQuestions: report.trendingQuestions?.length || 0,
    painPointCount: Object.values(report.painPointsByCategory || {}).flat().length,
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
