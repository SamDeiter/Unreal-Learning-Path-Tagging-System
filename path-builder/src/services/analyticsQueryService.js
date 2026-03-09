/**
 * Analytics Query Service — reads aggregated analytics data from Firestore
 *
 * Used by the Admin Analytics Dashboard to visualize usage patterns.
 * All queries require isAdmin() — enforced by Firestore security rules.
 */

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { EVENTS } from "./analyticsService";

/**
 * Get Firestore db reference
 */
function getDb() {
  return getFirestore(getFirebaseApp());
}

/**
 * Time range helpers
 */
function getTimestampForRange(range) {
  const now = new Date();
  switch (range) {
    case "24h":
      return Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    case "7d":
      return Timestamp.fromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    case "30d":
      return Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    default:
      return Timestamp.fromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  }
}

/**
 * Fetch all analytics events within a time range
 * @param {string} timeRange - "24h", "7d", or "30d"
 * @param {number} maxResults - Maximum events to fetch
 * @returns {Promise<Object[]>} Array of event documents
 */
export async function fetchEvents(timeRange = "7d", maxResults = 2000) {
  const db = getDb();
  const cutoff = getTimestampForRange(timeRange);
  const q = query(
    collection(db, "analytics_events"),
    where("timestamp", ">=", cutoff),
    orderBy("timestamp", "desc"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Aggregate events by type
 * @param {Object[]} events
 * @returns {Object} Map of event type → count
 */
export function countByEventType(events) {
  const counts = {};
  for (const evt of events) {
    const type = evt.event || "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

/**
 * Extract top queries from events
 * @param {Object[]} events
 * @param {number} topN
 * @returns {Object[]} Array of { query, count, personaIds }
 */
export function getTopQueries(events, topN = 10) {
  const queryMap = {};
  for (const evt of events) {
    if (evt.event !== EVENTS.QUERY_SUBMITTED) continue;
    const preview = evt.query_preview || "unknown";
    if (!queryMap[preview]) {
      queryMap[preview] = { query: preview, count: 0, personaIds: new Set() };
    }
    queryMap[preview].count++;
    if (evt.persona_id) queryMap[preview].personaIds.add(evt.persona_id);
  }
  return Object.values(queryMap)
    .map((q) => ({ ...q, personaIds: [...q.personaIds] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * Get persona distribution from detection events
 * @param {Object[]} events
 * @returns {Object[]} Array of { persona, count }
 */
export function getPersonaDistribution(events) {
  const counts = {};
  for (const evt of events) {
    if (evt.event !== EVENTS.PERSONA_DETECTED) continue;
    const name = evt.persona_name || evt.persona_id || "unknown";
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([persona, count]) => ({ persona, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get session metrics
 * @param {Object[]} events
 * @returns {Object} { totalSessions, completedSessions, completionRate }
 */
export function getSessionMetrics(events) {
  const started = events.filter((e) => e.event === EVENTS.SESSION_STARTED).length;
  const completed = events.filter((e) => e.event === EVENTS.SESSION_COMPLETED).length;
  return {
    totalSessions: started,
    completedSessions: completed,
    completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
  };
}

/**
 * Get most recent events for live feed
 * @param {Object[]} events
 * @param {number} count
 * @returns {Object[]}
 */
export function getRecentEvents(events, count = 20) {
  return events.slice(0, count);
}

/**
 * Get events grouped by day for chart
 * @param {Object[]} events
 * @returns {Object[]} Array of { date, count }
 */
export function getEventsByDay(events) {
  const dayMap = {};
  for (const evt of events) {
    const ts = evt.client_timestamp || evt.timestamp?.toDate?.()?.toISOString();
    if (!ts) continue;
    const day = ts.substring(0, 10); // YYYY-MM-DD
    dayMap[day] = (dayMap[day] || 0) + 1;
  }
  return Object.entries(dayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get RAG pipeline health metrics from analytics events.
 * @param {Object[]} events
 * @returns {Object} { avgSimilarity, hybridRate, avgSearchMs, avgSegments, corpusRatio, searchCount, collectionBreakdown }
 */
export function getRAGMetrics(events) {
  const searches = events.filter((e) => e.event === EVENTS.VECTOR_SEARCH_COMPLETED);
  const fallbacks = events.filter((e) => e.event === EVENTS.HYBRID_FALLBACK_TRIGGERED);
  const sequenced = events.filter((e) => e.event === EVENTS.PATH_SEQUENCED);

  const searchCount = searches.length;
  const avgSimilarity =
    searchCount > 0
      ? searches.reduce((sum, e) => sum + (e.best_similarity || 0), 0) / searchCount
      : 0;
  const avgSearchMs =
    searchCount > 0
      ? Math.round(searches.reduce((sum, e) => sum + (e.search_time_ms || 0), 0) / searchCount)
      : 0;
  const avgSegments =
    searchCount > 0
      ? (searches.reduce((sum, e) => sum + (e.total_segments || 0), 0) / searchCount).toFixed(1)
      : "0";

  const totalTranscripts = searches.reduce((sum, e) => sum + (e.transcript_count || 0), 0);
  const totalEpic = searches.reduce((sum, e) => sum + (e.epic_count || 0), 0);
  const totalDocs = searches.reduce((sum, e) => sum + (e.docs_count || 0), 0);

  const hybridRate = searchCount > 0 ? Math.round((fallbacks.length / searchCount) * 100) : 0;

  const avgCorpusRatio =
    sequenced.length > 0
      ? Math.round(
          (sequenced.reduce((sum, e) => sum + (e.corpus_ratio || 0), 0) / sequenced.length) * 100
        )
      : 0;

  return {
    searchCount,
    avgSimilarity: Number(avgSimilarity.toFixed(3)),
    avgSearchMs,
    avgSegments,
    hybridRate,
    hybridCount: fallbacks.length,
    avgCorpusRatio,
    pathCount: sequenced.length,
    collectionBreakdown: {
      transcripts: totalTranscripts,
      epic: totalEpic,
      docs: totalDocs,
    },
  };
}

/**
 * Get step-level feedback metrics from AI_STEP_FEEDBACK events.
 * @param {Object[]} events - All analytics events
 * @returns {Object} { positive, negative, total, recentFeedback, topDownvoted }
 */
export function getFeedbackMetrics(events) {
  const feedbackEvents = events.filter((e) => e.event === EVENTS.AI_STEP_FEEDBACK);
  const positive = feedbackEvents.filter((e) => e.feedback === "positive").length;
  const negative = feedbackEvents.filter((e) => e.feedback === "negative").length;

  // Most recent feedback items (newest first)
  const recentFeedback = feedbackEvents
    .sort((a, b) => (b.client_timestamp || "").localeCompare(a.client_timestamp || ""))
    .slice(0, 10)
    .map((e) => ({
      stepTitle: e.step_title || "(untitled)",
      category: e.category || "unknown",
      query: e.query_preview || "",
      feedback: e.feedback,
      reason: e.reason || null,
      timestamp: e.client_timestamp,
    }));

  // Top downvoted steps (grouped by step_title)
  const downvoteCounts = {};
  feedbackEvents
    .filter((e) => e.feedback === "negative")
    .forEach((e) => {
      const key = e.step_title || "(untitled)";
      downvoteCounts[key] = (downvoteCounts[key] || 0) + 1;
    });
  const topDownvoted = Object.entries(downvoteCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }));

  return { positive, negative, total: feedbackEvents.length, recentFeedback, topDownvoted };
}

/**
 * Get content gap intelligence from AI coverage report events.
 * @param {Object[]} events - All analytics events
 * @returns {Object} { avgAiRatio, totalReports, topGapQueries, knowledgeGapFrequency, gapTrend }
 */
export function getContentGapMetrics(events) {
  const reports = events.filter((e) => e.event === EVENTS.AI_COVERAGE_REPORT);

  if (reports.length === 0) {
    return {
      avgAiRatio: 0,
      totalReports: 0,
      topGapQueries: [],
      knowledgeGapFrequency: [],
      gapTrend: [],
    };
  }

  // Average AI fill ratio
  const avgAiRatio = reports.reduce((sum, r) => sum + (r.ai_ratio || 0), 0) / reports.length;

  // Top queries with highest AI ratio (worst corpus coverage)
  const queryMap = {};
  for (const r of reports) {
    const q = r.query_preview || "unknown";
    if (!queryMap[q]) {
      queryMap[q] = { query: q, totalAiRatio: 0, count: 0, lowCoverage: 0 };
    }
    queryMap[q].totalAiRatio += r.ai_ratio || 0;
    queryMap[q].count++;
    if (r.low_corpus_coverage) queryMap[q].lowCoverage++;
  }
  const topGapQueries = Object.values(queryMap)
    .map((q) => ({
      query: q.query,
      avgAiRatio: Number((q.totalAiRatio / q.count).toFixed(2)),
      count: q.count,
      lowCoverageRate: Math.round((q.lowCoverage / q.count) * 100),
    }))
    .sort((a, b) => b.avgAiRatio - a.avgAiRatio)
    .slice(0, 15);

  // Knowledge gap frequency — what concepts do learners fail on most
  const gapCounts = {};
  for (const r of reports) {
    for (const gap of r.knowledge_gaps || []) {
      gapCounts[gap] = (gapCounts[gap] || 0) + 1;
    }
  }
  const knowledgeGapFrequency = Object.entries(gapCounts)
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Gap trend — AI ratio by day
  const dayMap = {};
  for (const r of reports) {
    const ts = r.client_timestamp || r.timestamp?.toDate?.()?.toISOString();
    if (!ts) continue;
    const day = ts.substring(0, 10);
    if (!dayMap[day]) dayMap[day] = { totalRatio: 0, count: 0 };
    dayMap[day].totalRatio += r.ai_ratio || 0;
    dayMap[day].count++;
  }
  const gapTrend = Object.entries(dayMap)
    .map(([date, d]) => ({
      date,
      avgAiRatio: Number((d.totalRatio / d.count).toFixed(2)),
      reports: d.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    avgAiRatio: Number(avgAiRatio.toFixed(2)),
    totalReports: reports.length,
    topGapQueries,
    knowledgeGapFrequency,
    gapTrend,
  };
}
