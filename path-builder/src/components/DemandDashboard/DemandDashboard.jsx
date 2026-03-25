/**
 * DemandDashboard.jsx — Demand Intelligence Dashboard
 *
 * Full-featured dashboard showing:
 *   1. Top course opportunities (ranked by gap × source count)
 *   2. Live community questions with source attribution
 *   3. Granular coverage vs demand (expandable categories)
 *   4. Data provenance footer
 *   5. Google Trends + Industry Vertical intelligence
 *
 * Every data point links back to its source.
 */

import { useState, useEffect, useRef } from "react";
import { useDemandIntelligence } from "../../hooks/useDemandIntelligence";
import { SOURCE_TYPES } from "../../services/demandIntelligenceService";
import { computePlatformBreakdown, aggregatePlatformDemand, PLATFORM_META } from "../../utils/decayDetector";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../../services/firebaseConfig";
import "./DemandDashboard.css";

// ── Industry Vertical Taxonomy ─────────────────────────────
const INDUSTRY_VERTICALS = {
  Gaming: {
    categories: ["Blueprints", "AI", "Animation", "Networking", "Physics", "Gameplay Framework", "Level Design", "Audio", "Niagara", "C++"],
    subVerticals: {
      Indie: ["Blueprints", "Gameplay Framework", "Level Design", "Audio", "UI/UMG"],
      AA: ["AI", "Animation", "Networking", "Physics", "Blueprints", "C++"],
      AAA: ["AI", "Animation", "Networking", "Physics", "C++", "Optimization", "Rendering"],
      Mobile: ["Optimization", "UI/UMG", "Blueprints", "Gameplay Framework"],
      Console: ["Optimization", "Rendering", "Networking", "C++", "Physics"],
    },
  },
  "AEC/ArchViz": {
    categories: ["Lighting", "Materials", "Rendering", "Landscape", "Optimization", "Virtual Production"],
    subVerticals: {
      Architecture: ["Lighting", "Materials", "Rendering", "Landscape"],
      "Interior Design": ["Lighting", "Materials", "Rendering"],
      "Urban Planning": ["Landscape", "Rendering", "Optimization"],
    },
  },
  "Virtual Production": {
    categories: ["Virtual Production", "Lighting", "Animation", "MetaHumans", "Rendering"],
    subVerticals: {
      ICVFX: ["Virtual Production", "Lighting", "Rendering"],
      "LED Volumes": ["Virtual Production", "Lighting"],
      "MetaHuman Capture": ["MetaHumans", "Animation"],
    },
  },
  Enterprise: {
    categories: ["Optimization", "Rendering", "MetaHumans", "Networking", "UI/UMG"],
    subVerticals: {
      Automotive: ["Rendering", "Materials", "Optimization"],
      "Product Design": ["Rendering", "Materials", "Lighting"],
      "Healthcare Simulation": ["MetaHumans", "Networking", "UI/UMG"],
    },
  },
};

const INDUSTRY_COLORS = {
  Gaming: "#7c3aed",
  "AEC/ArchViz": "#0ea5e9",
  "Virtual Production": "#f97316",
  Enterprise: "#14b8a6",
};

/** Get industry verticals for a given category. */
function getIndustriesForCategory(category) {
  return Object.entries(INDUSTRY_VERTICALS)
    .filter(([, data]) => data.categories.includes(category))
    .map(([industry]) => industry);
}

/** Get sub-verticals that include a given category. */
function _getSubVerticalsForCategory(industry, category) {
  const data = INDUSTRY_VERTICALS[industry];
  if (!data?.subVerticals) return [];
  return Object.entries(data.subVerticals)
    .filter(([, cats]) => cats.includes(category))
    .map(([name]) => name);
}

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
        data-tooltip={source.title || label}
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
    <span className="source-chip" data-tooltip={source.title || label}>
      <span className="source-icon">{icon}</span>
      <span className="source-label">{label}</span>
      {source.interestScore && (
        <span className="source-engagement">{source.interestScore}</span>
      )}
      {source.trend === "rising" && <span className="trend-arrow">⬆</span>}
    </span>
  );
}

// ── Critical Gap Alerts ───────────────────────────────────

function CriticalGapAlerts({ suggestions, painPointsByCategory: _painPointsByCategory, trendingQuestions: _trendingQuestions, onStartAuthoring }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed-gap-alerts") || "[]");
    } catch { return []; }
  });

  const criticalGaps = (suggestions || [])
    .filter((s) => s.demandScore > 60 && s.coverageInLibrary === 0)
    .filter((s) => !dismissed.includes(s.topic))
    .slice(0, 3);

  if (criticalGaps.length === 0) return null;

  const dismiss = (topic) => {
    const next = [...dismissed, topic];
    setDismissed(next);
    localStorage.setItem("dismissed-gap-alerts", JSON.stringify(next));
  };

  return (
    <div className="critical-gap-alerts">
      <div className="alert-header">
        <span>🚨 Critical Coverage Gaps</span>
        <span className="alert-count">{criticalGaps.length} topics with high demand but zero coverage</span>
      </div>
      {criticalGaps.map((gap) => (
        <div key={gap.topic} className="gap-alert-card">
          <div className="gap-alert-content">
            <div className="gap-alert-title">
              <strong>{gap.topic}</strong>
              <span className="gap-alert-category">{gap.category}</span>
            </div>
            <div className="gap-alert-stats">
              <span className="gap-stat demand">📈 Demand: {gap.demandScore}%</span>
              <span className="gap-stat coverage">📚 Coverage: 0%</span>
              {gap.redditEngagement && (
                <span className="gap-stat reddit">🟠 {gap.redditEngagement.postCount} Reddit posts</span>
              )}
            </div>
          </div>
          <div className="gap-alert-actions">
            <button className="gap-action-btn primary" onClick={() => onStartAuthoring(gap)} data-tooltip="Create a new course based on this high-demand topic">✍️ Start Authoring</button>
            <button className="gap-action-btn dismiss" onClick={() => dismiss(gap.topic)} data-tooltip="Dismiss this alert">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ScrapeButton ──────────────────────────────────────────

const SCRAPE_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
const SCRAPE_COOLDOWN_KEY = "demand-scrape-cooldown-until";

function ScrapeButton({ onComplete }) {
  const [status, setStatus] = useState(() => {
    const cooldownUntil = parseInt(localStorage.getItem(SCRAPE_COOLDOWN_KEY) || "0", 10);
    return cooldownUntil > Date.now() ? "cooldown" : "idle";
  }); // idle | triggering | scraping | success | error | cooldown
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef(null);



  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
  };

  // Manage cooldown countdown interval
  useEffect(() => {
    if (status !== "cooldown") return;
    const cooldownUntil = parseInt(localStorage.getItem(SCRAPE_COOLDOWN_KEY) || "0", 10);
    // If cooldown already expired, clean up on next tick (avoids synchronous setState in effect)
    const initialRemaining = Math.max(0, cooldownUntil - Date.now());
    setCooldownRemaining(initialRemaining); // eslint-disable-line react-hooks/set-state-in-effect -- initializing derived state
    const interval = setInterval(() => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setStatus("idle");
        localStorage.removeItem(SCRAPE_COOLDOWN_KEY);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Cleanup elapsed timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTrigger = async () => {
    // Double-check cooldown
    const cooldownUntil = parseInt(localStorage.getItem(SCRAPE_COOLDOWN_KEY) || "0", 10);
    if (cooldownUntil > Date.now()) {
      setStatus("cooldown");
      return;
    }

    setStatus("triggering");
    setMessage("");
    setElapsed(0);

    try {
      const app = getFirebaseApp();
      const functions = getFunctions(app);
      const trigger = httpsCallable(functions, "triggerDemandScrape");
      const result = await trigger();

      // Start elapsed timer
      setStatus("scraping");
      setMessage(result.data.message || "Scrape triggered! Waiting for results...");
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);

      // Auto-refresh after ~90 seconds
      setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        onComplete?.();
        setStatus("success");
        setMessage("Data refreshed!");

        // Set cooldown
        const until = Date.now() + SCRAPE_COOLDOWN_MS;
        localStorage.setItem(SCRAPE_COOLDOWN_KEY, until.toString());

        setTimeout(() => {
          setStatus("cooldown");
          }, 3000);
      }, 90000);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus("error");
      setMessage(err.message || "Failed to trigger scrape");
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
    }
  };

  const getLabel = () => {
    switch (status) {
      case "idle": return "🚀 Re-scrape";
      case "triggering": return "⏳ Triggering...";
      case "scraping": return `⏳ Scraping... ${formatTime(elapsed)}`;
      case "success": return "✅ Done!";
      case "error": return "❌ Failed";
      case "cooldown": return `🔒 Next scrape in ${formatTime(cooldownRemaining)}`;
      default: return "🚀 Re-scrape";
    }
  };

  const getTooltip = () => {
    switch (status) {
      case "cooldown":
        return `Scrape cooldown active — please wait ${formatTime(cooldownRemaining)} before triggering another scrape`;
      case "scraping":
        return `Scrape in progress (${formatTime(elapsed)} elapsed). Data will auto-refresh when complete.`;
      case "success":
        return message;
      default:
        return "Trigger a fresh scrape via GitHub Action (~20 min). Data will auto-refresh.";
    }
  };

  return (
    <button
      className={`refresh-btn scrape-btn scrape-${status}`}
      onClick={handleTrigger}
      disabled={status !== "idle"}
      data-tooltip={getTooltip()}
    >
      {getLabel()}
    </button>
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
      data-tooltip={tips[confidence] || "Confidence level of this opportunity"}
    >
      {labels[confidence] || "?"}
    </span>
  );
}

// ── Suggestion Card ────────────────────────────────────────

function SuggestionCard({ suggestion, rank, onStartBrief }) {
  const [expanded, setExpanded] = useState(false);
  const breakdown = computePlatformBreakdown(suggestion);

  // Build platform source badges — only show platforms with score > 0
  const activePlatforms = Object.entries(breakdown)
    .filter(([key, val]) => PLATFORM_META[key] && typeof val === "number" && val > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className={`suggestion-card confidence-${suggestion.confidence}`}>
      <div className="suggestion-header" onClick={() => setExpanded(!expanded)}>
        <span className="suggestion-rank" data-tooltip={`Ranked #${rank} by opportunity score (gap × demand)`}>#{rank}</span>
        <div className="suggestion-info">
          <h4 className="suggestion-topic">{suggestion.topic}</h4>
          <div className="suggestion-meta-row">
            <span className="suggestion-category" data-tooltip="UE5 content category">{suggestion.category}</span>
            <span className="platform-source-badges">
              {activePlatforms.slice(0, 4).map(([key]) => (
                <span
                  key={key}
                  className="platform-dot"
                  style={{ background: PLATFORM_META[key].color }}
                  data-tooltip={`${PLATFORM_META[key].label}: ${breakdown[key]}/100`}
                >
                  {PLATFORM_META[key].icon}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="suggestion-metrics">
          <div className="metric" data-tooltip={`Gap: ${suggestion.gap}% — the difference between community demand and your library's coverage. Higher gap = bigger opportunity.`}>
            <span className="metric-value gap-value">−{suggestion.gap}%</span>
            <span className="metric-label">Gap</span>
          </div>
          <div className="metric" data-tooltip={`Demand Index: ${suggestion.demandIndex ?? suggestion.demandScore}/100 — weighted composite of community activity, Reddit engagement, source verification, coverage gap${suggestion.youtubeMetrics ? ', and YouTube viewership' : ''}.`}>
            <span className="metric-value">{suggestion.demandIndex ?? suggestion.demandScore}</span>
            <span className="metric-label">Index</span>
          </div>
          <div className="metric" data-tooltip={`Coverage: ${suggestion.coverageInLibrary}% — how well your existing video library covers this topic. 0% = no content yet.`}>
            <span className="metric-value">{suggestion.coverageInLibrary}%</span>
            <span className="metric-label">Coverage</span>
          </div>
          <ConfidenceBadge confidence={suggestion.confidence} />
          {suggestion.decayRisk && suggestion.decayRisk !== "none" && (
            <span
              className={`decay-badge decay-${suggestion.decayRisk}`}
              data-tooltip={suggestion.decayReason || `Content decay risk: ${suggestion.decayRisk}`}
            >
              {suggestion.decayRisk === "high" ? "🔴 Outdated" : "⚠️ Aging"}
            </span>
          )}
          {suggestion.youtubeMetrics && suggestion.youtubeMetrics.avgViews > 50000 && (
            <span
              className="decay-badge" style={{ background: '#2563eb', color: '#fff' }}
              data-tooltip={`High YouTube interest: ${suggestion.youtubeMetrics.avgViews.toLocaleString()} avg views across ${suggestion.youtubeMetrics.videoCount} tutorials`}
            >
              🚀 Breakout
            </span>
          )}
          {suggestion.trendsMetrics && (
            <span
              className={`decay-badge trends-badge trends-${suggestion.trendsMetrics.scaledScore >= 70 ? 'hot' : suggestion.trendsMetrics.scaledScore >= 40 ? 'warm' : 'cool'}`}
              data-tooltip={`Google Trends: ${suggestion.trendsMetrics.scaledScore}/100 search interest (raw: ${suggestion.trendsMetrics.rawInterest}). ${suggestion.trendsMetrics.scaledScore >= 70 ? 'Hot topic — high search demand!' : suggestion.trendsMetrics.scaledScore >= 40 ? 'Warm topic — moderate search interest' : 'Cool topic — niche search interest'}`}
            >
              {suggestion.trendsMetrics.scaledScore >= 70 ? '🔥' : suggestion.trendsMetrics.scaledScore >= 40 ? '📈' : '📊'} Trends {suggestion.trendsMetrics.scaledScore}
            </span>
          )}
        </div>
        <span className="expand-arrow" data-tooltip={expanded ? "Collapse details" : "Expand to see sources and details"}>{expanded ? "▾" : "▸"}</span>
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
                    src.url ? (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-title source-link">{src.title}</a>
                    ) : (
                      <span className="source-title">{src.title}</span>
                    )
                  )}
                  {src.date && (
                    <span className="source-date">{src.date}</span>
                  )}
                  {src.relatedQuestion && (
                    src.url ? (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-question source-link">
                        &ldquo;{src.relatedQuestion}&rdquo;
                      </a>
                    ) : (
                      <span className="source-question">
                        &ldquo;{src.relatedQuestion}&rdquo;
                      </span>
                    )
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
          {suggestion.youtubeMetrics && (
            <div className="existing-coverage">
              <h5>🎬 YouTube Signal</h5>
              <div className="sources-list">
                <div className="source-row">
                  <span>📊 {suggestion.youtubeMetrics.avgViews.toLocaleString()} avg views</span>
                </div>
                <div className="source-row">
                  <span>💬 {(suggestion.youtubeMetrics.avgEngagement * 100).toFixed(1)}% engagement</span>
                </div>
                <div className="source-row">
                  <span>🎥 {suggestion.youtubeMetrics.videoCount} tutorials found</span>
                </div>
                {suggestion.youtubeMetrics.topVideoTitle && (
                  <div className="source-row">
                    <span>🏆 Top: <a
                      href={suggestion.youtubeMetrics.topVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link"
                    >
                      {suggestion.youtubeMetrics.topVideoTitle}
                    </a> ({suggestion.youtubeMetrics.topVideoViews.toLocaleString()} views)</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {suggestion.trendsMetrics && (
            <div className="existing-coverage">
              <h5>📈 Google Trends Signal</h5>
              <div className="sources-list">
                <div className="source-row">
                  <span>🔍 Search Interest: {suggestion.trendsMetrics.scaledScore}/100</span>
                </div>
                <div className="source-row">
                  <span>📊 Raw Interest: {suggestion.trendsMetrics.rawInterest}</span>
                </div>
                <div className="source-row">
                  <span>{suggestion.trendsMetrics.scaledScore >= 70 ? '🔥 Hot topic — high search demand' : suggestion.trendsMetrics.scaledScore >= 40 ? '📈 Warm — moderate search interest' : '📊 Niche — low search volume'}</span>
                </div>
              </div>
            </div>
          )}
          {getIndustriesForCategory(suggestion.category).length > 0 && (
            <div className="existing-coverage">
              <h5>🏭 Relevant Industries</h5>
              <div className="industry-badges-row">
                {getIndustriesForCategory(suggestion.category).map((ind) => (
                  <span
                    key={ind}
                    className="industry-badge"
                    style={{ '--industry-color': INDUSTRY_COLORS[ind] || '#6b7280' }}
                    data-tooltip={`This topic is relevant to the ${ind} industry vertical`}
                  >
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            className="start-authoring-btn"
            onClick={(e) => {
              e.stopPropagation();
              onStartBrief?.(suggestion);
            }}
          >
            Start Authoring →
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
      <h3 data-tooltip="Compares your library's topic coverage (green bar) against community demand (blue marker). Click any category to see subtopic breakdown.">📈 Coverage vs Demand <span className="chart-subtitle">(click to expand)</span></h3>
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
                <div className="bar-track" data-tooltip={`Coverage: ${avgCoverage}% vs Demand: ${catData.overall}%`}>
                  <div
                    className="bar-fill coverage"
                    style={{ width: `${avgCoverage}%` }}
                    data-tooltip={`Our library covers approximately ${avgCoverage}% of the subtopics in this category`}
                  />
                  <div
                    className="bar-marker demand"
                    style={{ left: `${catData.overall}%` }}
                    data-tooltip={`Community demand for ${cat} is at ${catData.overall}/100`}
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
                          <div className="bar-track" data-tooltip={`Subtopic Coverage: ${cov}% | Subtopic Demand: ${demand}%`}>
                            <div
                              className="bar-fill coverage"
                              style={{ width: `${cov}%` }}
                              data-tooltip={`Existing video coverage for "${subtopic}"`}
                            />
                            <div
                              className="bar-marker demand"
                              style={{ left: `${demand}%` }}
                              data-tooltip={`Community interest level for "${subtopic}"`}
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

// ── Platform Demand Breakdown Panel ────────────────────────

function PlatformBreakdownPanel({ suggestions, report, onPlatformFilter, activePlatformFilter }) {
  const platformData = aggregatePlatformDemand(suggestions, report);
  if (!platformData || Object.keys(platformData).length === 0) return null;

  // Find max total for bar scaling
  const maxTotal = Math.max(1, ...Object.values(platformData).map((p) => p.totalScore));

  return (
    <div className="platform-breakdown-panel">
      <h3 data-tooltip="See which platforms are driving demand for UE5 tutorials">🌐 Platform Demand Breakdown</h3>
      <div className="platform-bars">
        {Object.entries(platformData)
          .filter(([key, data]) => data && data.totalScore > 0 && key !== "communityIndex" && key !== "dominant")
          .sort(([, a], [, b]) => b.totalScore - a.totalScore)
          .map(([key, data]) => {
            const barWidth = Math.max(2, (data.totalScore / maxTotal) * 100);
            const isActive = activePlatformFilter === key;
            return (
              <div
                key={key}
                className={`platform-row ${isActive ? "active" : ""}`}
                onClick={() => onPlatformFilter(isActive ? null : key)}
                data-tooltip={`Click to filter suggestions by ${data.label} demand`}
              >
                <div className="platform-label">
                  <span className="platform-icon">{data.icon}</span>
                  <span className="platform-name">{data.label}</span>
                  <span className="platform-count">{data.topicCount} topics</span>
                </div>
                <div className="platform-bar-track">
                  <div
                    className="platform-bar-fill"
                    style={{ width: `${barWidth}%`, background: data.color }}
                  />
                </div>
                <span className="platform-score">{data.avgScore}</span>
              </div>
            );
          })}
      </div>
      <div className="platform-unique-topics">
        {Object.entries(platformData)
          .filter(([key, data]) => data && data.totalScore > 0 && key !== "communityIndex" && key !== "dominant" && data.uniqueTopics && data.uniqueTopics.length > 0)
          .sort(([, a], [, b]) => b.totalScore - a.totalScore)
          .map(([key, data]) => (
            <div key={key} className="platform-topic-group">
              <span className="platform-topic-header" style={{ color: data.color }}>
                {data.icon} {data.label} wants:
              </span>
              <span className="platform-topic-list">
                {data.uniqueTopics.map((t, i) => (
                  <span key={i} className="platform-topic-chip">{t.topic}</span>
                ))}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Provenance Footer ──────────────────────────────────────

function ProvenanceFooter({ provenance, generatedAt, stats, suggestions }) {
  if (!provenance) return null;

  // Count decay risks from suggestions
  const decayHigh = (suggestions || []).filter((s) => s.decayRisk === "high").length;
  const decayMedium = (suggestions || []).filter((s) => s.decayRisk === "medium").length;
  const decayTotal = decayHigh + decayMedium;

  // Count suggestions with Reddit engagement
  const withReddit = (suggestions || []).filter(
    (s) => s.redditEngagement && (s.redditEngagement.postCount > 0 || s.redditEngagement.avgUpvotes > 0)
  ).length;

  return (
    <div className="provenance-footer">
      <h4>🔍 Data Provenance</h4>
      <div className="provenance-items">
        <span className="provenance-item">
          📊 Community Activity Index: {provenance.communityIndex?.subtopicCount || 0} subtopics
          · {provenance.communityIndex?.version || "?"}
        </span>
        <span className="provenance-item">
          💬 Community Scan: {stats?.painPointCount || provenance.communitySearch?.totalPainPoints || 0} pain
          points across {stats?.categoriesScanned || provenance.communitySearch?.categoriesScanned || 0} categories
          · {provenance.communitySearch?.method || "?"}
        </span>
        <span className="provenance-item">
          🔥 Trending: {stats?.trendingQuestions || provenance.trendingQuestions?.count || 0} questions
          · {provenance.trendingQuestions?.method || "?"}
        </span>
        <span className="provenance-item">
          📈 Demand Index: weighted composite (30% community · 30% Reddit · 15% sources · 25% gap)
        </span>
        <span className="provenance-item">
          ⏳ Decay Detection: {decayTotal > 0
            ? `${decayHigh} high · ${decayMedium} medium risk (UE5 5.0–5.7)`
            : "active · monitoring UE5 5.0–5.7 breaking changes"}
        </span>
        {withReddit > 0 && (
          <span className="provenance-item">
            🗣️ Reddit: {withReddit}/{(suggestions || []).length} topics with engagement data
          </span>
        )}
        {(suggestions || []).some(s => s.trendsMetrics) && (
          <span className="provenance-item">
            📈 Google Trends: {(suggestions || []).filter(s => s.trendsMetrics).length}/{(suggestions || []).length} topics with search interest data · pytrends weekly scrape
          </span>
        )}
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
              timeZone: "America/New_York",
              timeZoneName: "short",
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

  const [platformFilter, setPlatformFilter] = useState(null);
  const [industryFilter, setIndustryFilter] = useState(null);
  const [subVerticalFilter, setSubVerticalFilter] = useState(null);

  // Apply industry filter first, then sub-vertical, then platform filter
  const industryFiltered = industryFilter
    ? filteredSuggestions.filter((s) => {
        if (subVerticalFilter) {
          const subCats = INDUSTRY_VERTICALS[industryFilter]?.subVerticals?.[subVerticalFilter] || [];
          return subCats.includes(s.category);
        }
        const industriesCats = INDUSTRY_VERTICALS[industryFilter]?.categories || [];
        return industriesCats.includes(s.category);
      })
    : filteredSuggestions;

  const displaySuggestions = platformFilter
    ? industryFiltered.filter((s) => {
        const b = computePlatformBreakdown(s);
        // Show suggestions that have any signal from this platform
        const score = typeof b[platformFilter] === "number" ? b[platformFilter] : 0;
        return score > 0;
      })
    : industryFiltered;

  // Auto-generate on mount if no report
  // Strategy: tries Firestore first (instant), falls back to live scrape
  useEffect(() => {
    if (!report && !loading) {
      generate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartBrief = (suggestion) => {
    // Navigate to Authoring Workbench with rich context
    const query = `${suggestion.topic} in ${suggestion.category}`;
    const painPoints = report?.painPointsByCategory?.[suggestion.category] || [];
    const relatedQuestions = (report?.trendingQuestions || []).filter(
      (q) => q.category?.toLowerCase() === suggestion.category.toLowerCase()
    );

    // Persist payload to localStorage so AuthoringWorkbench can read it
    // even if it hasn't mounted yet when the event fires.
    const payload = {
      query,
      suggestion,
      painPoints: painPoints.slice(0, 5),
      trendingQuestions: relatedQuestions.slice(0, 5),
      context: {
        demandScore: suggestion.demandScore,
        coverageInLibrary: suggestion.coverageInLibrary,
        gap: suggestion.gap,
        confidence: suggestion.confidence,
        redditEngagement: suggestion.redditEngagement || null,
      },
    };
    localStorage.setItem("demand-start-authoring-payload", JSON.stringify(payload));

    window.location.hash = "authoring";
    // Also dispatch event for workbench pre-population
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("demand-start-authoring", { detail: payload })
      );
    }, 400);
  };

  return (
    <div className="demand-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h2 data-tooltip="Demand Intelligence scans community forums, StackOverflow, Reddit, and your video library to identify the best topics to create content about.">📊 Demand Intelligence</h2>
        <div className="header-actions">
          {report && (
            <span className="data-source-badge" data-tooltip={
              report._source === "firestore"
                ? "Data pre-computed by the scheduled GitHub Action and loaded instantly from Firestore"
                : "Data generated via live AI scraping in your browser"
            }>
              {report._source === "firestore" ? "⚡ Pre-computed" : "🔄 Live Data"}
              {report.generatedAt && (
                <span className="data-source-time">
                  {" · "}{new Date(report.generatedAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    timeZone: "America/New_York", timeZoneName: "short",
                  })}
                </span>
              )}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            data-tooltip={report?._source === "firestore"
              ? "Re-fetch pre-computed data from Firestore (instant)"
              : "Clear cached data and re-scan all sources for fresh demand signals (takes 30–60 seconds)"}
          >
            {loading ? "⏳ Scanning..." : "🔄 Refresh"}
          </button>
          <ScrapeButton onComplete={refresh} />
        </div>
      </div>

      {/* Critical Gap Alerts */}
      {report && (
        <CriticalGapAlerts
          suggestions={report.suggestions}
          painPointsByCategory={report.painPointsByCategory}
          trendingQuestions={report.trendingQuestions}
          onStartAuthoring={handleStartBrief}
        />
      )}

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
            <div className="stat" data-tooltip="Total number of content opportunities identified by cross-referencing demand signals against your library's existing coverage.">
              <span className="stat-value">{stats?.totalSuggestions || 0}</span>
              <span className="stat-label">Opportunities</span>
            </div>
            <div className="stat" data-tooltip="Questions actively being asked in UE5 communities — sourced from Reddit, Epic Forums, Stack Overflow, and YouTube comments.">
              <span className="stat-value">{stats?.trendingQuestions || 0}</span>
              <span className="stat-label">Trending Questions</span>
            </div>
            <div className="stat" data-tooltip="Specific frustrations and struggles identified from community posts — topics where learners are getting stuck.">
              <span className="stat-value">{stats?.painPointCount || 0}</span>
              <span className="stat-label">Pain Points</span>
            </div>
            <div className="stat" data-tooltip="Number of UE5 topic categories scanned (e.g. Blueprints, AI, Animation, Niagara, etc.)">
              <span className="stat-value">{stats?.categoriesScanned || 0}</span>
              <span className="stat-label">Categories</span>
            </div>
          </div>

          {/* Platform Demand Breakdown */}
          <PlatformBreakdownPanel
            suggestions={report.suggestions}
            report={report}
            onPlatformFilter={setPlatformFilter}
            activePlatformFilter={platformFilter}
          />

          {/* Two-column layout — collapses to single column when no questions */}
          <div className={`dashboard-columns ${(report.trendingQuestions || []).length === 0 ? 'single-column' : ''}`}>
            {/* Left: Suggestions */}
            <div className="column-suggestions">
              <div className="column-header">
                <h3 data-tooltip="Topics ranked by opportunity score: high community demand × low coverage in your library = biggest opportunity">🎯 Top Course Opportunities</h3>
                <div className="industry-filter-row">
                  <span className="filter-group-label">🏭 Industry:</span>
                  <button
                    className={`filter-chip industry-chip ${!industryFilter ? "active" : ""}`}
                    onClick={() => { setIndustryFilter(null); setSubVerticalFilter(null); }}
                  >
                    All
                  </button>
                  {Object.keys(INDUSTRY_VERTICALS).map((ind) => (
                    <button
                      key={ind}
                      className={`filter-chip industry-chip ${industryFilter === ind ? "active" : ""}`}
                      style={{ '--chip-color': INDUSTRY_COLORS[ind] }}
                      onClick={() => {
                        setIndustryFilter(industryFilter === ind ? null : ind);
                        setSubVerticalFilter(null);
                      }}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
                {industryFilter && INDUSTRY_VERTICALS[industryFilter]?.subVerticals && (
                  <div className="sub-vertical-filter-row">
                    <span className="filter-group-label">📐 Focus:</span>
                    <button
                      className={`filter-chip sub-vertical-chip ${!subVerticalFilter ? "active" : ""}`}
                      onClick={() => setSubVerticalFilter(null)}
                    >
                      All {industryFilter}
                    </button>
                    {Object.keys(INDUSTRY_VERTICALS[industryFilter].subVerticals).map((sv) => {
                      const svCats = INDUSTRY_VERTICALS[industryFilter].subVerticals[sv];
                      const svCount = displaySuggestions.filter((s) => svCats.includes(s.category)).length;
                      return (
                        <button
                          key={sv}
                          className={`filter-chip sub-vertical-chip ${subVerticalFilter === sv ? "active" : ""}`}
                          style={{ '--chip-color': INDUSTRY_COLORS[industryFilter] }}
                          onClick={() => setSubVerticalFilter(subVerticalFilter === sv ? null : sv)}
                          data-tooltip={`${sv}: ${svCats.join(", ")} (${svCount} topics)`}
                        >
                          {sv} <span className="chip-count">{svCount}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                {displaySuggestions.slice(0, 15).map((suggestion, i) => (
                  <SuggestionCard
                    key={`${suggestion.category}-${suggestion.topic}`}
                    suggestion={suggestion}
                    rank={i + 1}
                    onStartBrief={handleStartBrief}
                  />
                ))}
                {displaySuggestions.length === 0 && (
                  <div className="empty-state">
                    No suggestions found for this category.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Trending Questions */}
            <div className="column-trending">
              <div className="column-header">
                <h3 data-tooltip="Real questions being asked right now in UE5 developer communities — sourced via AI-powered web search">💬 Live Community Questions</h3>
                <span className="source-badge" data-tooltip="These questions are discovered using Google Gemini's grounded search, which scans live web content from forums and Q&A sites">Gemini Grounded Search</span>
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
            stats={stats}
            suggestions={report.suggestions}
          />
        </>
      )}
    </div>
  );
}

export default DemandDashboard;
