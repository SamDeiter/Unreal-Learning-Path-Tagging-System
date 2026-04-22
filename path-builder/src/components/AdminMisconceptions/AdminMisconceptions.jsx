import { useState, useEffect, useCallback } from "react";
import {
  listMisconceptions,
  listRecentSignals,
  runMining,
} from "../../services/misconceptionAdminService";
import "./AdminMisconceptions.css";

function formatDate(val) {
  if (!val) return "—";
  try {
    const d = typeof val === "object" && val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminMisconceptions() {
  const [misconceptions, setMisconceptions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [minGroupSize, setMinGroupSize] = useState(3);
  const [tagFilter, setTagFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        listMisconceptions({ max: 200 }),
        listRecentSignals({ max: 100 }),
      ]);
      setMisconceptions(m);
      setSignals(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const tags = tagFilter
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await runMining({
        minGroupSize: Number(minGroupSize) || undefined,
        tags: tags.length ? tags : undefined,
      });
      setRunResult(res);
      await load();
    } catch (err) {
      setRunError(err?.message || "Mining failed");
    } finally {
      setRunning(false);
    }
  };

  const signalsBySource = signals.reduce(
    (acc, s) => {
      const src = s.source || "unknown";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="admin-misc">
      <div className="am-header">
        <h2 className="am-title">🧠 Misconception Library</h2>
        <button className="am-refresh" onClick={load} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div className="am-stats">
        <div className="am-stat-card">
          <div className="am-stat-label">Taxonomy entries</div>
          <div className="am-stat-value">{misconceptions.length}</div>
        </div>
        <div className="am-stat-card">
          <div className="am-stat-label">Recent signals</div>
          <div className="am-stat-value">{signals.length}</div>
          <div className="am-stat-sub">
            {Object.entries(signalsBySource)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || "—"}
          </div>
        </div>
      </div>

      <div className="am-run">
        <h3 className="am-section-title">Run synthesis</h3>
        <div className="am-run-controls">
          <label className="am-field">
            <span>Min group size</span>
            <input
              type="number"
              min={1}
              max={50}
              value={minGroupSize}
              onChange={(e) => setMinGroupSize(e.target.value)}
            />
          </label>
          <label className="am-field am-field-wide">
            <span>Tags (comma-separated, optional)</span>
            <input
              type="text"
              placeholder="e.g. action_mapping, input_system"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </label>
          <button className="am-run-btn" onClick={handleRun} disabled={running}>
            {running ? "Mining…" : "Run mining"}
          </button>
        </div>
        {runResult && (
          <div className="am-run-result">
            ✅ Processed {runResult.groupsProcessed} groups · upserted{" "}
            {runResult.misconceptionsUpserted} · tags:{" "}
            {(runResult.tagsCovered || []).join(", ") || "none"}
            {(runResult.skippedTags || []).length > 0 && (
              <div className="am-run-skipped">
                Skipped (too small): {runResult.skippedTags.join(", ")}
              </div>
            )}
          </div>
        )}
        {runError && <div className="am-run-error">❌ {runError}</div>}
      </div>

      <h3 className="am-section-title">Taxonomy</h3>
      {loading ? (
        <div className="am-loading">Loading…</div>
      ) : misconceptions.length === 0 ? (
        <div className="am-empty">
          No misconceptions synthesized yet. Collect signals, then run mining.
        </div>
      ) : (
        <div className="am-table-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Primary tag</th>
                <th>Related</th>
                <th>Signals</th>
                <th>Learners</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {misconceptions.map((m) => (
                <tr key={m.id}>
                  <td className="am-name">
                    <div className="am-name-line">{m.name}</div>
                    <div className="am-desc">{m.description}</div>
                    {Array.isArray(m.symptoms) && m.symptoms.length > 0 && (
                      <ul className="am-symptoms">
                        {m.symptoms.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="am-tag">{m.tag}</td>
                  <td className="am-related">
                    {(m.relatedTags || []).join(", ") || "—"}
                  </td>
                  <td>{m.signalCount ?? 0}</td>
                  <td>{m.learnerCount ?? 0}</td>
                  <td>{formatDate(m.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="am-section-title">Recent signals</h3>
      {signals.length === 0 ? (
        <div className="am-empty">No signals captured yet.</div>
      ) : (
        <div className="am-table-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Tags</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {signals.slice(0, 50).map((s) => (
                <tr key={s.id}>
                  <td className="am-source">{s.source || "—"}</td>
                  <td className="am-related">
                    {(s.skillTags || []).join(", ") || "—"}
                  </td>
                  <td className="am-detail">
                    {s.source === "quiz_wrong"
                      ? `picked "${s.pickedOptionText || "?"}" · correct "${s.correctOptionText || "?"}"`
                      : s.comment || "(no comment)"}
                  </td>
                  <td>{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
