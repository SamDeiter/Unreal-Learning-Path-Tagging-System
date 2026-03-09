/**
 * ContentGaps — Content Gap Intelligence dashboard
 * Shows where official docs fall short and AI has to fill in.
 * Phase 4: adds blind spot aggregation, coverage distribution, and gap fill tracking.
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
    const gapFills = events.filter((e) => e.event === EVENTS.GAP_FILL_ACTION);

    if (reports.length === 0) {
      return {
        avgAiRatio: 0,
        totalReports: 0,
        topGapQueries: [],
        knowledgeGapFrequency: [],
        gapTrend: [],
        blindSpotFrequency: [],
        coverageDistribution: [],
        avgCoverage: 0,
        totalGapFills: gapFills.length,
        topFilledTopics: [],
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

    // ── Phase 4: Blind Spot Aggregation ──────────────────────────
    const blindSpotCounts = {};
    for (const r of reports) {
      for (const bs of r.blind_spots || []) {
        const topic = bs.topic || "unknown";
        if (!blindSpotCounts[topic]) {
          blindSpotCounts[topic] = { topic, count: 0, highCount: 0 };
        }
        blindSpotCounts[topic].count++;
        if (bs.severity === "high") blindSpotCounts[topic].highCount++;
      }
    }
    const blindSpotFrequency = Object.values(blindSpotCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ── Phase 4: Coverage Score Distribution ─────────────────────
    // Bucket into 10% ranges: 0-10, 10-20, ..., 90-100
    const buckets = Array(10).fill(0);
    let coverageSum = 0;
    let coverageCount = 0;
    for (const r of reports) {
      const score = r.coverage_score;
      if (score != null && !isNaN(score)) {
        const idx = Math.min(Math.floor(score * 10), 9);
        buckets[idx]++;
        coverageSum += score;
        coverageCount++;
      }
    }
    const coverageDistribution = buckets.map((count, i) => ({
      range: `${i * 10}–${(i + 1) * 10}%`,
      count,
    }));
    const avgCoverage = coverageCount > 0 ? coverageSum / coverageCount : 0;

    // ── Phase 4: Gap Fill Tracking ──────────────────────────────
    const fillCounts = {};
    for (const f of gapFills) {
      const t = f.topic || "unknown";
      fillCounts[t] = (fillCounts[t] || 0) + 1;
    }
    const topFilledTopics = Object.entries(fillCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      avgAiRatio: Number(avgAiRatio.toFixed(2)),
      totalReports: reports.length,
      topGapQueries,
      knowledgeGapFrequency,
      gapTrend,
      blindSpotFrequency,
      coverageDistribution,
      avgCoverage: Number(avgCoverage.toFixed(2)),
      totalGapFills: gapFills.length,
      topFilledTopics,
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
              label="Avg Coverage"
              value={`${Math.round(gapMetrics.avgCoverage * 100)}%`}
              icon={gapMetrics.avgCoverage >= 0.7 ? "🛡️" : "⚠️"}
              color={gapMetrics.avgCoverage >= 0.7 ? "#10b981" : "#f59e0b"}
              tooltip="Average coverage score from gap analysis — higher means fewer blind spots"
            />
            <StatCard
              label="Paths Analyzed"
              value={gapMetrics.totalReports}
              icon="📊"
              color="#6366f1"
              tooltip="Total number of path generations tracked"
            />
            <StatCard
              label="Gap Fills"
              value={gapMetrics.totalGapFills}
              icon="🔧"
              color="#06b6d4"
              tooltip="Total times users filled a gap with an additional step"
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
              color="#8b5cf6"
              tooltip="Unique concepts identified as learner knowledge gaps from diagnostics"
            />
          </div>

          {/* ── Phase 4: Most Common Blind Spots ─────────────────── */}
          {gapMetrics.blindSpotFrequency.length > 0 && (
            <div className="aa-section" style={{ marginBottom: 24 }}>
              <h3>
                🔍 Most Common Blind Spots{" "}
                <Tip text="Topics where gap analysis most frequently identifies missing content across all generated paths" />
              </h3>
              <div className="aa-bar-chart">
                {gapMetrics.blindSpotFrequency.map((bs) => {
                  const maxBs = gapMetrics.blindSpotFrequency[0]?.count || 1;
                  const pct = Math.round((bs.count / maxBs) * 100);
                  return (
                    <div key={bs.topic} className="aa-bar-row">
                      <span className="aa-bar-label" title={bs.topic}>
                        {bs.topic.length > 35 ? bs.topic.substring(0, 35) + "…" : bs.topic}
                      </span>
                      <div className="aa-bar-track">
                        <div
                          className="aa-bar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              bs.highCount > 0 ? "#f43f5e" : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className="aa-bar-value" style={{ width: 60 }}>
                        ×{bs.count}
                      </span>
                      {bs.highCount > 0 && (
                        <span
                          className="aa-bar-value"
                          style={{ width: 50, color: "#f43f5e", fontSize: "0.7rem" }}
                        >
                          {bs.highCount} high
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Phase 4: Coverage Score Distribution ──────────────── */}
          {gapMetrics.coverageDistribution.some((d) => d.count > 0) && (
            <div className="aa-section" style={{ marginBottom: 24 }}>
              <h3>
                📊 Coverage Score Distribution{" "}
                <Tip text="How coverage scores are distributed across all generated paths — higher is better" />
              </h3>
              <div className="aa-daily-chart" style={{ alignItems: "flex-end" }}>
                {gapMetrics.coverageDistribution.map((bucket) => {
                  const maxBucket = Math.max(
                    ...gapMetrics.coverageDistribution.map((d) => d.count),
                    1
                  );
                  const hPct = maxBucket > 0 ? Math.round((bucket.count / maxBucket) * 100) : 0;
                  return (
                    <div
                      key={bucket.range}
                      className="aa-day-bar"
                      title={`${bucket.range}: ${bucket.count} paths`}
                    >
                      <div
                        className="aa-day-fill"
                        style={{
                          height: `${hPct}%`,
                          background:
                            parseInt(bucket.range) >= 70
                              ? "linear-gradient(180deg, #10b981, #059669)"
                              : parseInt(bucket.range) >= 40
                                ? "linear-gradient(180deg, #f59e0b, #d97706)"
                                : "linear-gradient(180deg, #f43f5e, #e11d48)",
                        }}
                      />
                      <span className="aa-day-label">{bucket.range.split("–")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* ── Phase 4: Gap Fill Actions ──────────────────────── */}
          {gapMetrics.topFilledTopics.length > 0 && (
            <div className="aa-section" style={{ marginBottom: 24 }}>
              <h3>
                🔧 Most Filled Gaps{" "}
                <Tip text="Topics where users most frequently used 'Fill This Gap' to add content" />
              </h3>
              <div className="aa-bar-chart">
                {gapMetrics.topFilledTopics.map((t) => {
                  const maxF = gapMetrics.topFilledTopics[0]?.count || 1;
                  const pct = Math.round((t.count / maxF) * 100);
                  return (
                    <div key={t.topic} className="aa-bar-row">
                      <span className="aa-bar-label" title={t.topic}>
                        {t.topic.length > 35 ? t.topic.substring(0, 35) + "…" : t.topic}
                      </span>
                      <div className="aa-bar-track">
                        <div
                          className="aa-bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: "#06b6d4" }}
                        />
                      </div>
                      <span className="aa-bar-value">×{t.count}</span>
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

