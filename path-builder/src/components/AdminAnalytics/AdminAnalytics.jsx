/**
 * AdminAnalytics — Admin-only usage analytics dashboard
 *
 * Visualizes analytics_events data from Firestore:
 *  - Time range selector (24h / 7d / 30d)
 *  - Stat cards (total events, queries, sessions, completion rate)
 *  - Event type breakdown bar chart (CSS-based)
 *  - Top queries list with persona badges
 *  - Persona distribution
 *  - Daily volume sparkline
 *  - Live event feed
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchEvents,
  countByEventType,
  getTopQueries,
  getPersonaDistribution,
  getSessionMetrics,
  getRecentEvents,
  getEventsByDay,
} from "../../services/analyticsQueryService";
import { EVENTS } from "../../services/analyticsService";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import "./AdminAnalytics.css";

const TIME_RANGES = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

// Friendly labels and colors for event types
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
};

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState("7d");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents(timeRange);
      setEvents(data);
    } catch (err) {
      console.error("[AdminAnalytics] Failed to load:", err);
      setError(err.message || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const eventCounts = countByEventType(events);
  const topQueries = getTopQueries(events);
  const personaDist = getPersonaDistribution(events);
  const sessionMetrics = getSessionMetrics(events);
  const dailyVolume = getEventsByDay(events);
  const recentEvents = getRecentEvents(events, 15);

  const totalQueries = eventCounts[EVENTS.QUERY_SUBMITTED] || 0;
  const maxBarValue = Math.max(...Object.values(eventCounts), 1);

  return (
    <div className="admin-analytics">
      {/* Header */}
      <div className="aa-header">
        <div>
          <h2 title="Admin dashboard showing real-time usage data from Firestore analytics_events">
            📈 Usage Analytics
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

      {/* Stat Cards */}
      <div className="aa-stats-row">
        <StatCard
          label="Total Events"
          value={events.length}
          icon="📊"
          color="#8b5cf6"
          tooltip="Total tracked interactions (queries, sessions, persona detections, path generations, etc.)"
        />
        <StatCard
          label="Queries"
          value={totalQueries}
          icon="🔍"
          color="#06b6d4"
          tooltip="Number of search queries submitted via Fix a Problem or Follow-up"
        />
        <StatCard
          label="Sessions"
          value={sessionMetrics.totalSessions}
          icon="👤"
          color="#10b981"
          tooltip="Unique user sessions started (one per page load)"
        />
        <StatCard
          label="Completion"
          value={`${sessionMetrics.completionRate}%`}
          icon="✅"
          color="#f59e0b"
          tooltip="Percentage of sessions where the user completed a learning path"
        />
      </div>

      {/* Daily Volume Chart */}
      {dailyVolume.length > 0 && (
        <div className="aa-section">
          <h3 title="Number of analytics events per day over the selected time range">
            📅 Daily Volume
          </h3>
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
        </div>
      )}

      {/* Main Grid */}
      <div className="aa-grid">
        {/* Event Type Breakdown */}
        <div className="aa-section">
          <h3 title="Distribution of event types — shows which features are used most">
            🎯 Event Breakdown
          </h3>
          <div className="aa-bar-chart">
            {Object.entries(eventCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const meta = EVENT_META[type] || { label: type, color: "#64748b" };
                const pct = Math.round((count / maxBarValue) * 100);
                return (
                  <div key={type} className="aa-bar-row">
                    <span className="aa-bar-label">{meta.label}</span>
                    <div className="aa-bar-track">
                      <div
                        className="aa-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }}
                      />
                    </div>
                    <span className="aa-bar-value">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top Queries */}
        <div className="aa-section">
          <h3 title="Most frequently searched queries, with persona badges showing who asked">
            🔍 Top Queries
          </h3>
          {topQueries.length === 0 ? (
            <p className="aa-empty">No queries in selected period</p>
          ) : (
            <ol className="aa-query-list">
              {topQueries.map((q, i) => (
                <li key={i} className="aa-query-item">
                  <span className="aa-query-text">{q.query}</span>
                  <span className="aa-query-count">{q.count}×</span>
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

      {/* Second Grid Row */}
      <div className="aa-grid">
        {/* Persona Distribution */}
        <div className="aa-section">
          <h3 title="Breakdown of detected user personas — shows which roles use the tool most">
            🎭 Persona Distribution
          </h3>
          {personaDist.length === 0 ? (
            <p className="aa-empty">No persona detections in selected period</p>
          ) : (
            <div className="aa-persona-chart">
              {personaDist.map((p) => {
                const maxP = Math.max(...personaDist.map((x) => x.count), 1);
                const pct = Math.round((p.count / maxP) * 100);
                return (
                  <div key={p.persona} className="aa-bar-row">
                    <span className="aa-bar-label">{p.persona}</span>
                    <div className="aa-bar-track">
                      <div
                        className="aa-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: "#f59e0b" }}
                      />
                    </div>
                    <span className="aa-bar-value">{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="aa-section">
          <h3 title="Live feed of the most recent analytics events in chronological order">
            🔔 Recent Events
          </h3>
          <div className="aa-event-feed">
            {recentEvents.map((evt) => {
              const meta = EVENT_META[evt.event] || { label: evt.event, color: "#64748b" };
              const ts = evt.client_timestamp
                ? new Date(evt.client_timestamp).toLocaleString()
                : "—";
              return (
                <div key={evt.id} className="aa-event-row">
                  <span className="aa-event-dot" style={{ backgroundColor: meta.color }} />
                  <span className="aa-event-type">{meta.label}</span>
                  <span className="aa-event-detail">
                    {evt.query_preview || evt.persona_name || evt.module_id || ""}
                  </span>
                  <span className="aa-event-time">{ts}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, tooltip }) {
  return (
    <div className="aa-stat-card" style={{ borderColor: `${color}44` }} title={tooltip}>
      <span className="aa-stat-icon">{icon}</span>
      <div className="aa-stat-info">
        <span className="aa-stat-value" style={{ color }}>
          {value}
        </span>
        <span className="aa-stat-label">{label}</span>
      </div>
    </div>
  );
}
