/**
 * PathIntelligencePanel v3 — Tabbed intelligence sidebar
 *
 * Tabs: Coverage | Gaps | Quiz | Export
 * Only ONE tab visible at a time. Clean and focused.
 * Setup gate shown when Primary Goal is missing.
 */

import { useState, useCallback, useMemo } from "react";
import { usePath } from "../../context/PathContext";
import { analyzePathGaps, generateGapFillStep } from "../../services/pathGapAnalyzer";
import { generateQuizForPath } from "../../services/quizService";
import PathWizard from "../BespokePath/PathWizard";
import "./PathIntelligencePanel.css";

// ── Coverage Gauge ─────────────────────────────────────────
function CoverageGauge({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(Math.max(0, Math.min(100, score * 100)));
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : pct >= 1 ? "#f85149" : "#484f58";

  return (
    <div className="ip-gauge">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} className="ip-gauge-bg" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className="ip-gauge-fill"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ip-gauge-label" style={{ color }}>
        <span className="ip-gauge-pct">{pct}%</span>
        <span className="ip-gauge-sub">coverage</span>
      </div>
    </div>
  );
}

// ── Tab definitions ──
const TABS = [
  { id: "coverage", icon: "📊", label: "Coverage" },
  { id: "gaps", icon: "⚠", label: "Gaps" },
  { id: "quiz", icon: "📝", label: "Quiz" },
  { id: "export", icon: "📦", label: "Export" },
];

// ── Main ───────────────────────────────────────────────────
export default function PathIntelligencePanel() {
  const { courses, learningIntent, pathStats } = usePath();

  const [activeTab, setActiveTab] = useState("coverage");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [fillingGap, setFillingGap] = useState(null);
  const [fillResults, setFillResults] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  const hasCourses = courses.length > 0;
  const hasGoal = !!learningIntent?.primaryGoal?.trim();
  const hasLevel = !!learningIntent?.skillLevel;
  const hasBudget = !!learningIntent?.timeBudget;
  const setupComplete = hasGoal && hasLevel && hasBudget;
  const isReady = hasCourses && setupComplete;

  const pathResult = useMemo(() => {
    if (!isReady) return null;
    return {
      query: learningIntent.primaryGoal,
      path: courses.map((c, i) => ({
        category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
        title: c.title || `Step ${i + 1}`,
        segment: {
          title: c.title || `Step ${i + 1}`,
          text: c.description || c.why || "",
          source: c.instructor || c.platform || "",
          type: c.type || "video",
        },
      })),
      bridges: [],
      gaps: analysis,
    };
  }, [isReady, courses, learningIntent, analysis]);

  // ── Analyze ──
  const handleAnalyze = useCallback(async () => {
    if (!isReady || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const steps = courses.map((c) => ({
        category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
        segment: { title: c.title || "Untitled", text: c.description || c.why || "" },
      }));
      const result = await analyzePathGaps(learningIntent.primaryGoal, steps);
      setAnalysis(result);
    } catch (err) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [isReady, analyzing, courses, learningIntent]);

  // ── Fill Gap ──
  const handleFillGap = useCallback(
    async (topic) => {
      if (fillingGap) return;
      setFillingGap(topic);
      try {
        const steps = courses.map((c) => ({
          category: "core",
          segment: { title: c.title || "", text: c.description || "" },
        }));
        const result = await generateGapFillStep(topic, learningIntent.primaryGoal, steps);
        setFillResults((prev) => ({ ...prev, [topic]: result }));
      } catch {
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
      } finally {
        setFillingGap(null);
      }
    },
    [fillingGap, courses, learningIntent]
  );

  // ── Quiz ──
  const handleGenerateQuiz = useCallback(async () => {
    if (!pathResult || generatingQuiz) return;
    setGeneratingQuiz(true);
    try {
      const questions = await generateQuizForPath(pathResult.path, learningIntent.primaryGoal, 2);
      setQuiz(questions);
    } catch {
      setQuiz([]);
    } finally {
      setGeneratingQuiz(false);
    }
  }, [pathResult, generatingQuiz, learningIntent]);

  // Derived
  const blindSpots = analysis?.blindSpots || [];
  const suggestions = analysis?.suggestions || [];
  const assumedKnowledge = analysis?.assumedKnowledge || [];
  const coverageScore = analysis?.coverageScore ?? 0;
  const corpusStats = analysis?.corpusStats || {};
  const gapCount = blindSpots.length;

  // ── RENDER ──
  return (
    <div className="ip-panel">
      {/* Header */}
      <div className="ip-header">
        <span className="ip-logo">🧠</span>
        <h3>Path Intelligence</h3>
      </div>

      {/* Gate: setup checklist */}
      {!setupComplete ? (
        <div className="ip-gate">
          <div className="ip-gate-icon">🎯</div>
          <h4>Define Your Path</h4>
          <p>Complete the setup above to unlock intelligence:</p>
          <ul className="ip-checklist">
            <li className={hasGoal ? "done" : ""}>{hasGoal ? "✅" : "⬜"} Primary Goal</li>
            <li className={hasLevel ? "done" : ""}>{hasLevel ? "✅" : "⬜"} Skill Level</li>
            <li className={hasBudget ? "done" : ""}>{hasBudget ? "✅" : "⬜"} Time Budget</li>
          </ul>
        </div>
      ) : !hasCourses ? (
        <div className="ip-gate">
          <div className="ip-gate-icon">📚</div>
          <h4>Add Courses</h4>
          <p>Drag courses from the left panel to build your path.</p>
        </div>
      ) : (
        <>
          {/* Tab Bar */}
          <div className="ip-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`ip-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="ip-tab-icon">{tab.icon}</span>
                <span className="ip-tab-label">{tab.label}</span>
                {tab.id === "gaps" && gapCount > 0 && (
                  <span className="ip-tab-badge">{gapCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="ip-content">
            {/* ════ COVERAGE TAB ════ */}
            {activeTab === "coverage" && (
              <div className="ip-tab-pane">
                <CoverageGauge score={coverageScore} />

                <div className="ip-stats">
                  <div className="ip-stat">
                    <span>Courses</span>
                    <strong>{pathStats.courseCount}</strong>
                  </div>
                  <div className="ip-stat">
                    <span>Est. Time</span>
                    <strong>{pathStats.estimatedHours}h</strong>
                  </div>
                  {pathStats.levelRange && (
                    <div className="ip-stat">
                      <span>Levels</span>
                      <strong>{pathStats.levelRange}</strong>
                    </div>
                  )}
                  {analysis && (
                    <div className="ip-stat">
                      <span>Topics Covered</span>
                      <strong>
                        {corpusStats.subtopicsCovered || 0} / {corpusStats.subtopicsChecked || 0}
                      </strong>
                    </div>
                  )}
                </div>

                <button className="ip-btn primary" onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? (
                    <>
                      <span className="ip-spinner" /> Analyzing…
                    </>
                  ) : analysis ? (
                    "🔄 Re-Analyze"
                  ) : (
                    "🔍 Analyze Path"
                  )}
                </button>

                {error && <p className="ip-error">❌ {error}</p>}

                {/* Coverage Explanation */}
                {analysis && (
                  <div
                    className={`ip-explain ${coverageScore >= 0.8 ? "good" : coverageScore >= 0.5 ? "warn" : "low"}`}
                  >
                    {coverageScore >= 0.8 ? (
                      <p>
                        <strong>✅ Great!</strong> Your path covers{" "}
                        {Math.round(coverageScore * 100)}% of key subtopics.
                      </p>
                    ) : coverageScore >= 0.5 ? (
                      <p>
                        <strong>⚠️ Partial</strong> — {Math.round(coverageScore * 100)}% covered.
                        Check the <strong>Gaps</strong> tab to see what&apos;s missing.
                      </p>
                    ) : (
                      <p>
                        <strong>🔴 Low</strong> — Only {Math.round(coverageScore * 100)}% covered.
                        Check the <strong>Gaps</strong> tab for blind spots and suggestions.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ════ GAPS TAB ════ */}
            {activeTab === "gaps" && (
              <div className="ip-tab-pane">
                {!analysis ? (
                  <div className="ip-empty">
                    <p>
                      Run analysis on the <strong>Coverage</strong> tab first to see gaps.
                    </p>
                  </div>
                ) : gapCount === 0 && suggestions.length === 0 ? (
                  <div className="ip-empty">
                    <span className="ip-empty-icon">🎉</span>
                    <p>No gaps detected! Your path looks solid.</p>
                  </div>
                ) : (
                  <>
                    {/* Blind Spots */}
                    {blindSpots.map((spot, i) => {
                      const topic = typeof spot === "string" ? spot : spot.topic;
                      const severity = spot.severity || "medium";
                      const reason = spot.reason || "";
                      const filled = fillResults[topic];
                      return (
                        <div key={i} className={`ip-gap-card ip-sev-${severity}`}>
                          <div className="ip-gap-header">
                            <span className={`ip-sev-dot ${severity}`} />
                            <strong>{topic}</strong>
                          </div>
                          {reason && <p className="ip-gap-reason">{reason}</p>}
                          {filled ? (
                            filled.error ? (
                              <p className="ip-gap-status error">Could not generate fill</p>
                            ) : (
                              <p className="ip-gap-status success">
                                ✅ {filled.segment?.title || filled.title || "Fill generated"}
                              </p>
                            )
                          ) : (
                            <button
                              className="ip-btn small"
                              onClick={() => handleFillGap(topic)}
                              disabled={!!fillingGap}
                            >
                              {fillingGap === topic ? "Generating…" : "📄 Suggest Fill"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="ip-suggestions">
                        <h4>💡 Suggestions</h4>
                        {suggestions.map((s, i) => (
                          <div key={i} className="ip-suggestion">
                            <strong>{s.topic || s}</strong>
                            {s.rationale && <p>{s.rationale}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assumed Knowledge */}
                    {assumedKnowledge.length > 0 && (
                      <div className="ip-assumed">
                        <h4>🎓 Assumed Knowledge</h4>
                        <p>Your path assumes learners already know:</p>
                        <div className="ip-chip-row">
                          {assumedKnowledge.map((ak, i) => (
                            <span key={i} className="ip-chip">
                              {ak}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════ QUIZ TAB ════ */}
            {activeTab === "quiz" && (
              <div className="ip-tab-pane">
                <p className="ip-tab-desc">
                  Generate knowledge-check questions from your path content.
                </p>
                <button
                  className="ip-btn primary"
                  onClick={handleGenerateQuiz}
                  disabled={generatingQuiz}
                >
                  {generatingQuiz ? (
                    <>
                      <span className="ip-spinner" /> Generating…
                    </>
                  ) : quiz ? (
                    `✅ ${quiz.length} Questions Ready`
                  ) : (
                    "📝 Generate Quiz"
                  )}
                </button>

                {quiz && quiz.length > 0 && (
                  <div className="ip-quiz-list">
                    {quiz.map((q, i) => (
                      <div key={i} className="ip-quiz-card">
                        <p className="ip-quiz-q">
                          <strong>Q{i + 1}:</strong> {q.question}
                        </p>
                        {q.options && (
                          <ul className="ip-quiz-opts">
                            {q.options.map((opt, j) => (
                              <li key={j} className={opt === q.answer ? "correct" : ""}>
                                {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {quiz && quiz.length === 0 && (
                  <p className="ip-error">Could not generate quiz questions. Try again.</p>
                )}
              </div>
            )}

            {/* ════ EXPORT TAB ════ */}
            {activeTab === "export" && (
              <div className="ip-tab-pane">
                {pathResult ? (
                  <PathWizard pathResult={pathResult} quiz={quiz} />
                ) : (
                  <div className="ip-empty">
                    <p>Add courses and set a goal to enable export.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
