/**
 * VertexAIMonitor — Compact monitoring widget for Vertex AI Search.
 * Shows inline health status; full details (live search, logs) expand on click.
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
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import "./VertexAIMonitor.css";

const TEST_QUERIES = [
  "Lumen global illumination",
  "Nanite virtual geometry",
  "Blueprint compile error",
  "Niagara particles",
  "World Partition",
];

export default function VertexAIMonitor() {
  const [expanded, setExpanded] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLatency, setHealthLatency] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLatency, setSearchLatency] = useState(null);
  const [logs, setLogs] = useState([]);
  const logIdRef = useRef(0);

  const addLog = useCallback((type, message) => {
    setLogs((prev) => [
      {
        id: logIdRef.current++,
        time: new Date().toISOString().split("T")[1].split(".")[0],
        type,
        message,
      },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const runHealthCheck = useCallback(async () => {
    setHealthStatus("checking");
    setHealthError(null);
    addLog("info", "Health check…");
    const start = performance.now();
    try {
      const result = await searchDocsVertexAI("Unreal Engine 5", 1);
      const ms = Math.round(performance.now() - start);
      setHealthLatency(ms);
      if (result.results?.length > 0 || result.summary) {
        setHealthStatus("healthy");
        addLog("success", `Passed (${ms}ms, ${result.results?.length || 0} results)`);
      } else {
        setHealthStatus("error");
        setHealthError("No results — data store may still be indexing");
        addLog("warning", `No results (${ms}ms)`);
      }
    } catch (err) {
      setHealthLatency(Math.round(performance.now() - start));
      setHealthStatus("error");
      setHealthError(err.message);
      addLog("error", err.message);
    }
  }, [addLog]);

  const runSearch = useCallback(async (q) => {
    if (!q?.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    const start = performance.now();
    try {
      const result = await searchDocsVertexAI(q, 5);
      setSearchLatency(Math.round(performance.now() - start));
      setSearchResults(result);
    } catch {
      /* swallow */
    } finally {
      setIsSearching(false);
    }
  }, []);

  return (
    <div className="vai-widget">
      {/* ── Compact header bar (always visible) ────────────────────── */}
      <button className="vai-header-bar" onClick={() => setExpanded(!expanded)}>
        <div className="vai-header-left">
          <Activity size={15} />
          <span className="vai-header-title">Vertex AI Search</span>
          <span className="vai-admin-tag">ADMIN</span>
        </div>

        <div className="vai-header-right">
          {healthStatus === "healthy" && (
            <span className="vai-status-pill vai-pill-ok">
              <CheckCircle2 size={12} /> Connected
              {healthLatency && <span className="vai-pill-ms">{healthLatency}ms</span>}
            </span>
          )}
          {healthStatus === "error" && (
            <span className="vai-status-pill vai-pill-err">
              <XCircle size={12} /> Error
            </span>
          )}
          {healthStatus === "checking" && (
            <span className="vai-status-pill vai-pill-checking">
              <RefreshCw size={12} className="vai-spin" /> Checking
            </span>
          )}
          {!healthStatus && (
            <button
              className="vai-inline-check"
              onClick={(e) => {
                e.stopPropagation();
                runHealthCheck();
              }}
            >
              <RefreshCw size={12} /> Check
            </button>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* ── Expandable detail panel ────────────────────────────────── */}
      {expanded && (
        <div className="vai-detail">
          {/* Health row */}
          <div className="vai-detail-row">
            <div className="vai-detail-stats">
              <div className="vai-stat">
                <span className="vai-stat-label">Status</span>
                <span className={`vai-stat-val vai-c-${healthStatus || "unknown"}`}>
                  {healthStatus === "healthy"
                    ? "Connected"
                    : healthStatus === "error"
                      ? "Error"
                      : healthStatus === "checking"
                        ? "Checking…"
                        : "—"}
                </span>
              </div>
              <div className="vai-stat">
                <span className="vai-stat-label">Latency</span>
                <span className="vai-stat-val">{healthLatency ? `${healthLatency}ms` : "—"}</span>
              </div>
              <div className="vai-stat">
                <span className="vai-stat-label">Data Store</span>
                <span className="vai-stat-val">ue5-docs-datastore</span>
              </div>
              <div className="vai-stat">
                <span className="vai-stat-label">Project</span>
                <span className="vai-stat-val">development-317819</span>
              </div>
              <button
                className="vai-btn-sm"
                onClick={runHealthCheck}
                disabled={healthStatus === "checking"}
              >
                <RefreshCw size={12} className={healthStatus === "checking" ? "vai-spin" : ""} />
                Health Check
              </button>
            </div>
            {healthError && (
              <div className="vai-err-line">
                <AlertTriangle size={12} /> {healthError}
              </div>
            )}
          </div>

          {/* Search test */}
          <div className="vai-detail-row">
            <form
              className="vai-search-row"
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(searchQuery);
              }}
            >
              <Search size={14} />
              <input
                className="vai-search-inp"
                placeholder="Test a query…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="vai-btn-sm" type="submit" disabled={isSearching}>
                {isSearching ? "…" : "Go"}
              </button>
            </form>
            <div className="vai-chips">
              {TEST_QUERIES.map((q) => (
                <button
                  key={q}
                  className="vai-chip"
                  onClick={() => {
                    setSearchQuery(q);
                    runSearch(q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            {searchResults && (
              <div className="vai-search-out">
                {searchLatency && (
                  <span className="vai-latency">
                    <Clock size={10} /> {searchLatency}ms
                  </span>
                )}
                {searchResults.summary && (
                  <p className="vai-summary">
                    <Sparkles size={10} /> {searchResults.summary}
                  </p>
                )}
                <span className="vai-res-count">
                  {searchResults.results?.length || 0} results
                  {searchResults.references?.length > 0 &&
                    `, ${searchResults.references.length} refs`}
                </span>
              </div>
            )}
          </div>

          {/* Log */}
          {logs.length > 0 && (
            <div className="vai-log-box">
              {logs.map((l) => (
                <div key={l.id} className={`vai-log vai-log-${l.type}`}>
                  <span className="vai-log-t">{l.time}</span>
                  <span className="vai-log-m">{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
