/**
 * AdminAnalytics — Overview sub-page
 * Stat cards, daily volume, top queries, and recent events.
 * Pipeline, costs, and content gaps are in their own sub-pages.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  fetchEvents,
  countByEventType,
  getTopQueries,
  getSessionMetrics,
  getRecentEvents,
  getEventsByDay,
  getFeedbackMetrics,
} from "../../services/analyticsQueryService";
import { EVENTS } from "../../services/analyticsService";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import "./AdminAnalytics.css";

const TIME_RANGES = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

const EVENT_META = {
  [EVENTS.QUERY_SUBMITTED]: { label: "Queries", color: "#8b5cf6" },
  [EVENTS.SESSION_STARTED]: { label: "Sessions", color: "#06b6d4" },
  [EVENTS.SESSION_COMPLETED]: { label: "Completed", color: "#10b981" },
  [EVENTS.PERSONA_DETECTED]: { label: "Personas", color: "#f59e0b" },
  [EVENTS.DIAGNOSIS_GENERATED]: { label: "Diagnoses", color: "#ec4899" },
  [EVENTS.LEARNING_PATH_GENERATED]: { label: "Paths", color: "#6366f1" },
  [EVENTS.INTENT_EXTRACTED]: { label: "Intents", color: "#14b8a6" },
  [EVENTS.MODULE_SKIPPED]: { label: "Skipped", color: "#ef4444" },
  [EVENTS.MODULE_REORDERED]: { label: "Reordered", color: "#f97316" },
  [EVENTS.FOLLOWUP_QUERY_SUBMITTED]: { label: "Follow-ups", color: "#a855f7" },
  [EVENTS.ONBOARDING_PATH_GENERATED]: { label: "Onboarding", color: "#22d3ee" },
  [EVENTS.VECTOR_SEARCH_COMPLETED]: { label: "Searches", color: "#3b82f6" },
  [EVENTS.HYBRID_FALLBACK_TRIGGERED]: { label: "Fallbacks", color: "#f43f5e" },
  [EVENTS.PATH_SEQUENCED]: { label: "Sequenced", color: "#6366f1" },
  [EVENTS.AI_COVERAGE_REPORT]: { label: "AI Coverage", color: "#f97316" },
  [EVENTS.AI_STEP_FEEDBACK]: { label: "Feedback", color: "#eab308" },
};

function Tip({ text }) {
  return (
    <span className="aa-tooltip-wrap">
      <span className="aa-info-icon">ⓘ</span>
      <span className="aa-tooltip-text">{text}</span>
    </span>
  );
}

/**
 * AdminAnalytics — the Overview sub-page.
 * Also exposes events via onEventsLoaded for sibling sub-pages.
 */
export default function AdminAnalytics({ onEventsLoaded, onTimeRangeChange }) {
  const [timeRange, setTimeRange] = useState("7d");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cacheRef = useRef({ range: null, events: null });

  const loadData = useCallback(async () => {
    if (cacheRef.current.range === timeRange && cacheRef.current.events) {
      setEvents(cacheRef.current.events);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const eventData = await fetchEvents(timeRange);
      setEvents(eventData);
      cacheRef.current = { range: timeRange, events: eventData };
      // Share events with parent for sibling sub-pages
      if (onEventsLoaded) onEventsLoaded(eventData);
    } catch (err) {
      console.error("[AdminAnalytics] Failed to load:", err);
      setError(err.message || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [timeRange, onEventsLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (onTimeRangeChange) onTimeRangeChange(timeRange);
  }, [timeRange, onTimeRangeChange]);

  const eventCounts = useMemo(() => countByEventType(events), [events]);
  const topQueries = useMemo(() => getTopQueries(events), [events]);
  const sessionMetrics = useMemo(() => getSessionMetrics(events), [events]);
  const dailyVolume = useMemo(() => getEventsByDay(events), [events]);
  const recentEvents = useMemo(() => getRecentEvents(events, 15), [events]);
  const feedbackMetrics = useMemo(() => getFeedbackMetrics(events), [events]);

  const totalQueries = eventCounts[EVENTS.QUERY_SUBMITTED] || 0;

  if (loading) {
    return (
      <div className="admin-analytics">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-analytics">
        <div className="aa-error">
          <p>⚠️ {error}</p>
          <button onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      {/* Header */}
      <div className="aa-header">
        <div>
          <h2>
            📊 Usage Overview <Tip text="Real-time usage data from Firestore analytics_events" />
          </h2>
          <p className="aa-subtitle">{events.length} events in selected period</p>
        </div>
        <div className="aa-time-range">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              className={`aa-range-btn ${timeRange === r.key ? "active" : ""}`}
              onClick={() => setTimeRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="aa-stats-row">
        <StatCard
          label="Total Events"
          value={events.length}
          icon="📊"
          color="#8b5cf6"
          tooltip="Total tracked interactions"
        />
        <StatCard
          label="Queries"
          value={totalQueries}
          icon="🔍"
          color="#06b6d4"
          tooltip="Search queries submitted"
        />
        <StatCard
          label="Sessions"
          value={sessionMetrics.totalSessions}
          icon="👤"
          color="#10b981"
          tooltip="Unique user sessions started"
        />
        <StatCard
          label="Completion"
          value={`${sessionMetrics.completionRate}%`}
          icon="✅"
          color="#f59e0b"
          tooltip="Percentage of completed sessions"
        />
      </div>

      {/* Daily Volume + Top Queries side by side */}
      <div className="aa-grid">
        <div className="aa-section">
          <h3>
            📅 Daily Volume <Tip text="Events per day" />
          </h3>
          {dailyVolume.length > 0 ? (
            <div className="aa-daily-chart">
              {dailyVolume.map((day) => {
                const maxDay = Math.max(...dailyVolume.map((d) => d.count), 1);
                const pct = Math.round((day.count / maxDay) * 100);
                return (
                  <div key={day.date} className="aa-day-bar" title={`${day.date}: ${day.count}`}>
                    <div className="aa-day-fill" style={{ height: `${pct}%` }} />
                    <span className="aa-day-label">{day.date.substring(5)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="aa-empty">No events in selected period</p>
          )}
        </div>

        <div className="aa-section">
          <h3>
            🔍 Top Queries <Tip text="Most searched topics" />
          </h3>
          {topQueries.length === 0 ? (
            <p className="aa-empty">No queries in selected period</p>
          ) : (
            <ol className="aa-query-list">
              {topQueries.map((q, i) => (
                <li key={i} className="aa-query-item">
                  <span className="aa-query-text">{q.query}</span>
                  <span className="aa-query-count">{q.count}×</span>
                  {q.engine && (
                    <span className={`aa-engine-badge ${q.engine.toLowerCase()}`}>
                      {q.engine}
                    </span>
                  )}
                  {q.personaIds.length > 0 && (
                    <span className="aa-query-personas">
                      {q.personaIds.map((p) => (
                        <span key={p} className="aa-persona-badge">
                          {p}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Step Feedback Intelligence */}
      <div className="aa-section">
        <h3>
          👍👎 Step Feedback <Tip text="Thumbs up/down from learners on AI-generated path steps" />
        </h3>
        <div className="aa-stats-row" style={{ marginBottom: "1rem" }}>
          <StatCard
            label="Thumbs Up"
            value={feedbackMetrics.positive}
            icon="👍"
            color="#10b981"
            tooltip="Positive step feedback"
          />
          <StatCard
            label="Thumbs Down"
            value={feedbackMetrics.negative}
            icon="👎"
            color="#ef4444"
            tooltip="Negative step feedback"
          />
          <StatCard
            label="Approval Rate"
            value={
              feedbackMetrics.total > 0
                ? `${Math.round((feedbackMetrics.positive / feedbackMetrics.total) * 100)}%`
                : "—"
            }
            icon="📈"
            color="#8b5cf6"
            tooltip="Positive / total feedback"
          />
          <StatCard
            label="Total Feedback"
            value={feedbackMetrics.total}
            icon="💬"
            color="#06b6d4"
            tooltip="Total feedback events"
          />
        </div>

        <div className="aa-grid">
          {/* Recent Feedback Feed */}
          <div className="aa-section">
            <h4>Recent Feedback</h4>
            {feedbackMetrics.recentFeedback.length === 0 ? (
              <p className="aa-empty">No feedback yet in this period</p>
            ) : (
              <div className="aa-event-feed">
                {feedbackMetrics.recentFeedback.map((fb, i) => {
                  const isPositive = fb.feedback === "positive";
                  const ts = fb.timestamp ? new Date(fb.timestamp).toLocaleString() : "—";
                  return (
                    <div key={i} className="aa-event-row">
                      <span
                        className="aa-event-dot"
                        style={{ backgroundColor: isPositive ? "#10b981" : "#ef4444" }}
                      />
                      <span className="aa-event-type" style={{ minWidth: 24, textAlign: "center" }}>
                        {isPositive ? "👍" : "👎"}
                      </span>
                      <span className="aa-event-detail" style={{ flex: 1 }}>
                        {fb.stepTitle}
                        {fb.reason && <em style={{ opacity: 0.7 }}> — {fb.reason}</em>}
                      </span>
                      <span className="aa-event-time">{ts}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Downvoted Steps */}
          <div className="aa-section">
            <h4>🚩 Most Downvoted Steps</h4>
            {feedbackMetrics.topDownvoted.length === 0 ? (
              <p className="aa-empty">No negative feedback yet</p>
            ) : (
              <ol className="aa-query-list">
                {feedbackMetrics.topDownvoted.map((item, i) => (
                  <li key={i} className="aa-query-item">
                    <span className="aa-query-text">{item.title}</span>
                    <span className="aa-query-count" style={{ color: "#ef4444" }}>
                      {item.count}×
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Recent Events Feed */}
      <div className="aa-section">
        <h3>
          🔔 Recent Events <Tip text="Latest analytics events" />
        </h3>
        <div className="aa-event-feed">
          {recentEvents.map((evt) => {
            const meta = EVENT_META[evt.event] || { label: evt.event, color: "#64748b" };
            const ts = evt.client_timestamp ? new Date(evt.client_timestamp).toLocaleString() : "—";
            return (
              <div key={evt.id} className="aa-event-row">
                <span className="aa-event-dot" style={{ backgroundColor: meta.color }} />
                <span className="aa-event-type">{meta.label}</span>
                <span className="aa-event-detail">
                  {evt.query_preview || evt.persona_name || evt.module_id || evt.preset_key || ""}
                </span>
                <span className="aa-event-time">{ts}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, tooltip }) {
  return (
    <div className="aa-stat-card" style={{ borderColor: `${color}44` }}>
      <span className="aa-stat-icon">{icon}</span>
      <div className="aa-stat-info">
        <span className="aa-stat-value" style={{ color }}>
          {value}
        </span>
        <span className="aa-stat-label">
          {label}
          {tooltip && <Tip text={tooltip} />}
        </span>
      </div>
    </div>
  );
}
