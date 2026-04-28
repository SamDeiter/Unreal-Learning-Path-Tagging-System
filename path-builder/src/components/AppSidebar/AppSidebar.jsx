/**
 * AppSidebar — Desktop sidebar navigation, extracted from App.jsx.
 * Contains tab navigation, analytics expand/collapse, user info block,
 * and build version display.
 */
/* global __BUILD_HASH__, __BUILD_TIME__, __BUILD_NUMBER__ */
import { signOutUser } from "../../services/googleAuthService";
import { PRIMARY_TABS, SECONDARY_TABS, ANALYTICS_SUBTABS, PATH_BUILDER_TABS } from "../../domain/tabDefinitions";
import AccessibilityPanel from "../Settings/AccessibilityPanel";

export default function AppSidebar({
  tabs,
  activeTab,
  setActiveTab,
  analyticsExpanded,
  setAnalyticsExpanded,
  buildersExpanded,
  setBuildersExpanded,
  newFeedbackCount,
  currentUser,
  onRetakeQuiz,
}) {
  const isAnyBuilderActive = ["builder-v3", "builder-v2", "builder"].includes(activeTab);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">UE5 LPB</h1>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <span className="sidebar-section-label">Learning</span>
          {PRIMARY_TABS.map((tab) => {
            // Path Builders is expandable with sub-items
            if (tab.expandable && tab.key === "path-builders") {
              return (
                <div key={tab.key}>
                  <button
                    className={`sidebar-tab ${isAnyBuilderActive ? "active" : ""}`}
                    title={tab.tooltip}
                    onClick={() => {
                      setBuildersExpanded(!buildersExpanded);
                      if (!isAnyBuilderActive) {
                        setActiveTab("builder-v3");
                        setBuildersExpanded(true);
                      }
                    }}
                  >
                    <span className="sidebar-tab-icon" aria-hidden="true">{tab.icon}</span>
                    <span className="sidebar-tab-label">{tab.label}</span>
                    <span
                      className={`sidebar-expand-arrow ${buildersExpanded ? "expanded" : ""}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                  </button>
                  {buildersExpanded && (
                    <div className="sidebar-subtabs">
                      {PATH_BUILDER_TABS.map((sub) => (
                        <button
                          key={sub.key}
                          className={`sidebar-tab sidebar-tab-sub ${activeTab === sub.key ? "active" : ""}`}
                          title={sub.tooltip}
                          onClick={() => setActiveTab(sub.key)}
                        >
                          <span className="sidebar-tab-icon" aria-hidden="true">{sub.icon}</span>
                          <span className="sidebar-tab-label">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={tab.key}
                className={`sidebar-tab ${activeTab === tab.key ? "active" : ""}`}
                title={tab.tooltip}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="sidebar-tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="sidebar-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <span className="sidebar-section-label">Tools</span>
          {[...SECONDARY_TABS, ...tabs.filter((t) => t.adminOnly)].map((tab) => {
            // Analytics is expandable with sub-items
            if (tab.expandable && tab.key === "analytics") {
              const isAnyAnalyticsActive = activeTab.startsWith("analytics-");
              return (
                <div key={tab.key}>
                  <button
                    className={`sidebar-tab sidebar-tab-sm ${isAnyAnalyticsActive ? "active" : ""}`}
                    title={tab.tooltip}
                    onClick={() => {
                      setAnalyticsExpanded(!analyticsExpanded);
                      if (!isAnyAnalyticsActive) {
                        setActiveTab("analytics-overview");
                        setAnalyticsExpanded(true);
                      }
                    }}
                  >
                    <span className="sidebar-tab-icon" aria-hidden="true">{tab.icon}</span>
                    <span className="sidebar-tab-label">{tab.label}</span>
                    <span
                      className={`sidebar-expand-arrow ${analyticsExpanded ? "expanded" : ""}`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                  </button>
                  {analyticsExpanded && (
                    <div className="sidebar-subtabs">
                      {ANALYTICS_SUBTABS.map((sub) => (
                        <button
                          key={sub.key}
                          className={`sidebar-tab sidebar-tab-sub ${activeTab === sub.key ? "active" : ""}`}
                          title={sub.tooltip}
                          onClick={() => setActiveTab(sub.key)}
                        >
                          <span className="sidebar-tab-icon" aria-hidden="true">{sub.icon}</span>
                          <span className="sidebar-tab-label">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={tab.key}
                className={`sidebar-tab sidebar-tab-sm ${activeTab === tab.key ? "active" : ""}`}
                title={tab.tooltip}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="sidebar-tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="sidebar-tab-label">{tab.label}</span>
                {tab.key === "admin-feedback" && newFeedbackCount > 0 && (
                  <span className="feedback-badge">{newFeedbackCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {currentUser && (
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            {currentUser.photoURL && (
              <img
                src={currentUser.photoURL}
                alt=""
                className="header-avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="sidebar-user-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentUser.displayName || currentUser.email}
            </span>
          </div>
          <div
            className="build-info"
            title={`Build #${typeof __BUILD_NUMBER__ !== "undefined" ? __BUILD_NUMBER__ : "?"} (${typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev"}) — ${typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : ""}`}
            style={{ fontSize: "0.65rem", color: "var(--fg-muted, #636e7b)", padding: "0 0.5rem", marginTop: "-2px" }}
          >
            {typeof __BUILD_NUMBER__ !== "undefined"
              ? `Build #${__BUILD_NUMBER__} · ${new Date(__BUILD_TIME__).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "dev"}
          </div>
          <div className="sidebar-user-actions">
            <button
              className="retake-quiz-btn"
              onClick={onRetakeQuiz}
            >
              <span aria-hidden="true">🔄</span> Change Role
            </button>
            <button className="header-signout-btn" onClick={() => signOutUser()}>
              Sign Out
            </button>
            <AccessibilityPanel />
          </div>
        </div>
      )}
    </aside>
  );
}

