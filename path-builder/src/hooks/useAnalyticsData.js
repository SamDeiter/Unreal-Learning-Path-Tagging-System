/**
 * useAnalyticsData — Hook to manage analytics event state,
 * extracted from App.jsx to reduce root component complexity.
 */
import { useState, useEffect } from "react";
import { fetchEvents } from "../services/analyticsQueryService";

export default function useAnalyticsData(activeTab, userIsAdmin) {
  const [analyticsEvents, setAnalyticsEvents] = useState([]);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState("7d");

  useEffect(() => {
    // Only admins see analytics tabs — skip expensive fetch for regular users
    if (!userIsAdmin) return;
    if (activeTab.startsWith("analytics-") && analyticsEvents.length === 0) {
      let cancelled = false;
      (async () => {
        try {
          const data = await fetchEvents(analyticsTimeRange);
          if (!cancelled) setAnalyticsEvents(data);
        } catch (err) {
          console.error("[App] Failed to load analytics events:", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, analyticsEvents.length, analyticsTimeRange, userIsAdmin]);

  return {
    analyticsEvents,
    setAnalyticsEvents,
    analyticsTimeRange,
    setAnalyticsTimeRange,
  };
}
