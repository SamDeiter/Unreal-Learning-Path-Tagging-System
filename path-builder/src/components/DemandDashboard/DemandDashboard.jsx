/**
 * DemandDashboard.jsx — Demand Intelligence Dashboard
 *
 * Full-featured dashboard showing:
 *   1. Top course opportunities (ranked by gap × source count)
 *   2. Live community questions with source attribution
 *   3. Granular coverage vs demand (expandable categories)
 *   4. Data provenance footer
 *
 * Every data point links back to its source.
 */

import { useState, useEffect } from "react";
import { useDemandIntelligence } from "../../hooks/useDemandIntelligence";
import { SOURCE_TYPES } from "../../services/demandIntelligenceService";
import "./DemandDashboard.css";

// ── Source chip rendering ──────────────────────────────────

const SOURCE_ICONS = {
  [SOURCE_TYPES.REDDIT]: "🟠",
  [SOURCE_TYPES.EPIC_FORUM]: "🔵",
  [SOURCE_TYPES.STACKOVERFLOW]: "🟡",
  [SOURCE_TYPES.COMMUNITY_INDEX]: "📊",
  [SOURCE_TYPES.YOUTUBE_COMMENTS]: "▶️",
  [SOURCE_TYPES.EPIC_DEV_COMMUNITY]: "🟣",
};

const SOURCE_LABELS = {
  [SOURCE_TYPES.REDDIT]: "Reddit",
  [SOURCE_TYPES.EPIC_FORUM]: "Epic Forum",
  [SOURCE_TYPES.STACKOVERFLOW]: "Stack Overflow",
  [SOURCE_TYPES.COMMUNITY_INDEX]: "Community Index",
  [SOURCE_TYPES.YOUTUBE_COMMENTS]: "YouTube",
  [SOURCE_TYPES.EPIC_DEV_COMMUNITY]: "Dev Community",
};

function SourceChip({ source }) {
  const icon = SOURCE_ICONS[source.type] || "📌";
  const label = SOURCE_LABELS[source.type] || source.type;
  const hasUrl = source.url && source.url.startsWith("http");

  if (hasUrl) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="source-chip clickable"
        title={source.title || label}
      >
        <span className="source-icon">{icon}</span>
        <span className="source-label">{label}</span>
        {source.engagement && (
          <span className="source-engagement">{source.engagement}</span>
        )}
      </a>
    );
  }

  return (
    <span className="source-chip" title={source.title || label}>
      <span className="source-icon">{icon}</span>
      <span className="source-label">{label}</span>
      {source.interestScore && (
        <span className="source-engagement">{source.interestScore}</span>
      )}
      {source.trend === "rising" && <span className="trend-arrow">⬆</span>}
    </span>
  );
}

// ── Confidence Badge ───────────────────────────────────────

function ConfidenceBadge({ confidence }) {
  const colors = { high: "#22c55e", medium: "#f59e0b", low: "#94a3b8" };
  const labels = { high: "HIGH", medium: "MED", low: "LOW" };
  const tips = {
    high: "High confidence — strong demand signal from multiple sources",
    medium: "Medium confidence — moderate demand, fewer confirming sources",
    low: "Low confidence — early signal, needs more data to confirm",
  };
  return (
    <span
      className="confidence-badge"
      style={{ "--badge-color": colors[confidence] || colors.low }}
      title={tips[confidence] || "Confidence level of this opportunity"}
    >
      {labels[confidence] || "?"}
    </span>
  );
}

// ── Suggestion Card ────────────────────────────────────────

function SuggestionCard({ suggestion, rank, onStartBrief }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`suggestion-card confidence-${suggestion.confidence}`}>
      <div className="suggestion-header" onClick={() => setExpanded(!expanded)}>
        <span className="suggestion-rank" title={`Ranked #${rank} by opportunity score (gap × demand)`}>#{rank}</span>
        <div className="suggestion-info">
          <h4 className="suggestion-topic">{suggestion.topic}</h4>
          <span className="suggestion-category" title="UE5 content category">{suggestion.category}</span>
        </div>
        <div className="suggestion-metrics">
          <div className="metric" title={`Gap: ${suggestion.gap}% — the difference between community demand and your library's coverage. Higher gap = bigger opportunity.`}>
            <span className="metric-value gap-value">−{suggestion.gap}%</span>
            <span className="metric-label">Gap</span>
          </div>
          <div className="metric" title={`Demand: ${suggestion.demandScore}/100 — curated community activity score based on Reddit, Epic Forums, StackOverflow, and YouTube tutorial engagement.`}>
            <span className="metric-value">{suggestion.demandScore}</span>
            <span className="metric-label">Demand</span>
          </div>
          <div className="metric" title={`Coverage: ${suggestion.coverageInLibrary}% — how well your existing video library covers this topic. 0% = no content yet.`}>
            <span className="metric-value">{suggestion.coverageInLibrary}%</span>
            <span className="metric-label">Coverage</span>
          </div>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
        <span className="expand-arrow" title={expanded ? "Collapse details" : "Expand to see sources and details"}>{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded && (
        <div className="suggestion-details">
          <div className="sources-section">
            <h5>📌 Sources ({suggestion.sources.length})</h5>
            <div className="sources-list">
              {suggestion.sources.map((src, i) => (
                <div key={i} className="source-row">
                  <SourceChip source={src} />
                  {src.title && (
                    <span className="source-title">{src.title}</span>
                  )}
                  {src.date && (
                    <span className="source-date">{src.date}</span>
                  )}
                  {src.relatedQuestion && (
                    <span className="source-question">
                      &ldquo;{src.relatedQuestion}&rdquo;
                    </span>
                  )}
                  {src.painPoint && (
                    <span className="source-pain-point">
                      ⚠️ {src.painPoint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {suggestion.courseCount > 0 && (
            <div className="existing-coverage">
              <h5>📚 Existing Coverage: {suggestion.courseCount} courses</h5>
            </div>
          )}
          <button
            className="start-brief-btn"
            onClick={(e) => {
              e.stopPropagation();
              onStartBrief?.(suggestion);
            }}
          >
            Start Brief →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Trending Question Row ──────────────────────────────────

function TrendingQuestion({ question }) {
  const frequencyClass = question.frequency || "medium";

  return (
    <div className={`trending-question frequency-${frequencyClass}`}>
      <div className="question-text">&ldquo;{question.question}&rdquo;</div>
      <div className="question-meta">
        <span className="question-category">{question.category}</span>
        {question.subtopic && (
          <span className="question-subtopic">{question.subtopic}</span>
        )}
        <div className="question-sources">
          {(question.sources || []).map((src, i) => (
            <SourceChip key={i} source={src} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Granular Coverage Chart ────────────────────────────────

function GranularCoverageChart({ demandData, coverageData }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  if (!demandData || !coverageData) return null;

  const categories = Object.keys(demandData);

  return (
    <div className="granular-coverage">
      <h3 title="Compares your library's topic coverage (green bar) against community demand (blue marker). Click any category to see subtopic breakdown.">📈 Coverage vs Demand <span className="chart-subtitle">(click to expand)</span></h3>
      {categories.map((cat) => {
        const catData = demandData[cat];
        const isExpanded = expandedCategory === cat;
        const subtopics = Object.entries(catData.subtopics || {});

        // Compute average coverage for this category
        const catCoverage = coverageData[cat] || {};
        const avgCoverage = subtopics.length > 0
          ? Math.round(
              subtopics.reduce((sum, [sub]) =>
                sum + (catCoverage[sub]?.coverage || 0), 0
              ) / subtopics.length
            )
          : 0;

        return (
          <div key={cat} className="coverage-category">
            <div
              className="category-header"
              onClick={() => setExpandedCategory(isExpanded ? null : cat)}
            >
              <span className="category-toggle">{isExpanded ? "▾" : "▸"}</span>
              <span className="category-name">{cat}</span>
              <div className="category-bars">
                <div className="bar-track">
                  <div
                    className="bar-fill coverage"
                    style={{ width: `${avgCoverage}%` }}
                  />
                  <div
                    className="bar-marker demand"
                    style={{ left: `${catData.overall}%` }}
                  />
                </div>
              </div>
              <span className="category-stats">
                {avgCoverage}% / {catData.overall}%
              </span>
            </div>

            {isExpanded && (
              <div className="subtopic-list">
                {subtopics
                  .sort(([, a], [, b]) => b - a)
                  .map(([subtopic, demand]) => {
                    const cov = catCoverage[subtopic]?.coverage || 0;
                    const gap = demand - cov;
                    const statusClass =
                      gap > 20 ? "behind" : gap > 0 ? "close" : "ahead";

                    return (
                      <div key={subtopic} className={`subtopic-row ${statusClass}`}>
                        <span className="subtopic-name">{subtopic}</span>
                        <div className="subtopic-bars">
                          <div className="bar-track">
                            <div
                              className="bar-fill coverage"
                              style={{ width: `${cov}%` }}
                            />
                            <div
                              className="bar-marker demand"
                              style={{ left: `${demand}%` }}
                            />
                          </div>
                        </div>
                        <span className={`subtopic-gap ${statusClass}`}>
                          {gap > 0 ? `−${gap}%` : `+${Math.abs(gap)}%`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Provenance Footer ──────────────────────────────────────

function ProvenanceFooter({ provenance, generatedAt }) {
  if (!provenance) return null;

  return (
    <div className="provenance-footer">
      <h4>🔍 Data Provenance</h4>
      <div className="provenance-items">
        <span className="provenance-item">
          📊 Community Activity Index: {provenance.communityIndex?.subtopicCount || 0} subtopics
          · {provenance.communityIndex?.version || "?"}
        </span>
        <span className="provenance-item">
          💬 Community Scan: {provenance.communitySearch?.totalPainPoints || 0} pain
          points across {provenance.communitySearch?.categoriesScanned || 0} categories
          · {provenance.communitySearch?.method || "?"}
        </span>
        <span className="provenance-item">
          🔥 Trending: {provenance.trendingQuestions?.count || 0} questions
          · {provenance.trendingQuestions?.method || "?"}
        </span>
        <span className="provenance-item">
          📚 Library: {provenance.libraryCoverage?.totalCourses || 0} videos
          · {provenance.libraryCoverage?.categoriesAnalyzed || 0} categories
        </span>
        {generatedAt && (
          <span className="provenance-item provenance-time">
            🕐 Generated:{" "}
            {new Date(generatedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────

function DemandDashboard() {
  const {
    report,
    loading,
    error,
    stats,
    filteredSuggestions,
    availableCategories,
    categoryFilter,
    generate,
    refresh,
    setCategoryFilter,
  } = useDemandIntelligence();

  // Auto-generate on mount if no report
  useEffect(() => {
    if (!report && !loading) {
      generate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartBrief = (suggestion) => {
    // Navigate to Adaptive Path with the topic pre-filled
    const query = `${suggestion.topic} in ${suggestion.category}`;
    window.location.hash = `adaptive`;
    // Dispatch a custom event so the Adaptive Path picks up the query
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("demand-start-brief", { detail: { query, suggestion } })
      );
    }, 300);
  };

  return (
    <div className="demand-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h2 title="Demand Intelligence scans community forums, StackOverflow, Reddit, and your video library to identify the best topics to create content about.">📊 Demand Intelligence</h2>
        <div className="header-actions">
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Clear cached data and re-scan all sources for fresh demand signals (takes 30–60 seconds)"
          >
            {loading ? "⏳ Scanning..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="dashboard-error">
          <p>⚠️ {error}</p>
          <button onClick={refresh}>Try Again</button>
        </div>
      )}

      {/* Loading state */}
      {loading && !report && (
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Scanning community sites and your library...</p>
          <p className="loading-subtitle">This may take 30–60 seconds</p>
        </div>
      )}

      {/* Main content */}
      {report && (
        <>
          {/* Summary Stats Bar */}
          <div className="stats-bar">
            <div className="stat" title="Total number of content opportunities identified by cross-referencing demand signals against your library's existing coverage.">
              <span className="stat-value">{stats?.totalSuggestions || 0}</span>
              <span className="stat-label">Opportunities</span>
            </div>
            <div className="stat" title="Questions actively being asked in UE5 communities — sourced from Reddit, Epic Forums, Stack Overflow, and YouTube comments.">
              <span className="stat-value">{stats?.trendingQuestions || 0}</span>
              <span className="stat-label">Trending Questions</span>
            </div>
            <div className="stat" title="Specific frustrations and struggles identified from community posts — topics where learners are getting stuck.">
              <span className="stat-value">{stats?.painPointCount || 0}</span>
              <span className="stat-label">Pain Points</span>
            </div>
            <div className="stat" title="Number of UE5 topic categories scanned (e.g. Blueprints, AI, Animation, Niagara, etc.)">
              <span className="stat-value">{stats?.categoriesScanned || 0}</span>
              <span className="stat-label">Categories</span>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="dashboard-columns">
            {/* Left: Suggestions */}
            <div className="column-suggestions">
              <div className="column-header">
                <h3 title="Topics ranked by opportunity score: high community demand × low coverage in your library = biggest opportunity">🎯 Top Course Opportunities</h3>
                <div className="category-filters">
                  <button
                    className={`filter-chip ${!categoryFilter ? "active" : ""}`}
                    onClick={() => setCategoryFilter(null)}
                  >
                    All
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      className={`filter-chip ${categoryFilter === cat ? "active" : ""}`}
                      onClick={() =>
                        setCategoryFilter(categoryFilter === cat ? null : cat)
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="suggestions-list">
                {filteredSuggestions.slice(0, 15).map((suggestion, i) => (
                  <SuggestionCard
                    key={`${suggestion.category}-${suggestion.topic}`}
                    suggestion={suggestion}
                    rank={i + 1}
                    onStartBrief={handleStartBrief}
                  />
                ))}
                {filteredSuggestions.length === 0 && (
                  <div className="empty-state">
                    No suggestions found for this category.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Trending Questions */}
            <div className="column-trending">
              <div className="column-header">
                <h3 title="Real questions being asked right now in UE5 developer communities — sourced via AI-powered web search">💬 Live Community Questions</h3>
                <span className="source-badge" title="These questions are discovered using Google Gemini's grounded search, which scans live web content from forums and Q&A sites">Gemini Grounded Search</span>
              </div>
              <div className="trending-list">
                {(report.trendingQuestions || []).map((q, i) => (
                  <TrendingQuestion key={i} question={q} />
                ))}
                {(report.trendingQuestions || []).length === 0 && (
                  <div className="empty-state">
                    No trending questions found. Click Refresh to scan.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full-width: Granular Coverage Chart */}
          <GranularCoverageChart
            demandData={report.demandData}
            coverageData={report.coverageData}
          />

          {/* Provenance Footer */}
          <ProvenanceFooter
            provenance={report.provenance}
            generatedAt={report.generatedAt}
          />
        </>
      )}
    </div>
  );
}

export default DemandDashboard;
