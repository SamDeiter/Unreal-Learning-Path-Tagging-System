/**
 * AdminErrorLogs — Admin-only component to browse production error logs.
 *
 * Reads from Firestore `errorLogs` collection.
 * Filters by source (ErrorBoundary, window.onerror, unhandledrejection).
 * Expandable stack trace rows with severity badges.
 */
import { useState, useEffect, useCallback } from "react";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { getFirebaseApp } from "../../services/firebaseConfig";
import "./AdminErrorLogs.css";

const SOURCE_FILTERS = ["all", "ErrorBoundary", "window.onerror", "unhandledrejection"];

function AdminErrorLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const db = getFirestore(getFirebaseApp());
      const q = query(collection(db, "errorLogs"), orderBy("timestamp", "desc"), limit(100));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLogs(items);
    } catch (err) {
      console.error("[AdminErrorLogs] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = sourceFilter === "all" ? logs : logs.filter((l) => l.source === sourceFilter);

  const sourceCounts = {
    all: logs.length,
    ErrorBoundary: logs.filter((l) => l.source === "ErrorBoundary").length,
    "window.onerror": logs.filter((l) => l.source === "window.onerror").length,
    unhandledrejection: logs.filter((l) => l.source === "unhandledrejection").length,
  };

  const formatTime = (ts) => {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const severityClass = (sev) => {
    if (!sev) return "ael-sev-error";
    const s = sev.toLowerCase();
    if (s === "warning") return "ael-sev-warning";
    if (s === "info") return "ael-sev-info";
    return "ael-sev-error";
  };

  return (
    <div className="admin-error-logs">
      <div className="ael-header">
        <h2 className="ael-title">🚨 Error Logs</h2>
        <button className="ael-refresh" onClick={fetchLogs} title="Refresh">
          🔄 Refresh
        </button>
      </div>

      <div className="ael-filters">
        {SOURCE_FILTERS.map((s) => (
          <button
            key={s}
            className={`ael-filter-btn ${sourceFilter === s ? "active" : ""}`}
            onClick={() => setSourceFilter(s)}
          >
            {s === "all" ? "All" : s} <span className="ael-count">{sourceCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ael-loading">Loading error logs...</div>
      ) : filtered.length === 0 ? (
        <div className="ael-empty">
          {sourceFilter === "all"
            ? "🎉 No errors logged yet — your app is running clean!"
            : `No errors from ${sourceFilter}.`}
        </div>
      ) : (
        <div className="ael-table-wrap">
          <table className="ael-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Message</th>
                <th>Source</th>
                <th>User</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`ael-row ${expandedId === item.id ? "ael-row-expanded" : ""}`}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <span className={`ael-sev-badge ${severityClass(item.severity)}`}>
                      {item.severity || "error"}
                    </span>
                  </td>
                  <td className="ael-msg-cell">
                    <div className="ael-msg">{item.message || "Unknown error"}</div>
                    {expandedId === item.id && item.stack && (
                      <pre className="ael-stack">{item.stack}</pre>
                    )}
                    {expandedId === item.id && item.url && (
                      <div className="ael-meta">
                        <span className="ael-meta-label">URL:</span> {item.url}
                      </div>
                    )}
                    {expandedId === item.id && item.componentStack && (
                      <pre className="ael-stack ael-component-stack">{item.componentStack}</pre>
                    )}
                  </td>
                  <td className="ael-source">{item.source || "—"}</td>
                  <td className="ael-user">
                    {item.userId ? item.userId.substring(0, 8) + "…" : "Anonymous"}
                  </td>
                  <td className="ael-time">{formatTime(item.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminErrorLogs;
