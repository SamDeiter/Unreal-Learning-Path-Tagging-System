/**
 * AnalyticsPipeline — RAG Pipeline Health + Event Breakdown
 * Focused sub-page for pipeline metrics.
 */

import { useMemo } from "react";
import {
  countByEventType,
  getPersonaDistribution,
  getRAGMetrics,
} from "../../services/analyticsQueryService";
import { EVENTS } from "../../services/analyticsService";
import "./AdminAnalytics.css";

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
};

function Tip({ text }) {
  return (
    <span className="aa-tooltip-wrap">
      <span className="aa-info-icon">ⓘ</span>
      <span className="aa-tooltip-text">{text}</span>
    </span>
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

export default function AnalyticsPipeline({ events = [] }) {
  const ragMetrics = useMemo(() => getRAGMetrics(events), [events]);
  const eventCounts = useMemo(() => countByEventType(events), [events]);
  const personaDist = useMemo(() => getPersonaDistribution(events), [events]);
  const maxBarValue = Math.max(...Object.values(eventCounts), 1);

  return (
    <div className="admin-analytics">
      <div className="aa-header">
        <div>
          <h2>
            ⚙️ Pipeline Health <Tip text="RAG search pipeline metrics and event distribution" />
          </h2>
          <p className="aa-subtitle">{events.length} events in selected period</p>
        </div>
      </div>

      {/* RAG Pipeline Stats */}
      {ragMetrics.searchCount > 0 && (
        <div className="aa-section" style={{ marginBottom: 24 }}>
          <h3>
            🧠 RAG Pipeline{" "}
            <Tip text="Metrics from the vector search & content retrieval pipeline" />
          </h3>
          <div className="aa-stats-row" style={{ marginBottom: 16 }}>
            <StatCard
              label="Avg Similarity"
              value={ragMetrics.avgSimilarity.toFixed(2)}
              icon="🎯"
              color={ragMetrics.avgSimilarity >= 0.65 ? "#10b981" : "#ef4444"}
              tooltip="Average best similarity score. ≥0.65 is good"
            />
            <StatCard
              label="Hybrid Fallback"
              value={`${ragMetrics.hybridRate}%`}
              icon={ragMetrics.hybridRate > 30 ? "⚠️" : "🛡️"}
              color={ragMetrics.hybridRate > 30 ? "#f43f5e" : "#10b981"}
              tooltip={`${ragMetrics.hybridCount} of ${ragMetrics.searchCount} searches fell back to AI`}
            />
            <StatCard
              label="Avg Search"
              value={`${ragMetrics.avgSearchMs}ms`}
              icon="⚡"
              color={ragMetrics.avgSearchMs > 2000 ? "#f59e0b" : "#06b6d4"}
              tooltip="Average vector search latency"
            />
            <StatCard
              label="Corpus Ratio"
              value={`${ragMetrics.avgCorpusRatio}%`}
              icon="📚"
              color={ragMetrics.avgCorpusRatio >= 50 ? "#6366f1" : "#f97316"}
              tooltip="Percentage of path steps from real corpus content"
            />
          </div>

          {/* Collection breakdown */}
          <div className="aa-bar-chart">
            {[
              {
                label: "Transcripts",
                count: ragMetrics.collectionBreakdown.transcripts,
                color: "#8b5cf6",
              },
              {
                label: "Epic Learning",
                count: ragMetrics.collectionBreakdown.epic,
                color: "#f59e0b",
              },
              { label: "Docs", count: ragMetrics.collectionBreakdown.docs, color: "#06b6d4" },
            ].map((col) => {
              const maxCol = Math.max(
                ragMetrics.collectionBreakdown.transcripts,
                ragMetrics.collectionBreakdown.epic,
                ragMetrics.collectionBreakdown.docs,
                1
              );
              const pct = Math.round((col.count / maxCol) * 100);
              return (
                <div key={col.label} className="aa-bar-row">
                  <span className="aa-bar-label">{col.label}</span>
                  <div className="aa-bar-track">
                    <div
                      className="aa-bar-fill"
                      style={{ width: `${pct}%`, backgroundColor: col.color }}
                    />
                  </div>
                  <span className="aa-bar-value">{col.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Breakdown + Personas side by side */}
      <div className="aa-grid">
        <div className="aa-section">
          <h3>
            🎯 Event Breakdown <Tip text="Distribution of event types" />
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

        <div className="aa-section">
          <h3>
            🎭 Persona Distribution <Tip text="Detected user personas" />
          </h3>
          {personaDist.length === 0 ? (
            <p className="aa-empty">No persona detections</p>
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
      </div>
    </div>
  );
}
