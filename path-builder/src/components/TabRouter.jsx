import { lazy, Suspense } from "react";
import { usePath } from "../context/PathContext";
import LoadingSpinner from "./LoadingSpinner/LoadingSpinner";

// ── Lazy-loaded tab components (code-split per tab) ──────────────────
const Dashboard = lazy(() => import("./Dashboard/Dashboard"));
const PathReadiness = lazy(() => import("./PathReadiness/PathReadiness"));
const TagManager = lazy(() => import("./TagManager/TagManager"));
const PathDashboard = lazy(() => import("./PathBuilder/PathDashboard"));
const PathCreationWizard = lazy(() => import("./PathBuilder/PathCreationWizard"));
const PathLoader = lazy(() => import("./PathBuilder/PathLoader"));
const PathBuilderV2Mockup = lazy(() => import("./PathBuilderV2Mockup/PathBuilderV2Mockup"));
const Personas = lazy(() => import("./Personas/Personas"));
const ProblemFirst = lazy(() =>
  import("./ProblemFirst").then((m) => ({ default: m.ProblemFirst }))
);
const BespokePath = lazy(() => import("./BespokePath/BespokePath"));
const AdaptivePath = lazy(() => import("./AdaptivePath/AdaptivePath"));
const AdminFeedback = lazy(() => import("./AdminFeedback/AdminFeedback"));
const AdminErrorLogs = lazy(() => import("./AdminErrorLogs/AdminErrorLogs"));
const InsightsPanel = lazy(() => import("./Visualizations/InsightsPanel"));
const InviteManager = lazy(() => import("./InviteManager/InviteManager"));
const AdminAnalytics = lazy(() => import("./AdminAnalytics/AdminAnalytics"));
const ContentGaps = lazy(() => import("./AdminAnalytics/ContentGaps"));
const AnalyticsPipeline = lazy(() => import("./AdminAnalytics/AnalyticsPipeline"));
const AnalyticsCosts = lazy(() => import("./AdminAnalytics/AnalyticsCosts"));
const DemandDashboard = lazy(() => import("./DemandDashboard/DemandDashboard"));
const UefnDemandDashboard = lazy(() => import("./UefnDemandDashboard/UefnDemandDashboard"));
const AuthoringWorkbench = lazy(() => import("./AuthoringWorkbench/AuthoringWorkbench"));

// Analytics visualizations — import directly for proper code-splitting
const JourneyHeatmap = lazy(() => import("./Visualizations/JourneyHeatmap"));
const TagTimeline = lazy(() => import("./Visualizations/TagTimeline"));
const TagTrends = lazy(() => import("./Visualizations/TagTrends"));
const PrereqFlow = lazy(() => import("./Visualizations/PrereqFlow"));
const InstructorMap = lazy(() => import("./Visualizations/InstructorMap"));
const TagHeatmap = lazy(() => import("./Visualizations/TagHeatmap"));
const SkillRadar = lazy(() => import("./Visualizations/SkillRadar"));
const SkillGapAnalysis = lazy(() => import("./Visualizations/SkillGapAnalysis"));
const ConfidenceAnalytics = lazy(() => import("./Visualizations/ConfidenceAnalytics"));
const TagHistorySparkline = lazy(() => import("./Visualizations/TagHistorySparkline"));
const TagGraph = lazy(() => import("./TagGraph/TagGraph"));

/**
 * TabRouter — renders the active tab content.
 * Extracted from App.jsx to reduce component size and improve readability.
 *
 * @param {Object} props
 * @param {string} props.activeTab - Current tab key
 * @param {boolean} props.userIsAdmin - Whether user has admin privileges
 * @param {string} props.builderView - "dashboard" | "editor"
 * @param {Function} props.setBuilderView
 * @param {boolean} props.showWizard
 * @param {Function} props.setShowWizard
 * @param {Object|null} props.pendingEditPath
 * @param {Function} props.setPendingEditPath
 * @param {Function} props.setPreSelectedSkill
 * @param {boolean} props.isMobile
 * @param {Array} props.courses
 * @param {Array} props.tags
 * @param {Array} props.edges
 * @param {Array} props.analyticsEvents
 * @param {Function} props.setAnalyticsEvents
 * @param {Object} props.analyticsTimeRange
 * @param {Function} props.setAnalyticsTimeRange
 * @param {Function} props.onInsightNavigate
 * @param {React.ReactNode} props.builderEditor - Pre-built BuilderEditor component
 */
export default function TabRouter({
  activeTab,
  userIsAdmin,
  builderView,
  setBuilderView,
  showWizard,
  setShowWizard,
  pendingEditPath,
  setPendingEditPath,
  setPreSelectedSkill,
  isMobile,
  courses,
  tags,
  edges,
  analyticsEvents,
  setAnalyticsEvents,
  analyticsTimeRange,
  setAnalyticsTimeRange,
  onInsightNavigate,
  builderEditor,
}) {
  const { clearPath } = usePath();

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* ── Simple 1:1 tabs ── */}
      {activeTab === "dashboard" && (
        <div className="dashboard-layout"><Dashboard /></div>
      )}
      {activeTab === "readiness" && (
        <div className="dashboard-layout"><PathReadiness /></div>
      )}
      {activeTab === "tags" && (
        <div className="dashboard-layout"><TagManager /></div>
      )}
      {activeTab === "personas" && (
        <div className="dashboard-layout"><Personas /></div>
      )}
      {activeTab === "problem" && (
        <div className="dashboard-layout"><ProblemFirst /></div>
      )}
      {activeTab === "adaptive" && (
        <div className="dashboard-layout"><AdaptivePath /></div>
      )}
      {activeTab === "bespoke" && (
        <div className="dashboard-layout"><BespokePath /></div>
      )}

      {/* ── Path Builder V2 Mockup ── */}
      {activeTab === "builder-v2" && (
        <div className="dashboard-layout"><PathBuilderV2Mockup /></div>
      )}

      {/* ── Path Builder V3 (Viewer) — iframe embed ── */}
      {activeTab === "builder-v3" && (
        <div className="augmentation-layout">
          <iframe
            className="augmentation-frame"
            src={`${import.meta.env.BASE_URL}viewer-v3/index.html`}
            title="Path Builder V3"
          />
        </div>
      )}

      {/* ── Authoring Workbench ── */}
      {activeTab === "authoring" && (
        <div className="dashboard-layout"><AuthoringWorkbench /></div>
      )}

      {/* ── Demand Intelligence ── */}
      {activeTab === "analytics-demand" && (
        <div className="dashboard-layout"><DemandDashboard /></div>
      )}

      {/* ── UEFN Demand Intelligence ── */}
      {activeTab === "analytics-uefn-demand" && (
        <div className="dashboard-layout"><UefnDemandDashboard /></div>
      )}

      {/* ── Path Builder (V1) (dashboard / editor subviews + wizard) ── */}
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
      {activeTab === "builder" && builderView === "editor" && builderEditor}
      {pendingEditPath && (
        <PathLoader
          pendingPath={pendingEditPath}
          onLoaded={() => setPendingEditPath(null)}
        />
      )}
      {showWizard && (
        <PathCreationWizard
          onComplete={(pathData) => {
            // Clear any stale draft so the canvas starts empty
            clearPath();
            setShowWizard(false);
            import("../utils/pathStorageUtils").then(({ savePathToStorage }) => {
              savePathToStorage(pathData);
            });
            localStorage.setItem(
              "ue5_wizard_intent",
              JSON.stringify({
                primaryGoal: pathData.goal,
                skillLevel: pathData.skillLevel,
                timeBudget: pathData.timeBudget,
                industries: pathData.industries || [],
              })
            );
            setPreSelectedSkill(pathData.goal);
            setBuilderView("editor");
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* ── Analytics tabs ── */}
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
          <InsightsPanel onNavigate={onInsightNavigate} />
        </div>
      )}
      {activeTab === "analytics-confidence" && (
        <div className="analytics-layout"><ConfidenceAnalytics /></div>
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
        <div className="analytics-layout"><PrereqFlow /></div>
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

      {/* ── Augmentation (iframe) ── */}
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

      {/* ── Admin tabs ── */}
      {activeTab === "invites" && userIsAdmin && (
        <div className="dashboard-layout"><InviteManager /></div>
      )}
      {activeTab === "admin-feedback" && userIsAdmin && (
        <div className="dashboard-layout"><AdminFeedback /></div>
      )}
      {activeTab === "admin-errors" && userIsAdmin && (
        <div className="dashboard-layout"><AdminErrorLogs /></div>
      )}
    </Suspense>
  );
}
