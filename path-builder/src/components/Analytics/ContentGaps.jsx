/**
 * ContentGaps — Admin dashboard showing AI content gap trends.
 *
 * Aggregates data from:
 * - stepFeedback collection (👎 feedback from PathStep)
 * - analytics_events where event === "ai_step_feedback" (negative)
 * - analytics_events where event === "ai_coverage_report"
 *
 * Shows:
 * 1. Total flagged steps count (negative feedback)
 * 2. Table of most-disputed steps ranked by 👎 count
 * 3. Coverage gap trends (queries where corpus had low coverage)
 */

import { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { getFirebaseApp } from "../../services/firebaseConfig";
import { devWarn } from "../../utils/logger";

export default function ContentGaps() {
  const [flaggedSteps, setFlaggedSteps] = useState([]);
  const [coverageGaps, setCoverageGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFlagged: 0, totalCoverageGaps: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        const db = getFirestore(getFirebaseApp());

        // 1. Fetch negative step feedback
        const feedbackRef = collection(db, "stepFeedback");
        const feedbackQuery = query(
          feedbackRef,
          where("sentiment", "==", "negative"),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const feedbackSnap = await getDocs(feedbackQuery);
        const feedbackDocs = feedbackSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Aggregate by step title
        const stepCounts = {};
        for (const doc of feedbackDocs) {
          const title = doc.stepTitle || doc.step_title || "(unknown)";
          if (!stepCounts[title]) {
            stepCounts[title] = {
              title,
              category: doc.category || "unknown",
              query: doc.query || doc.query_preview || "",
              count: 0,
            };
          }
          stepCounts[title].count++;
        }
        const ranked = Object.values(stepCounts).sort((a, b) => b.count - a.count);
        setFlaggedSteps(ranked);

        // 2. Fetch AI coverage reports (low coverage queries)
        const analyticsRef = collection(db, "analytics_events");
        const coverageQuery = query(
          analyticsRef,
          where("event", "==", "ai_coverage_report"),
          where("low_corpus_coverage", "==", true),
          orderBy("timestamp", "desc"),
          limit(30)
        );
        const coverageSnap = await getDocs(coverageQuery);
        const coverageDocs = coverageSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCoverageGaps(coverageDocs);

        setStats({
          totalFlagged: feedbackDocs.length,
          totalCoverageGaps: coverageDocs.length,
        });
      } catch (err) {
        devWarn("[ContentGaps] Failed to load data:", err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="content-gaps" style={{ padding: 24 }}>
        <h2>📊 Content Gaps Dashboard</h2>
        <p style={{ color: "#94a3b8" }}>Loading analytics data…</p>
      </div>
    );
  }

  return (
    <div className="content-gaps" style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ color: "#e2e8f0", marginBottom: 24 }}>📊 Content Gaps Dashboard</h2>

      {/* Metric Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <div
          style={{
            flex: 1,
            background: "#25282b",
            borderRadius: 10,
            padding: "20px 24px",
            border: "1px solid #30363d",
          }}
        >
          <div style={{ color: "#f87171", fontSize: "2rem", fontWeight: 700 }}>
            {stats.totalFlagged}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>
            👎 Flagged Steps
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: "#25282b",
            borderRadius: 10,
            padding: "20px 24px",
            border: "1px solid #30363d",
          }}
        >
          <div style={{ color: "#fbbf24", fontSize: "2rem", fontWeight: 700 }}>
            {stats.totalCoverageGaps}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>
            ⚠️ Low Coverage Queries
          </div>
        </div>
      </div>

      {/* Flagged Steps Table */}
      <h3 style={{ color: "#e2e8f0", marginBottom: 12 }}>Most Disputed Steps</h3>
      {flaggedSteps.length === 0 ? (
        <p style={{ color: "#64748b", fontStyle: "italic" }}>
          No negative feedback received yet. 🎉
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
            marginBottom: 32,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d", color: "#94a3b8" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Step Title</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Category</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Query Context</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>👎 Count</th>
            </tr>
          </thead>
          <tbody>
            {flaggedSteps.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2023", color: "#cbd5e1" }}>
                <td style={{ padding: "10px 12px" }}>{row.title}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.72rem",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      background: "rgba(255,255,255,0.05)",
                      color: "#94a3b8",
                    }}
                  >
                    {row.category}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.query}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#f87171",
                  }}
                >
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Coverage Gap Trends */}
      <h3 style={{ color: "#e2e8f0", marginBottom: 12 }}>Low Coverage Queries</h3>
      {coverageGaps.length === 0 ? (
        <p style={{ color: "#64748b", fontStyle: "italic" }}>
          No coverage gap events recorded yet.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d", color: "#94a3b8" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Query</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Level</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>AI Steps</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>Corpus Steps</th>
            </tr>
          </thead>
          <tbody>
            {coverageGaps.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2023", color: "#cbd5e1" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    maxWidth: 250,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.query_preview || "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>{row.learner_level || "—"}</td>
                <td
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "#fbbf24",
                    fontWeight: 600,
                  }}
                >
                  {row.ai_generated_steps ?? 0}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    color: "#4ade80",
                    fontWeight: 600,
                  }}
                >
                  {row.corpus_steps ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
