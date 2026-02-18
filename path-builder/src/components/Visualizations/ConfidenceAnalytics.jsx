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
        <h3>🧠 Confidence Routing Analytics</h3>
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
          {/* Summary Cards */}
          <div className="ca-cards">
            <div className="ca-card">
              <span className="ca-card-value">{total}</span>
              <span className="ca-card-label">Total Queries</span>
            </div>
            <div className="ca-card ca-card-clarify">
              <span className="ca-card-value">{pct(clarifyCount)}%</span>
              <span className="ca-card-label">Clarified ({clarifyCount})</span>
            </div>
            <div className="ca-card ca-card-direct">
              <span className="ca-card-value">{pct(directCount)}%</span>
              <span className="ca-card-label">Direct ({directCount})</span>
            </div>
            <div className="ca-card ca-card-agentic">
              <span className="ca-card-value">{pct(agenticCount)}%</span>
              <span className="ca-card-label">Agentic RAG ({agenticCount})</span>
            </div>
            <div className="ca-card">
              <span className="ca-card-value">{avgScore}</span>
              <span className="ca-card-label">Avg Score</span>
            </div>
            <div className="ca-card">
              <span className="ca-card-value">{avgQueryLen}</span>
              <span className="ca-card-label">Avg Query Length</span>
            </div>
          </div>

          {/* Outcome Distribution Bar */}
          <div className="ca-distribution">
            <h4>Outcome Distribution</h4>
            <div className="ca-bar">
              {clarifyCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-clarify"
                  style={{ width: `${pct(clarifyCount)}%` }}
                  title={`Clarify: ${clarifyCount}`}
                >
                  {pct(clarifyCount)}%
                </div>
              )}
              {directCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-direct"
                  style={{ width: `${pct(directCount)}%` }}
                  title={`Direct: ${directCount}`}
                >
                  {pct(directCount)}%
                </div>
              )}
              {agenticCount > 0 && (
                <div
                  className="ca-bar-segment ca-seg-agentic"
                  style={{ width: `${pct(agenticCount)}%` }}
                  title={`Agentic: ${agenticCount}`}
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
              <h4>Top Scoring Reasons</h4>
              <div className="ca-reason-tags">
                {topReasons.map(([reason, count]) => (
                  <span key={reason} className="ca-reason-tag">
                    {reason.replace(/_/g, " ")} <strong>({count})</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Entries Table */}
          <div className="ca-table-wrap">
            <h4>Recent Routing Decisions</h4>
            <table className="ca-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Outcome</th>
                  <th>Score</th>
                  <th>Query Len</th>
                  <th>Round</th>
                  <th>Reasons</th>
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
                        <span key={i} className="ca-mini-tag">
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

export default ConfidenceAnalytics;
