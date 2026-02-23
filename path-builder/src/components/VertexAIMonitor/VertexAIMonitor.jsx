/**
 * VertexAIMonitor — Admin monitoring dashboard for Vertex AI Search integration.
 *
 * Shows: connection health, live search testing, latency metrics, and error logs.
 * Accessible via a debug route or admin panel.
 */
import { useState, useCallback, useRef } from "react";
import { searchDocsVertexAI } from "../../services/docsSearchService";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  Zap,
  BookOpen,
  Sparkles,
} from "lucide-react";
import "./VertexAIMonitor.css";

const TEST_QUERIES = [
  "Lumen global illumination setup",
  "Nanite virtual geometry",
  "Blueprint compile error",
  "Niagara particle system",
  "World Partition streaming",
];

export default function VertexAIMonitor() {
  const [healthStatus, setHealthStatus] = useState(null); // null | 'checking' | 'healthy' | 'error'
  const [healthLatency, setHealthLatency] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLatency, setSearchLatency] = useState(null);
  const [logs, setLogs] = useState([]);
  const logIdRef = useRef(0);

  const addLog = useCallback((type, message, details = null) => {
    setLogs((prev) => [
      {
        id: logIdRef.current++,
        timestamp: new Date().toISOString().split("T")[1].split(".")[0],
        type,
        message,
        details,
      },
      ...prev.slice(0, 49), // Keep last 50 logs
    ]);
  }, []);

  // ── Health Check ─────────────────────────────────────────────────────────
  const runHealthCheck = useCallback(async () => {
    setHealthStatus("checking");
    setHealthError(null);
    addLog("info", "Starting health check...");

    const start = performance.now();
    try {
      const result = await searchDocsVertexAI("Unreal Engine 5 overview", 1);
      const elapsed = Math.round(performance.now() - start);
      setHealthLatency(elapsed);

      if (result.results?.length > 0 || result.summary) {
        setHealthStatus("healthy");
        addLog("success", `Health check passed (${elapsed}ms)`, {
          results: result.results?.length || 0,
          hasSummary: !!result.summary,
        });
      } else {
        setHealthStatus("error");
        setHealthError("No results returned — data store may not be indexed yet");
        addLog("warning", `Health check: no results (${elapsed}ms)`);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setHealthLatency(elapsed);
      setHealthStatus("error");
      setHealthError(err.message);
      addLog("error", `Health check failed (${elapsed}ms): ${err.message}`);
    }
  }, [addLog]);

  // ── Live Search Test ─────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (query) => {
      if (!query?.trim()) return;
      setIsSearching(true);
      setSearchResults(null);
      addLog("info", `Searching: "${query}"`);

      const start = performance.now();
      try {
        const result = await searchDocsVertexAI(query, 5);
        const elapsed = Math.round(performance.now() - start);
        setSearchLatency(elapsed);
        setSearchResults(result);
        addLog("success", `Search returned ${result.results?.length || 0} results (${elapsed}ms)`, {
          hasSummary: !!result.summary,
          references: result.references?.length || 0,
        });
      } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        setSearchLatency(elapsed);
        addLog("error", `Search failed (${elapsed}ms): ${err.message}`);
      } finally {
        setIsSearching(false);
      }
    },
    [addLog]
  );

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      runSearch(searchQuery);
    },
    [searchQuery, runSearch]
  );

  return (
    <div className="vai-monitor">
      <div className="vai-monitor-header">
        <div className="vai-monitor-title">
          <Activity size={20} />
          <h2>Vertex AI Search Monitor</h2>
        </div>
        <span className="vai-monitor-badge">Admin Tool</span>
      </div>

      {/* ── Health Check Panel ─────────────────────────────────────────── */}
      <div className="vai-panel">
        <div className="vai-panel-header">
          <h3>
            <Zap size={16} /> Connection Health
          </h3>
          <button
            className="vai-btn vai-btn-sm"
            onClick={runHealthCheck}
            disabled={healthStatus === "checking"}
          >
            <RefreshCw size={14} className={healthStatus === "checking" ? "vai-spin" : ""} />
            {healthStatus === "checking" ? "Checking…" : "Run Health Check"}
          </button>
        </div>

        <div className="vai-health-grid">
          <div className={`vai-health-card vai-health-${healthStatus || "unknown"}`}>
            <div className="vai-health-icon">
              {healthStatus === "healthy" && <CheckCircle2 size={28} />}
              {healthStatus === "error" && <XCircle size={28} />}
              {healthStatus === "checking" && <RefreshCw size={28} className="vai-spin" />}
              {!healthStatus && <Activity size={28} />}
            </div>
            <div className="vai-health-label">
              {healthStatus === "healthy" && "Connected & Serving"}
              {healthStatus === "error" && "Error"}
              {healthStatus === "checking" && "Checking…"}
              {!healthStatus && "Not Checked"}
            </div>
          </div>

          <div className="vai-health-card">
            <div className="vai-health-icon">
              <Clock size={28} />
            </div>
            <div className="vai-health-label">{healthLatency ? `${healthLatency}ms` : "—"}</div>
            <div className="vai-health-sublabel">Latency</div>
          </div>

          <div className="vai-health-card">
            <div className="vai-health-icon">
              <BookOpen size={28} />
            </div>
            <div className="vai-health-label">ue5-docs-datastore</div>
            <div className="vai-health-sublabel">Data Store</div>
          </div>

          <div className="vai-health-card">
            <div className="vai-health-icon">
              <Sparkles size={28} />
            </div>
            <div className="vai-health-label">development-317819</div>
            <div className="vai-health-sublabel">GCP Project</div>
          </div>
        </div>

        {healthError && (
          <div className="vai-error-box">
            <AlertTriangle size={14} /> {healthError}
          </div>
        )}
      </div>

      {/* ── Live Search Test ───────────────────────────────────────────── */}
      <div className="vai-panel">
        <h3>
          <Search size={16} /> Live Search Test
        </h3>

        <form className="vai-search-form" onSubmit={handleSearchSubmit}>
          <input
            className="vai-search-input"
            type="text"
            placeholder="Test a UE5 query…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="vai-btn" type="submit" disabled={isSearching}>
            {isSearching ? "Searching…" : "Search"}
          </button>
        </form>

        <div className="vai-quick-queries">
          {TEST_QUERIES.map((q) => (
            <button
              key={q}
              className="vai-quick-btn"
              onClick={() => {
                setSearchQuery(q);
                runSearch(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {searchLatency && (
          <div className="vai-latency-badge">
            <Clock size={12} /> Response time: {searchLatency}ms
          </div>
        )}

        {searchResults && (
          <div className="vai-search-results">
            {searchResults.summary && (
              <div className="vai-summary-preview">
                <div className="vai-summary-label">
                  <Sparkles size={12} /> AI Summary
                </div>
                <p>{searchResults.summary}</p>
              </div>
            )}

            <div className="vai-results-count">
              {searchResults.results?.length || 0} results
              {searchResults.references?.length > 0 &&
                `, ${searchResults.references.length} references`}
            </div>

            {searchResults.results?.map((r, i) => (
              <div key={i} className="vai-result-row">
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title || "Untitled"}
                </a>
                <span className="vai-result-url">{r.url}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Activity Log ──────────────────────────────────────────────── */}
      <div className="vai-panel">
        <h3>
          <Activity size={16} /> Activity Log
        </h3>
        <div className="vai-log-list">
          {logs.length === 0 && (
            <div className="vai-log-empty">No activity yet. Run a health check to start.</div>
          )}
          {logs.map((log) => (
            <div key={log.id} className={`vai-log-entry vai-log-${log.type}`}>
              <span className="vai-log-time">{log.timestamp}</span>
              <span className="vai-log-type">{log.type.toUpperCase()}</span>
              <span className="vai-log-msg">{log.message}</span>
              {log.details && (
                <span className="vai-log-details">{JSON.stringify(log.details)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
