import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { PathProvider, usePath } from "./context/PathContext";
import { TagDataProvider } from "./context/TagDataContext";
import Dashboard from "./components/Dashboard/Dashboard";
import AuthGate from "./components/AuthGate/AuthGate";
import LoadingSpinner from "./components/LoadingSpinner/LoadingSpinner";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirebaseApp } from "./services/firebaseConfig";
import { IS_E2E } from "./services/e2eBypass";
import useIsMobile from "./hooks/useIsMobile";
import { useAuth } from "./hooks/useAuth";
import useAnalyticsData from "./hooks/useAnalyticsData";
import MobileNavDrawer from "./components/MobileNav/MobileNavDrawer";
import AppSidebar from "./components/AppSidebar/AppSidebar";
import { fetchJSON } from "./services/dataLoader";
import { precomputeTagsAndEdges } from "./utils/tagEdgePrecompute";
import { BASE_TABS, MOBILE_TAB_ORDER } from "./domain/tabDefinitions";
import "./App.css";

// ── Lazy-loaded tab components (code-split per tab) ──────────────────
const LeftPanel = lazy(() => import("./components/LeftPanel/LeftPanel"));
const AssemblyLine = lazy(() => import("./components/AssemblyLine/AssemblyLine"));
const PathIntelligencePanel = lazy(() => import("./components/PathBuilder/PathIntelligencePanel"));
const PathDashboard = lazy(() => import("./components/PathBuilder/PathDashboard"));
const PathCreationWizard = lazy(() => import("./components/PathBuilder/PathCreationWizard"));
const PathLoader = lazy(() => import("./components/PathBuilder/PathLoader"));
const WorkflowStepper = lazy(() => import("./components/PathBuilder/WorkflowStepper"));
const TagGraph = lazy(() => import("./components/TagGraph/TagGraph"));
const PathReadiness = lazy(() => import("./components/PathReadiness/PathReadiness"));
const TagManager = lazy(() => import("./components/TagManager/TagManager"));
const Personas = lazy(() => import("./components/Personas/Personas"));
const ProblemFirst = lazy(() =>
  import("./components/ProblemFirst").then((m) => ({ default: m.ProblemFirst }))
);
const BespokePath = lazy(() => import("./components/BespokePath/BespokePath"));
const AdaptivePath = lazy(() => import("./components/AdaptivePath/AdaptivePath"));
const AdminFeedback = lazy(() => import("./components/AdminFeedback/AdminFeedback"));
const AdminErrorLogs = lazy(() => import("./components/AdminErrorLogs/AdminErrorLogs"));
const InsightsPanel = lazy(() => import("./components/Visualizations/InsightsPanel"));
const FeedbackButton = lazy(() => import("./components/Feedback/FeedbackButton"));
const PersonaQuiz = lazy(() => import("./components/PersonaQuiz/PersonaQuiz"));

// Analytics visualizations — import directly (not via barrel) for proper code-splitting
const JourneyHeatmap = lazy(() => import("./components/Visualizations/JourneyHeatmap"));
const TagTimeline = lazy(() => import("./components/Visualizations/TagTimeline"));
const TagTrends = lazy(() => import("./components/Visualizations/TagTrends"));
const PrereqFlow = lazy(() => import("./components/Visualizations/PrereqFlow"));
const InstructorMap = lazy(() => import("./components/Visualizations/InstructorMap"));
const TagHeatmap = lazy(() => import("./components/Visualizations/TagHeatmap"));
const SkillRadar = lazy(() => import("./components/Visualizations/SkillRadar"));
const SkillGapAnalysis = lazy(() => import("./components/Visualizations/SkillGapAnalysis"));
const ConfidenceAnalytics = lazy(() => import("./components/Visualizations/ConfidenceAnalytics"));
const TagHistorySparkline = lazy(() => import("./components/Visualizations/TagHistorySparkline"));
const InviteManager = lazy(() => import("./components/InviteManager/InviteManager"));
const AdminAnalytics = lazy(() => import("./components/AdminAnalytics/AdminAnalytics"));
const ContentGaps = lazy(() => import("./components/AdminAnalytics/ContentGaps"));
const AnalyticsPipeline = lazy(() => import("./components/AdminAnalytics/AnalyticsPipeline"));
const AnalyticsCosts = lazy(() => import("./components/AdminAnalytics/AnalyticsCosts"));

// ── Builder Editor with Workflow Stepper ──────────────────────────────
function BuilderEditor({
  courses,
  isMobile,
  preSelectedSkill,
  setPreSelectedSkill,
  onBackToDashboard,
}) {
  const { workflowStage } = usePath();

  // Left panel: always visible on desktop
  const showLeftPanel = !isMobile;
  // Right panel: only mount during review/export (saves 68KB component on build stage)
  const showRightPanel = !isMobile && (workflowStage === "review" || workflowStage === "export");

  return (
    <div className="builder-editor-container">
      <WorkflowStepper />
      <div className={`builder-layout ${isMobile ? "builder-mobile" : ""} workflow-stage-${workflowStage}`}>
        {/* Left: Course Library — visible during Curate */}
        {showLeftPanel && (
          <aside className="library-panel">
            <LeftPanel
              courses={courses}
              preSelectedSkill={preSelectedSkill}
              onSkillUsed={() => setPreSelectedSkill(null)}
              onBackToDashboard={onBackToDashboard}
            />
          </aside>
        )}

        {/* Center: Path Canvas — always visible */}
        <section className="assembly-panel">
          <AssemblyLine />
        </section>

        {/* Right: Intelligence Panel — visible during Arrange/Review/Export */}
        {showRightPanel && (
          <aside className="output-panel-area">
            <PathIntelligencePanel />
          </aside>
        )}
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("adaptive");
  const [preSelectedSkill, setPreSelectedSkill] = useState(null);
  const { currentUser, userIsAdmin } = useAuth();
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [showQuiz, setShowQuiz] = useState(() => !localStorage.getItem("ue5_persona_id"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  // Path Builder dashboard vs editor view
  const [builderView, setBuilderView] = useState("dashboard"); // "dashboard" | "editor"
  const [showWizard, setShowWizard] = useState(false);
  const [pendingEditPath, setPendingEditPath] = useState(null);
  const { isMobile } = useIsMobile();

  // Analytics state (extracted hook)
  const { analyticsEvents, setAnalyticsEvents, analyticsTimeRange, setAnalyticsTimeRange } =
    useAnalyticsData(activeTab, userIsAdmin);

  // Build ordered tab list (mobile reorders, admin tabs appended)
  const tabs = useMemo(() => {
    const adminTabs = userIsAdmin
      ? [
          { key: "invites", label: "Invites", icon: "🎟️", adminOnly: true },
          { key: "admin-feedback", label: "Feedback", icon: "📋", adminOnly: true },
          { key: "admin-errors", label: "Error Logs", icon: "🚨", adminOnly: true },
        ]
      : [];
    const allTabs = [...BASE_TABS, ...adminTabs];
    if (!isMobile) return allTabs;
    // Reorder for mobile
    const ordered = [];
    for (const key of MOBILE_TAB_ORDER) {
      const tab = allTabs.find((t) => t.key === key);
      if (tab) ordered.push(tab);
    }
    // Append any remaining (admin tabs)
    for (const tab of allTabs) {
      if (!ordered.includes(tab)) ordered.push(tab);
    }
    return ordered;
  }, [isMobile, userIsAdmin]);

  // Listen for new feedback count (admin only)
  useEffect(() => {
    if (IS_E2E || !userIsAdmin) return;
    const db = getFirestore(getFirebaseApp());
    const q = query(collection(db, "feedback"), where("status", "==", "new"));
    const unsub = onSnapshot(
      q,
      (snap) => setNewFeedbackCount(snap.size),
      (err) => {
        console.warn("[App] feedback listener error:", err.message);
      }
    );
    return unsub;
  }, [userIsAdmin]);

  // Handle navigation from insights panel
  const handleInsightNavigate = (tab, skillName) => {
    setActiveTab(tab);
    if (skillName) {
      setPreSelectedSkill(skillName);
    }
  };

  // Lazy-load video library (3.8 MB) — splits into separate chunk
  const [videoLibrary, setVideoLibrary] = useState({ courses: [], generated_at: null });
  useEffect(() => {
    fetchJSON("video_library_enriched").then((data) => {
      if (data) setVideoLibrary(data);
    });
  }, []);

  // Process course data - deduplicate by code
  const courses = useMemo(() => {
    const raw = videoLibrary.courses || [];
    const seen = new Set();
    return raw.filter((c) => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      const title = (c.title || "").toLowerCase();
      if (title === "introduction" || title === "intro" || title === "outro") return false;
      return true;
    });
  }, [videoLibrary]);

  // Process tag data — extracted to tagEdgePrecompute.js for performance
  const { tags, edges } = useMemo(() => precomputeTagsAndEdges(courses), [courses]);

  return (
    <AuthGate>
      <PathProvider>
        <TagDataProvider
          tags={tags}
          edges={edges}
          courses={courses}
          lastUpdated={videoLibrary.generated_at}
        >
          <div className="app">
            {/* Skip to content link for keyboard/screen reader users */}
            <a href="#main-content" className="skip-to-content">
              Skip to main content
            </a>
            {isMobile ? (
              /* ── Mobile: hamburger + active tab name ── */
              <header className="app-header mobile-header">
                <button
                  className="hamburger-btn"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open menu"
                >
                  ☰
                </button>
                <span className="mobile-active-tab">
                  {tabs.find((t) => t.key === activeTab)?.icon}{" "}
                  {tabs.find((t) => t.key === activeTab)?.label}
                </span>
                <div className="header-right mobile-header-right">
                  {currentUser?.photoURL && (
                    <img
                      src={currentUser.photoURL}
                      alt=""
                      className="header-avatar"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </header>
            ) : (
              /* ── Desktop: left sidebar (extracted) ── */
              <AppSidebar
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                analyticsExpanded={analyticsExpanded}
                setAnalyticsExpanded={setAnalyticsExpanded}
                newFeedbackCount={newFeedbackCount}
                currentUser={currentUser}
                onRetakeQuiz={() => {
                  localStorage.removeItem("ue5_persona_id");
                  setShowQuiz(true);
                }}
              />
            )}

            {/* Mobile Nav Drawer */}
            {isMobile && (
              <MobileNavDrawer
                tabs={tabs}
                activeTab={activeTab}
                onSelect={setActiveTab}
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
              />
            )}

            {/* Main Content */}
            <main className="app-main" id="main-content" tabIndex="-1">
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === "dashboard" && (
                  <div className="dashboard-layout">
                    <Dashboard />
                  </div>
                )}
                {activeTab === "readiness" && (
                  <div className="dashboard-layout">
                    <PathReadiness />
                  </div>
                )}
                {activeTab === "tags" && (
                  <div className="dashboard-layout">
                    <TagManager />
                  </div>
                )}
                {activeTab === "builder" && builderView === "dashboard" && (
                  <div className="dashboard-layout">
                    <PathDashboard
                      onEditPath={(path) => {
                        setPendingEditPath(path);
                        setBuilderView("editor");
                      }}
                      onCreateNew={() => setShowWizard(true)}
                    />
                  </div>
                )}
                {activeTab === "builder" && builderView === "editor" && (
                  <BuilderEditor
                    courses={courses}
                    isMobile={isMobile}
                    preSelectedSkill={preSelectedSkill}
                    setPreSelectedSkill={setPreSelectedSkill}
                    onBackToDashboard={() => setBuilderView("dashboard")}
                  />
                )}
                {/* PathLoader: bridges saved path data into PathContext */}
                {pendingEditPath && (
                  <PathLoader
                    pendingPath={pendingEditPath}
                    onLoaded={() => setPendingEditPath(null)}
                  />
                )}
                {/* Path Creation Wizard Modal */}
                {showWizard && (
                  <PathCreationWizard
                    onComplete={(pathData) => {
                      setShowWizard(false);
                      
                      // Save to storage
                      import("./utils/pathStorageUtils").then(
                        ({ savePathToStorage }) => {
                          savePathToStorage(pathData);
                        }
                      );
                      // Store wizard intent so PathIntelligencePanel can read it
                      localStorage.setItem(
                        "ue5_wizard_intent",
                        JSON.stringify({
                          primaryGoal: pathData.goal,
                          skillLevel: pathData.skillLevel,
                          timeBudget: pathData.timeBudget,
                          industries: pathData.industries || [],
                        })
                      );
                      // Auto-populate course search with the goal
                      setPreSelectedSkill(pathData.goal);
                      setBuilderView("editor");
                    }}
                    onCancel={() => setShowWizard(false)}
                  />
                )}
                {activeTab === "personas" && (
                  <div className="dashboard-layout">
                    <Personas />
                  </div>
                )}
                {activeTab === "problem" && (
                  <div className="dashboard-layout">
                    <ProblemFirst />
                  </div>
                )}
                {activeTab === "adaptive" && (
                  <div className="dashboard-layout">
                    <AdaptivePath />
                  </div>
                )}
                {activeTab === "bespoke" && (
                  <div className="dashboard-layout">
                    <BespokePath />
                  </div>
                )}
                {activeTab === "analytics-overview" && (
                  <div className="analytics-layout">
                    <div className="analytics-grid">
                      {userIsAdmin && (
                        <AdminAnalytics
                          onEventsLoaded={setAnalyticsEvents}
                          onTimeRangeChange={setAnalyticsTimeRange}
                        />
                      )}
                      <JourneyHeatmap />
                    </div>
                  </div>
                )}
                {activeTab === "analytics-insights" && (
                  <div className="analytics-layout">
                    <InsightsPanel onNavigate={handleInsightNavigate} />
                  </div>
                )}
                {activeTab === "analytics-confidence" && (
                  <div className="analytics-layout">
                    <ConfidenceAnalytics />
                  </div>
                )}
                {activeTab === "analytics-coverage" && (
                  <div className="analytics-layout">
                    <div className="coverage-grid">
                      <SkillRadar />
                      <SkillGapAnalysis />
                    </div>
                  </div>
                )}
                {activeTab === "analytics-library" && (
                  <div className="analytics-layout">
                    <TagTrends />
                    <TagHistorySparkline />
                    <TagHeatmap />
                    <TagTimeline />
                    <InstructorMap />
                  </div>
                )}
                {activeTab === "analytics-paths" && (
                  <div className="analytics-layout">
                    <PrereqFlow />
                  </div>
                )}
                {activeTab === "analytics-graph" && (
                  <div className="analytics-layout">
                    <div className="tag-graph-wrapper">
                      <TagGraph tags={tags} edges={edges} courses={courses} />
                    </div>
                  </div>
                )}
                {activeTab === "analytics-gaps" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <ContentGaps events={analyticsEvents} />
                  </div>
                )}
                {activeTab === "analytics-pipeline" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <AnalyticsPipeline events={analyticsEvents} />
                  </div>
                )}
                {activeTab === "analytics-costs" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <AnalyticsCosts timeRange={analyticsTimeRange} />
                  </div>
                )}
                {activeTab === "augmentation" && (
                  <div className="augmentation-layout">
                    {isMobile && (
                      <div className="mobile-desktop-banner">
                        💻 This tool works best on a desktop browser for the full experience.
                      </div>
                    )}
                    <iframe
                      className="augmentation-frame"
                      src={`${import.meta.env.BASE_URL}augmentation_index.html`}
                      title="Augmentation Dashboard"
                    />
                  </div>
                )}
                {activeTab === "invites" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <InviteManager />
                  </div>
                )}
                {activeTab === "admin-feedback" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <AdminFeedback />
                  </div>
                )}
                {activeTab === "admin-errors" && userIsAdmin && (
                  <div className="dashboard-layout">
                    <AdminErrorLogs />
                  </div>
                )}
              </Suspense>
            </main>

            <FeedbackButton user={currentUser} />

            {/* Persona Quiz Overlay */}
            {showQuiz && (
              <Suspense fallback={<LoadingSpinner />}>
                <PersonaQuiz onComplete={() => setShowQuiz(false)} />
              </Suspense>
            )}
          </div>
        </TagDataProvider>
      </PathProvider>
    </AuthGate>
  );
}

export default App;
