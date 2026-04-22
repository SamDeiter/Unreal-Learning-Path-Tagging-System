import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { PathProvider, usePath } from "./context/PathContext";
import { TagDataProvider } from "./context/TagDataContext";
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
import TabRouter from "./components/TabRouter";
import { fetchJSON } from "./services/dataLoader";
import { precomputeTagsAndEdges } from "./utils/tagEdgePrecompute";
import { BASE_TABS, MOBILE_TAB_ORDER } from "./domain/tabDefinitions";
import "./App.css";

// ── Lazy-loaded components kept in App (used outside TabRouter) ──────
const LeftPanel = lazy(() => import("./components/LeftPanel/LeftPanel"));
const AssemblyLine = lazy(() => import("./components/AssemblyLine/AssemblyLineV2"));
const PathIntelligencePanel = lazy(() => import("./components/PathBuilder/PathIntelligencePanel"));
const WorkflowStepper = lazy(() => import("./components/PathBuilder/WorkflowStepper"));
const FeedbackButton = lazy(() => import("./components/Feedback/FeedbackButton"));
const PersonaQuiz = lazy(() => import("./components/PersonaQuiz/PersonaQuiz"));

// ── Builder Editor with Workflow Stepper ──────────────────────────────
function BuilderEditor({
  courses,
  isMobile,
  preSelectedSkill,
  setPreSelectedSkill,
  onBackToDashboard,
}) {
  const { workflowStage } = usePath();

  // Left panel: visible on desktop during Build/Curate (grid has "library" area in those stages)
  const showLeftPanel = !isMobile && (workflowStage === "build" || workflowStage === "curate");
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

// Legacy hash keys kept working as redirects so old bookmarks/links don't 404.
function normalizeTabHash(hash) {
  if (hash === "problem") return "bespoke";
  return hash;
}

function App() {
  // Deep-link: read initial tab from URL hash
  const [activeTab, setActiveTabRaw] = useState(() => {
    const hash = normalizeTabHash(window.location.hash.slice(1));
    return hash || "adaptive";
  });
  const [preSelectedSkill, setPreSelectedSkill] = useState(null);
  const { currentUser, userIsAdmin } = useAuth();
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [showQuiz, setShowQuiz] = useState(() => !localStorage.getItem("ue5_persona_id"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [buildersExpanded, setBuildersExpanded] = useState(() => {
    const hash = window.location.hash.slice(1);
    return ["builder-v3", "builder-v2", "builder"].includes(hash);
  });
  // Path Builder dashboard vs editor view
  const [builderView, setBuilderView] = useState("dashboard"); // "dashboard" | "editor"
  const [showWizard, setShowWizard] = useState(false);
  const [pendingEditPath, setPendingEditPath] = useState(null);
  const { isMobile } = useIsMobile();

  // Deep-link: wrap setActiveTab to sync hash & auto-expand builders
  const setActiveTab = (tab) => {
    setActiveTabRaw(tab);
    window.location.hash = tab;
    // Auto-expand builders group when a builder tab is selected
    if (["builder-v3", "builder-v2", "builder"].includes(tab)) {
      setBuildersExpanded(true);
    }
    // Auto-expand analytics group when an analytics sub-tab is selected
    if (tab.startsWith("analytics-")) {
      setAnalyticsExpanded(true);
    }
  };

  // Sync React state when hash changes externally (e.g. from Demand Dashboard "Start Brief")
  useEffect(() => {
    const onHashChange = () => {
      const hash = normalizeTabHash(window.location.hash.slice(1));
      if (hash) {
        setActiveTabRaw(hash);
        if (["builder-v3", "builder-v2", "builder"].includes(hash)) {
          setBuildersExpanded(true);
        }
        if (hash.startsWith("analytics-")) {
          setAnalyticsExpanded(true);
        }
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
          { key: "admin-misconceptions", label: "Misconceptions", icon: "🧠", adminOnly: true },
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
                buildersExpanded={buildersExpanded}
                setBuildersExpanded={setBuildersExpanded}
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
              <TabRouter
                activeTab={activeTab}
                userIsAdmin={userIsAdmin}
                builderView={builderView}
                setBuilderView={setBuilderView}
                showWizard={showWizard}
                setShowWizard={setShowWizard}
                pendingEditPath={pendingEditPath}
                setPendingEditPath={setPendingEditPath}
                setPreSelectedSkill={setPreSelectedSkill}
                isMobile={isMobile}
                courses={courses}
                tags={tags}
                edges={edges}
                analyticsEvents={analyticsEvents}
                setAnalyticsEvents={setAnalyticsEvents}
                analyticsTimeRange={analyticsTimeRange}
                setAnalyticsTimeRange={setAnalyticsTimeRange}
                onInsightNavigate={handleInsightNavigate}
                builderEditor={
                  <BuilderEditor
                    courses={courses}
                    isMobile={isMobile}
                    preSelectedSkill={preSelectedSkill}
                    setPreSelectedSkill={setPreSelectedSkill}
                    onBackToDashboard={() => setBuilderView("dashboard")}
                  />
                }
              />
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
