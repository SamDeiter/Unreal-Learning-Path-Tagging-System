/**
 * ConfidenceAnalytics — Dashboard showing confidence routing metrics.
 *
 * Queries Firestore `apiUsage` collection for entries with type='confidence_routing'
 * and displays:
 *   - Summary cards (total queries, clarify %, direct %, agentic %)
 *   - Outcome distribution bar
 *   - Recent routing decisions table
 */
import { useState, useEffect, useCallback } from "react";
import { getFirebaseApp } from "../../services/firebaseConfig";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import "./ConfidenceAnalytics.css";

/** Inline tooltip component — hover to reveal explanation */
function Tip({ text, children }) {
  return (
    <span className="ca-tip-wrap">
      {children}
      <span className="ca-tip-icon" title={text}>
        ⓘ
      </span>
      <span className="ca-tip-popup">{text}</span>
    </span>
  );
}

function ConfidenceAnalytics() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entryLimit, setEntryLimit] = useState(100);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const app = getFirebaseApp();
      const db = getFirestore(app);
      const q = query(
        collection(db, "apiUsage"),
        where("type", "==", "confidence_routing"),
        orderBy("timestamp", "desc"),
        limit(entryLimit)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || null,
      }));
      setEntries(docs);
    } catch (err) {
      console.error("Failed to load confidence analytics:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entryLimit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Computed metrics ──────────────────────────────────────────────
  const total = entries.length;
  const clarifyCount = entries.filter((e) => e.outcome === "clarify").length;
  const directCount = entries.filter((e) => e.outcome === "direct_answer").length;
  const agenticCount = entries.filter((e) => e.outcome === "agentic_rag").length;

  const avgScore =
    total > 0 ? (entries.reduce((sum, e) => sum + (e.score || 0), 0) / total).toFixed(1) : "—";

  const avgQueryLen =
    total > 0 ? Math.round(entries.reduce((sum, e) => sum + (e.queryLength || 0), 0) / total) : "—";

  const pct = (count) => (total > 0 ? ((count / total) * 100).toFixed(1) : "0");

  // Most common reasons across all entries
  const reasonCounts = {};
  entries.forEach((e) => {
    (e.reasons || []).forEach((r) => {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });
  });
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="ca-container">
      <div className="ca-header">
        <h3>
          🧠 Confidence Routing Analytics
          <span className="ca-header-subtitle">
            How the AI decides whether to clarify or answer directly
          </span>
        </h3>
        <div className="ca-controls">
          <select
            value={entryLimit}
            onChange={(e) => setEntryLimit(Number(e.target.value))}
            className="ca-limit-select"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
          <button className="ca-refresh-btn" onClick={loadData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <div className="ca-error">⚠️ {error}</div>}

      {loading ? (
        <div className="ca-loading">Loading analytics…</div>
      ) : total === 0 ? (
        <div className="ca-empty">
          No confidence routing data yet. Submit a query on the "Fix a Problem" tab to start
          collecting analytics.
        </div>
      ) : (
        <>
          {/* Summary Cards — Row 1: Counts */}
          <div className="ca-cards ca-cards-top">
            <div className="ca-card">
              <Tip text="Total number of diagnostic queries processed by the AI system in this time period.">
                <span className="ca-card-value">{total}</span>
              </Tip>
              <span className="ca-card-label">Total Queries</span>
            </div>
            <div className="ca-card ca-card-clarify">
              <Tip text="Percentage of queries where the AI asked a follow-up clarification question before answering. Higher means users are asking vague questions.">
                <span className="ca-card-value">{pct(clarifyCount)}%</span>
              </Tip>
              <span className="ca-card-label">Clarified ({clarifyCount})</span>
            </div>
            <div className="ca-card ca-card-direct">
              <Tip text="Percentage of queries where the AI had enough context to answer directly without asking follow-up questions. Higher is better — means users are providing clear, detailed queries.">
                <span className="ca-card-value">{pct(directCount)}%</span>
              </Tip>
              <span className="ca-card-label">Direct ({directCount})</span>
            </div>
          </div>

          {/* Summary Cards — Row 2: Deeper Metrics */}
          <div className="ca-cards ca-cards-bottom">
            <div className="ca-card ca-card-agentic">
              <Tip text="Percentage of queries routed to the Agentic RAG pipeline — an advanced multi-step search that automatically expands and retries when initial results are insufficient.">
                <span className="ca-card-value">{pct(agenticCount)}%</span>
              </Tip>
              <span className="ca-card-label">Agentic RAG ({agenticCount})</span>
            </div>
            <div className="ca-card">
              <Tip text="Average confidence score across all queries (0–100+). Score determines routing: <50 = Clarify, 50–74 = Agentic RAG, 75+ = Direct Answer. Factors: query specificity, error strings, RAG passage quality, engine version, multi-turn history.">
                <span className="ca-card-value">{avgScore}</span>
              </Tip>
              <span className="ca-card-label">Avg Score</span>
            </div>
            <div className="ca-card">
              <Tip text="Average character length of user queries. Longer queries tend to get higher confidence scores and better answers. Short queries (<30 chars) receive a -15 point penalty.">
                <span className="ca-card-value">{avgQueryLen}</span>
              </Tip>
              <span className="ca-card-label">Avg Query Length</span>
            </div>
          </div>

          {/* Outcome Distribution Bar */}
          <div className="ca-distribution">
            <h4>
              <Tip text="Visual breakdown of how queries were routed. Clarify (amber) = asked follow-up questions. Direct (green) = answered immediately. Agentic (purple) = used advanced multi-step search pipeline.">
                Outcome Distribution
              </Tip>
            </h4>
            <div className="ca-bar">
              {clarifyCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-clarify"
                  style={{ width: `${pct(clarifyCount)}%` }}
                  title={`Clarify: ${clarifyCount} queries (${pct(clarifyCount)}%)`}
                >
                  {pct(clarifyCount)}%
                </div>
              )}
              {directCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-direct"
                  style={{ width: `${pct(directCount)}%` }}
                  title={`Direct Answer: ${directCount} queries (${pct(directCount)}%)`}
                >
                  {pct(directCount)}%
                </div>
              )}
              {agenticCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-agentic"
                  style={{ width: `${pct(agenticCount)}%` }}
                  title={`Agentic RAG: ${agenticCount} queries (${pct(agenticCount)}%)`}
                >
                  {pct(agenticCount)}%
                </div>
              )}
            </div>
            <div className="ca-legend">
              <span className="ca-legend-item">
                <span className="ca-dot ca-dot-clarify" /> Clarify
              </span>
              <span className="ca-legend-item">
                <span className="ca-dot ca-dot-direct" /> Direct Answer
              </span>
              <span className="ca-legend-item">
                <span className="ca-dot ca-dot-agentic" /> Agentic RAG
              </span>
            </div>
          </div>

          {/* Top Scoring Reasons */}
          {topReasons.length > 0 && (
            <div className="ca-reasons">
              <h4>
                <Tip text="Most frequent signals that influenced the confidence score. Each query can have multiple reasons. These help you understand WHY the AI chose to clarify vs answer directly.">
                  Top Scoring Reasons
                </Tip>
              </h4>
              <div className="ca-reason-tags">
                {topReasons.map(([reason, count]) => (
                  <span key={reason} className="ca-reason-tag" title={getReasonExplanation(reason)}>
                    {reason.replace(/_/g, " ")} <strong>({count})</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Entries Table */}
          <div className="ca-table-wrap">
            <h4>
              <Tip text="Individual routing decisions in reverse chronological order. Each row shows one user query: when it happened, how it was routed, the confidence score, query length, which clarification round it was, and what signals influenced the decision.">
                Recent Routing Decisions
              </Tip>
            </h4>
            <table className="ca-table">
              <thead>
                <tr>
                  <th title="When the query was submitted">Time</th>
                  <th title="How the AI routed this query: Clarify (asked follow-up), Direct (answered immediately), or Agentic (multi-step search)">
                    Outcome
                  </th>
                  <th title="Confidence score (0–100+). Higher = more confident. Thresholds: <50 Clarify, 50–74 Agentic, 75+ Direct">
                    Score
                  </th>
                  <th title="Character length of the user's query. Longer queries provide more context for better answers">
                    Query Len
                  </th>
                  <th title="Which clarification round this was. Round 0 = first query, Round 1+ = after follow-up questions">
                    Round
                  </th>
                  <th title="Signals that influenced the confidence score for this specific query">
                    Reasons
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 25).map((e) => (
                  <tr key={e.id} className={`ca-row-${e.outcome}`}>
                    <td className="ca-time">
                      {e.timestamp
                        ? e.timestamp.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      <span className={`ca-outcome-badge ca-badge-${e.outcome}`}>
                        {e.outcome === "clarify"
                          ? "🔍 Clarify"
                          : e.outcome === "direct_answer"
                            ? "✅ Direct"
                            : "🤖 Agentic"}
                      </span>
                    </td>
                    <td className="ca-score">{e.score ?? "—"}</td>
                    <td>{e.queryLength ?? "—"}</td>
                    <td>{e.round ?? e.clarifyRoundsCompleted ?? "—"}</td>
                    <td className="ca-reasons-cell">
                      {(e.reasons || []).map((r, i) => (
                        <span key={i} className="ca-mini-tag" title={getReasonExplanation(r)}>
                          {r.replace(/_/g, " ")}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Maps reason codes to human-readable explanations for tooltips */
function getReasonExplanation(reason) {
  const explanations = {
    multiple_systems_identified:
      "The AI detected 2+ UE5 subsystems in the query (e.g., Lumen + Nanite). +30 points — highly specific.",
    single_system_identified: "The AI detected exactly 1 UE5 subsystem. +15 points.",
    engine_version_provided:
      "The user specified their UE5 version (e.g., 5.3). +15 points — helps target version-specific answers.",
    error_strings_provided:
      "The user included error messages or log output. +25 points — very specific, high confidence.",
    platform_provided: "The user specified their platform (Windows, Mac, etc.). +5 points.",
    change_context_provided:
      "The user described what they changed recently. +10 points — helps narrow root cause.",
    strong_rag_matches:
      "2+ high-quality transcript passages matched (>0.4 similarity). +25 points.",
    partial_rag_match: "1 high-quality transcript passage matched. +15 points.",
    decent_rag_matches:
      "2+ moderate transcript passages matched (0.35–0.40 similarity). +10 points.",
    short_query_penalty:
      "Query was under 30 characters. -15 points — too vague for a direct answer.",
    no_structured_context_penalty: "No case report or multi-system info provided. -10 points.",
  };
  // Handle multi_turn_rounds_N pattern
  if (reason.startsWith("multi_turn_rounds_")) {
    const n = reason.split("_").pop();
    return `${n} clarification round(s) completed. +${Math.min(n * 15, 45)} points — each round adds context.`;
  }
  return explanations[reason] || reason.replace(/_/g, " ");
}

/**
 * OnboardingRAGAnalytics — Tracks effectiveness of the onboarding RAG pipeline.
 * Queries Firestore `apiUsage` where type == "onboarding_rag".
 */
function OnboardingRAGAnalytics() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const app = getFirebaseApp();
      const db = getFirestore(app);
      const q = query(
        collection(db, "apiUsage"),
        where("type", "==", "onboarding_rag"),
        orderBy("timestamp", "desc"),
        limit(200)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || null,
      }));
      setEntries(docs);
    } catch (err) {
      console.error("Failed to load onboarding analytics:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Computed metrics ──
  // Filter to pipeline-level events (not enrichment sub-events)
  const pipelineEvents = entries.filter(
    (e) => e.outcome === "rag_success" || e.outcome === "rag_fallback"
  );
  const enrichmentEvents = entries.filter((e) => e.outcome === "enrichment");

  const total = pipelineEvents.length;
  const successCount = pipelineEvents.filter((e) => e.outcome === "rag_success").length;
  const fallbackCount = pipelineEvents.filter((e) => e.outcome === "rag_fallback").length;
  const pct = (count) => (total > 0 ? ((count / total) * 100).toFixed(1) : "0");

  const avgModules =
    successCount > 0
      ? (
          pipelineEvents
            .filter((e) => e.outcome === "rag_success")
            .reduce((sum, e) => sum + (e.modulesReturned || 0), 0) / successCount
        ).toFixed(1)
      : "—";

  const avgPassages =
    successCount > 0
      ? (
          pipelineEvents
            .filter((e) => e.outcome === "rag_success")
            .reduce((sum, e) => sum + (e.passagesFound || 0), 0) / successCount
        ).toFixed(1)
      : "—";

  const avgDuration =
    total > 0
      ? (
          pipelineEvents.reduce((sum, e) => sum + (e.pipelineDurationMs || 0), 0) /
          total /
          1000
        ).toFixed(1)
      : "—";

  // Enrichment rate from enrichment events
  const avgEnrichmentRate =
    enrichmentEvents.length > 0
      ? (
          (enrichmentEvents.reduce((sum, e) => sum + (e.modulesEnriched || 0), 0) /
            enrichmentEvents.reduce((sum, e) => sum + (e.modulesTotal || 1), 0)) *
          100
        ).toFixed(1)
      : "—";

  // Most common archetypes
  const archetypeCounts = {};
  pipelineEvents.forEach((e) => {
    if (e.archetype && e.archetype !== "unknown") {
      archetypeCounts[e.archetype] = (archetypeCounts[e.archetype] || 0) + 1;
    }
  });
  const topArchetypes = Object.entries(archetypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="ca-container ca-onboarding-section">
      <div className="ca-header">
        <h3>
          🎓 Onboarding RAG Analytics
          <span className="ca-header-subtitle">
            How effectively the AI generates learning paths from the course library
          </span>
        </h3>
        <div className="ca-controls">
          <button className="ca-refresh-btn" onClick={loadData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <div className="ca-error">⚠️ {error}</div>}

      {loading ? (
        <div className="ca-loading">Loading onboarding analytics…</div>
      ) : total === 0 ? (
        <div className="ca-empty">
          No onboarding RAG data yet. Complete the onboarding quiz on the "Onboarding" tab to start
          collecting analytics.
        </div>
      ) : (
        <>
          {/* Summary Cards — Row 1 */}
          <div className="ca-cards ca-cards-top" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div className="ca-card">
              <Tip text="Total onboarding paths generated through the RAG pipeline (success + fallback).">
                <span className="ca-card-value">{total}</span>
              </Tip>
              <span className="ca-card-label">Paths Generated</span>
            </div>
            <div className="ca-card ca-card-onb-success">
              <Tip text="Percentage of onboarding attempts where the RAG pipeline successfully generated a curriculum. Higher is better.">
                <span className="ca-card-value">{pct(successCount)}%</span>
              </Tip>
              <span className="ca-card-label">RAG Success ({successCount})</span>
            </div>
            <div className="ca-card ca-card-onb-fallback">
              <Tip text="Percentage that fell back to local scoring (RAG pipeline failed or timed out).">
                <span className="ca-card-value">{pct(fallbackCount)}%</span>
              </Tip>
              <span className="ca-card-label">Fallback ({fallbackCount})</span>
            </div>
            <div className="ca-card ca-card-onb-enrichment">
              <Tip text="Average percentage of RAG modules that were matched to real courses with playable video. Higher means more 'Watch Course' buttons appear.">
                <span className="ca-card-value">{avgEnrichmentRate}%</span>
              </Tip>
              <span className="ca-card-label">Enrichment Rate</span>
            </div>
          </div>

          {/* Summary Cards — Row 2 */}
          <div className="ca-cards ca-cards-bottom">
            <div className="ca-card">
              <Tip text="Average number of curriculum modules returned by the assembler per successful path.">
                <span className="ca-card-value">{avgModules}</span>
              </Tip>
              <span className="ca-card-label">Avg Modules</span>
            </div>
            <div className="ca-card">
              <Tip text="Average number of unique transcript passages retrieved from the search step per successful path.">
                <span className="ca-card-value">{avgPassages}</span>
              </Tip>
              <span className="ca-card-label">Avg Passages</span>
            </div>
            <div className="ca-card">
              <Tip text="Average total pipeline duration (plan → search → assemble) in seconds.">
                <span className="ca-card-value">{avgDuration}s</span>
              </Tip>
              <span className="ca-card-label">Avg Duration</span>
            </div>
          </div>

          {/* Outcome Distribution */}
          <div className="ca-distribution">
            <h4>
              <Tip text="Visual breakdown of onboarding pipeline outcomes. Success (teal) = RAG pipeline completed. Fallback (amber) = fell back to local scoring.">
                Outcome Distribution
              </Tip>
            </h4>
            <div className="ca-bar">
              {successCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-onb-success"
                  style={{ width: `${pct(successCount)}%` }}
                  title={`RAG Success: ${successCount} (${pct(successCount)}%)`}
                >
                  {pct(successCount)}%
                </div>
              )}
              {fallbackCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-onb-fallback"
                  style={{ width: `${pct(fallbackCount)}%` }}
                  title={`Fallback: ${fallbackCount} (${pct(fallbackCount)}%)`}
                >
                  {pct(fallbackCount)}%
                </div>
              )}
            </div>
            <div className="ca-legend">
              <span className="ca-legend-item">
                <span className="ca-dot ca-dot-onb-success" /> RAG Success
              </span>
              <span className="ca-legend-item">
                <span className="ca-dot ca-dot-onb-fallback" /> Fallback
              </span>
            </div>
          </div>

          {/* Top Archetypes */}
          {topArchetypes.length > 0 && (
            <div className="ca-reasons">
              <h4>
                <Tip text="Most common user archetypes detected by the planner. This shows what kinds of learners are using the onboarding system.">
                  Top Archetypes
                </Tip>
              </h4>
              <div className="ca-reason-tags">
                {topArchetypes.map(([archetype, count]) => (
                  <span key={archetype} className="ca-reason-tag ca-archetype-tag">
                    {archetype} <strong>({count})</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Events Table */}
          <div className="ca-table-wrap">
            <h4>
              <Tip text="Recent onboarding RAG pipeline events in reverse chronological order.">
                Recent Onboarding Events
              </Tip>
            </h4>
            <table className="ca-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Outcome</th>
                  <th>Archetype</th>
                  <th title="Number of transcript passages found">Passages</th>
                  <th title="Number of curriculum modules returned">Modules</th>
                  <th title="Pipeline execution time">Duration</th>
                </tr>
              </thead>
              <tbody>
                {pipelineEvents.slice(0, 25).map((e) => (
                  <tr key={e.id} className={`ca-row-${e.outcome}`}>
                    <td className="ca-time">
                      {e.timestamp
                        ? e.timestamp.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={`ca-outcome-badge ${e.outcome === "rag_success" ? "ca-badge-onb-success" : "ca-badge-onb-fallback"}`}
                      >
                        {e.outcome === "rag_success" ? "✅ RAG Success" : "⚠️ Fallback"}
                      </span>
                    </td>
                    <td>{e.archetype || "—"}</td>
                    <td>{e.passagesFound ?? "—"}</td>
                    <td>{e.modulesReturned ?? "—"}</td>
                    <td>
                      {e.pipelineDurationMs ? `${(e.pipelineDurationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Combined Analytics Page — renders both confidence routing and onboarding analytics.
 */
function CombinedAnalytics() {
  return (
    <>
      <ConfidenceAnalytics />
      <OnboardingRAGAnalytics />
    </>
  );
}

export default CombinedAnalytics;
