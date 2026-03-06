/**
 * ContentGaps — Content Gap Intelligence dashboard
 * Shows where official docs fall short and AI has to fill in.
 */

import { useMemo } from "react";
import { EVENTS } from "../../services/analyticsService";
import "./AdminAnalytics.css";

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

export default function ContentGaps({ events = [] }) {
  const gapMetrics = useMemo(() => {
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

    const avgAiRatio = reports.reduce((sum, r) => sum + (r.ai_ratio || 0), 0) / reports.length;

    // Top queries with highest AI ratio
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

    // Knowledge gap frequency
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

    // Gap trend by day
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
  }, [events]);

  return (
    <div className="admin-analytics">
      <div className="aa-header">
        <div>
          <h2>
            🧠 Content Gap Intelligence{" "}
            <Tip text="Shows where official docs fall short and AI has to fill in the gaps" />
          </h2>
          <p className="aa-subtitle">{gapMetrics.totalReports} path generations analyzed</p>
        </div>
      </div>

      {gapMetrics.totalReports === 0 ? (
        <div className="aa-section">
          <p className="aa-empty">
            No gap data yet — generate some learning paths to start seeing where your corpus has
            gaps.
          </p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="aa-stats-row">
            <StatCard
              label="AI Fill Rate"
              value={`${Math.round(gapMetrics.avgAiRatio * 100)}%`}
              icon={gapMetrics.avgAiRatio > 0.5 ? "⚠️" : "✅"}
              color={gapMetrics.avgAiRatio > 0.5 ? "#f43f5e" : "#10b981"}
              tooltip="Average percentage of path steps that AI had to generate because the corpus didn't have content"
            />
            <StatCard
              label="Paths Analyzed"
              value={gapMetrics.totalReports}
              icon="📊"
              color="#6366f1"
              tooltip="Total number of path generations tracked"
            />
            <StatCard
              label="Gap Topics"
              value={gapMetrics.topGapQueries.filter((q) => q.avgAiRatio > 0.5).length}
              icon="🕳️"
              color="#f59e0b"
              tooltip="Number of query topics where AI fills more than 50% of content"
            />
            <StatCard
              label="Knowledge Gaps"
              value={gapMetrics.knowledgeGapFrequency.length}
              icon="📋"
              color="#06b6d4"
              tooltip="Unique concepts identified as learner knowledge gaps from diagnostics"
            />
          </div>

          {/* Top Gap Queries — where corpus is weakest */}
          <div className="aa-section" style={{ marginBottom: 24 }}>
            <h3>
              🕳️ Top Content Gaps{" "}
              <Tip text="Queries where AI had to generate the most content — these topics need official docs" />
            </h3>
            {gapMetrics.topGapQueries.length === 0 ? (
              <p className="aa-empty">No gap queries yet</p>
            ) : (
              <div className="aa-bar-chart">
                {gapMetrics.topGapQueries.map((q) => {
                  const pct = Math.round(q.avgAiRatio * 100);
                  return (
                    <div key={q.query} className="aa-bar-row">
                      <span className="aa-bar-label" style={{ width: 200 }} title={q.query}>
                        {q.query.length > 35 ? q.query.substring(0, 35) + "…" : q.query}
                      </span>
                      <div className="aa-bar-track">
                        <div
                          className="aa-bar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              pct > 50 ? "#f43f5e" : pct > 25 ? "#f59e0b" : "#10b981",
                          }}
                        />
                      </div>
                      <span className="aa-bar-value" style={{ width: 60 }}>
                        {pct}% AI
                      </span>
                      <span
                        className="aa-bar-value"
                        style={{ width: 30, color: "#64748b", fontSize: "0.75rem" }}
                      >
                        ×{q.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Knowledge Gap Frequency */}
          {gapMetrics.knowledgeGapFrequency.length > 0 && (
            <div className="aa-section" style={{ marginBottom: 24 }}>
              <h3>
                📋 Most Common Knowledge Gaps{" "}
                <Tip text="Concepts that learners struggle with most, based on diagnostic assessments" />
              </h3>
              <div className="aa-bar-chart">
                {gapMetrics.knowledgeGapFrequency.map((g) => {
                  const maxG = gapMetrics.knowledgeGapFrequency[0]?.count || 1;
                  const pct = Math.round((g.count / maxG) * 100);
                  return (
                    <div key={g.concept} className="aa-bar-row">
                      <span className="aa-bar-label">{g.concept}</span>
                      <div className="aa-bar-track">
                        <div
                          className="aa-bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: "#8b5cf6" }}
                        />
                      </div>
                      <span className="aa-bar-value">{g.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gap Trend */}
          {gapMetrics.gapTrend.length > 1 && (
            <div className="aa-section">
              <h3>
                📈 AI Fill Rate Trend{" "}
                <Tip text="How the AI fill rate changes over time — ideally goes down as you add more docs" />
              </h3>
              <div className="aa-daily-chart">
                {gapMetrics.gapTrend.map((day) => {
                  const pct = Math.round(day.avgAiRatio * 100);
                  return (
                    <div
                      key={day.date}
                      className="aa-day-bar"
                      title={`${day.date}: ${pct}% AI (${day.reports} paths)`}
                    >
                      <div
                        className="aa-day-fill"
                        style={{
                          height: `${pct}%`,
                          background:
                            pct > 50
                              ? "linear-gradient(180deg, #f43f5e, #e11d48)"
                              : "linear-gradient(180deg, #10b981, #059669)",
                        }}
                      />
                      <span className="aa-day-label">{day.date.substring(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
