/**
 * AnalyticsCosts — AI Generation Costs dashboard
 * Focused sub-page for cost tracking.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getTokenStats,
  fetchCloudStats,
  estimateCost,
  fetchFirestoreUsage,
} from "../../services/tokenTracker";
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

export default function AnalyticsCosts({ timeRange = "7d" }) {
  const [tokenStats, setTokenStats] = useState(null);
  const [cloudCostHistory, setCloudCostHistory] = useState([]);
  const [firestoreUsage, setFirestoreUsage] = useState(null);
  const [costLoading, setCostLoading] = useState(false);

  const loadCosts = useCallback(async () => {
    setTokenStats(getTokenStats());
    setCostLoading(true);
    try {
      const daysToFetch = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
      const [cloudData, fsUsage] = await Promise.all([
        fetchCloudStats(daysToFetch),
        fetchFirestoreUsage(daysToFetch),
      ]);
      setCloudCostHistory(cloudData);
      setFirestoreUsage(fsUsage);
    } catch (e) {
      console.warn("[AnalyticsCosts] Cloud stats failed:", e.message);
    } finally {
      setCostLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  if (!tokenStats) return null;

  return (
    <div className="admin-analytics">
      <div className="aa-header">
        <div>
          <h2>
            💰 AI Generation Costs{" "}
            <Tip text="Token usage and estimated costs for all AI operations" />
          </h2>
        </div>
      </div>

      {/* Cost stat cards */}
      <div className="aa-stats-row" style={{ marginBottom: 16 }}>
        <StatCard
          label="Today's Cost"
          value={tokenStats.today.costFormatted}
          icon="💵"
          color="#10b981"
          tooltip="Estimated cost for all AI API calls made today"
        />
        <StatCard
          label="Lifetime Cost"
          value={tokenStats.lifetime.costFormatted}
          icon="📊"
          color="#6366f1"
          tooltip="Total estimated cost since tracking began"
        />
        <StatCard
          label="API Calls Today"
          value={tokenStats.today.calls}
          icon="🔄"
          color="#06b6d4"
          tooltip="Number of Gemini API calls made today"
        />
        <StatCard
          label="Budget Used"
          value={`${tokenStats.today.budgetPercent.toFixed(1)}%`}
          icon={tokenStats.today.budgetPercent > 80 ? "⚠️" : "🛡️"}
          color={tokenStats.today.budgetPercent > 80 ? "#ef4444" : "#f59e0b"}
          tooltip={`$${tokenStats.today.budgetRemaining.toFixed(4)} remaining of $10/day budget`}
        />
      </div>

      {/* Per-operation breakdown */}
      {tokenStats.today.operations && Object.keys(tokenStats.today.operations).length > 0 && (
        <div className="aa-section" style={{ marginBottom: 24 }}>
          <h3>Per-Operation Breakdown (Today)</h3>
          <div className="aa-bar-chart">
            {Object.entries(tokenStats.today.operations)
              .sort(([, a], [, b]) => b.input + b.output - (a.input + a.output))
              .map(([op, data]) => {
                const cost = estimateCost(data.input, data.output);
                const maxTokens = Math.max(
                  ...Object.values(tokenStats.today.operations).map((d) => d.input + d.output),
                  1
                );
                const pct = Math.round(((data.input + data.output) / maxTokens) * 100);
                return (
                  <div key={op} className="aa-bar-row">
                    <span className="aa-bar-label" style={{ width: 120 }}>
                      {op}
                    </span>
                    <div className="aa-bar-track">
                      <div
                        className="aa-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: "#10b981" }}
                      />
                    </div>
                    <span className="aa-bar-value" style={{ width: 60 }}>
                      ${cost.toFixed(4)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Firestore R/W Usage */}
      {firestoreUsage && (
        <div className="aa-section" style={{ marginBottom: 24 }}>
          <h3>🗄️ Firestore Read/Write Usage</h3>
          <div className="aa-stats-row" style={{ marginBottom: 12 }}>
            <StatCard
              label="Total Reads"
              value={firestoreUsage.totalReads.toLocaleString()}
              icon="📖"
              color="#3b82f6"
              tooltip="Firestore document reads from Cloud Functions (rate limiting, vector search, cache)"
            />
            <StatCard
              label="Total Writes"
              value={firestoreUsage.totalWrites.toLocaleString()}
              icon="✏️"
              color="#f59e0b"
              tooltip="Firestore document writes from Cloud Functions (apiUsage logging, cache)"
            />
            <StatCard
              label="Firestore Cost"
              value={firestoreUsage.costFormatted}
              icon="💾"
              color="#8b5cf6"
              tooltip="Estimated cost: reads × $0.06/100K + writes × $0.18/100K"
            />
            <StatCard
              label="Combined Total"
              value={`$${(tokenStats.today.cost + firestoreUsage.estimatedCost).toFixed(4)}`}
              icon="💰"
              color="#10b981"
              tooltip="AI token cost + Firestore R/W cost combined"
            />
          </div>
          {Object.keys(firestoreUsage.byFunction).length > 0 && (
            <div className="aa-bar-chart">
              {Object.entries(firestoreUsage.byFunction)
                .sort(([, a], [, b]) => b.reads + b.writes - (a.reads + a.writes))
                .slice(0, 10)
                .map(([fn, data]) => {
                  const ops = data.reads + data.writes;
                  const maxOps = Math.max(
                    ...Object.values(firestoreUsage.byFunction).map((d) => d.reads + d.writes),
                    1
                  );
                  const pct = Math.round((ops / maxOps) * 100);
                  return (
                    <div key={fn} className="aa-bar-row">
                      <span className="aa-bar-label" style={{ width: 140 }}>
                        {fn}
                      </span>
                      <div className="aa-bar-track">
                        <div
                          className="aa-bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: "#8b5cf6" }}
                        />
                      </div>
                      <span className="aa-bar-value" style={{ width: 80, fontSize: "0.7rem" }}>
                        {data.reads}R / {data.writes}W
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
          <p style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 8 }}>
            Based on {firestoreUsage.docsScanned} recent apiUsage records • Free tier: 50K reads +
            20K writes/day
          </p>
        </div>
      )}

      {/* Cloud cost history */}
      {costLoading ? (
        <p style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
          Loading cloud cost history…
        </p>
      ) : (
        cloudCostHistory.length > 0 && (
          <div className="aa-section">
            <h3>Daily Cost Trend (Cloud)</h3>
            <div className="aa-daily-chart">
              {[...cloudCostHistory].reverse().map((day) => {
                const maxCost = Math.max(
                  ...cloudCostHistory.map((d) => d.estimatedCost || 0),
                  0.001
                );
                const pct = Math.round(((day.estimatedCost || 0) / maxCost) * 100);
                return (
                  <div
                    key={day.date}
                    className="aa-day-bar"
                    title={`${day.date}: $${(day.estimatedCost || 0).toFixed(4)} (${day.calls || 0} calls)`}
                  >
                    <div
                      className="aa-day-fill"
                      style={{
                        height: `${pct}%`,
                        background: "linear-gradient(180deg, #10b981, #059669)",
                      }}
                    />
                    <span className="aa-day-label">{(day.date || "").substring(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
