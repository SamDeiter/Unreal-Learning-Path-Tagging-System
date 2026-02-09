import { useState, useMemo, lazy, Suspense } from "react";
import { PathProvider } from "./context/PathContext";
import { TagDataProvider } from "./context/TagDataContext";
import Dashboard from "./components/Dashboard/Dashboard";
import LoadingSpinner from "./components/LoadingSpinner/LoadingSpinner";
import "./App.css";

// Import course data
import videoLibrary from "./data/video_library_enriched.json";
import tagsData from "./data/tags.json";
import edgesData from "./data/edges.json";

// ── Lazy-loaded tab components (code-split per tab) ──────────────────
const LeftPanel = lazy(() => import("./components/LeftPanel/LeftPanel"));
const AssemblyLine = lazy(() => import("./components/AssemblyLine/AssemblyLine"));
const OutputPanel = lazy(() => import("./components/OutputPanel/OutputPanel"));
const LearningIntentHeader = lazy(() => import("./components/LearningIntent/LearningIntentHeader"));
const TagGraph = lazy(() => import("./components/TagGraph/TagGraph"));
const PathReadiness = lazy(() => import("./components/PathReadiness/PathReadiness"));
const TagSources = lazy(() => import("./components/TagSources/TagSources"));
const TagEditor = lazy(() => import("./components/TagEditor/TagEditor"));
const Personas = lazy(() => import("./components/Personas/Personas"));
const ProblemFirst = lazy(() =>
  import("./components/ProblemFirst").then((m) => ({ default: m.ProblemFirst }))
);
const InsightsPanel = lazy(() => import("./components/Visualizations/InsightsPanel"));
const CollapsibleSection = lazy(() => import("./components/Visualizations/CollapsibleSection"));
const FeedbackButton = lazy(() => import("./components/Feedback/FeedbackButton"));

// Analytics visualizations — import directly (not via barrel) for proper code-splitting
const JourneyHeatmap = lazy(() => import("./components/Visualizations/JourneyHeatmap"));
const TagTimeline = lazy(() => import("./components/Visualizations/TagTimeline"));
const TagTrends = lazy(() => import("./components/Visualizations/TagTrends"));
const PrereqFlow = lazy(() => import("./components/Visualizations/PrereqFlow"));
const InstructorMap = lazy(() => import("./components/Visualizations/InstructorMap"));
const TagHeatmap = lazy(() => import("./components/Visualizations/TagHeatmap"));
const SkillRadar = lazy(() => import("./components/Visualizations/SkillRadar"));
const SkillGapAnalysis = lazy(() => import("./components/Visualizations/SkillGapAnalysis"));

function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'builder' | 'tags'
  const [preSelectedSkill, setPreSelectedSkill] = useState(null);

  // Handle navigation from insights panel
  const handleInsightNavigate = (tab, skillName) => {
    setActiveTab(tab);
    if (skillName) {
      setPreSelectedSkill(skillName);
    }
  };

  // Process course data - deduplicate by code
  const courses = useMemo(() => {
    const raw = videoLibrary.courses || [];
    // Deduplicate: keep first occurrence of each code
    const seen = new Set();
    return raw.filter((c) => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      // Exclude intro/outro clips — no meaningful learning content
      const title = (c.title || "").toLowerCase();
      if (title === "introduction" || title === "intro" || title === "outro") return false;
      return true;
    });
  }, []);

  // Process tag data - either use pre-defined or extract from courses
  const { tags, edges } = useMemo(() => {
    // Use the rich tag data from tags.json, deduplicated by tag_id
    const rawTags = tagsData.tags || [];
    const seenTagIds = new Set();
    const processedTags = rawTags
      .filter((tag) => {
        if (seenTagIds.has(tag.tag_id)) return false;
        seenTagIds.add(tag.tag_id);
        return true;
      })
      .map((tag) => {
        // Compute actual course count for this tag
        const tagIdLower = tag.tag_id.toLowerCase();
        const tagNameLower = tag.display_name.toLowerCase();
        const courseCount = courses.filter((c) => {
          const allTags = [
            ...(c.canonical_tags || []),
            ...(c.ai_tags || []),
            ...(c.gemini_system_tags || []),
            ...(c.transcript_tags || []),
            ...(c.extracted_tags || []),
          ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
          return allTags.some((ct) => ct === tagIdLower || ct === tagNameLower);
        }).length;

        return {
          id: tag.tag_id,
          label: tag.display_name,
          name: tag.display_name,
          count: courseCount,
          description: tag.description,
          categoryPath: tag.category_path,
          synonyms: tag.synonyms,
        };
      });

    // Use edges from edges.json - handle both array and wrapped formats
    const rawEdges = Array.isArray(edgesData) ? edgesData : edgesData.edges || [];
    const processedEdges = rawEdges.map((edge) => ({
      sourceTagId: edge.sourceTagId || edge.source,
      targetTagId: edge.targetTagId || edge.target,
      weight: edge.weight || 5,
      relation: edge.type || edge.relation || "related",
    }));

    return { tags: processedTags, edges: processedEdges };
  }, [courses]);

  return (
    <PathProvider>
      <TagDataProvider tags={tags} edges={edges} courses={courses}>
        <div className="app">
          {/* Header */}
          <header className="app-header">
            <div className="header-left">
              <h1 className="app-title">UE5 Learning Path Builder</h1>
              <nav className="main-nav">
                <button
                  className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
                  onClick={() => setActiveTab("dashboard")}
                >
                  📊 Dashboard
                </button>
                <button
                  className={`nav-tab ${activeTab === "readiness" ? "active" : ""}`}
                  onClick={() => setActiveTab("readiness")}
                >
                  📚 Path Readiness
                </button>
                <button
                  className={`nav-tab ${activeTab === "sources" ? "active" : ""}`}
                  onClick={() => setActiveTab("sources")}
                >
                  🏷️ Tag Sources
                </button>
                <button
                  className={`nav-tab ${activeTab === "editor" ? "active" : ""}`}
                  onClick={() => setActiveTab("editor")}
                >
                  ✏️ Tag Editor
                </button>
                <button
                  className={`nav-tab ${activeTab === "builder" ? "active" : ""}`}
                  onClick={() => setActiveTab("builder")}
                >
                  Path Builder
                </button>
                <button
                  className={`nav-tab ${activeTab === "personas" ? "active" : ""}`}
                  onClick={() => setActiveTab("personas")}
                >
                  🚀 Onboarding
                </button>
                <button
                  className={`nav-tab ${activeTab === "problem" ? "active" : ""}`}
                  onClick={() => setActiveTab("problem")}
                >
                  🔧 Fix a Problem
                </button>
                <button
                  className={`nav-tab ${activeTab === "analytics" ? "active" : ""}`}
                  onClick={() => setActiveTab("analytics")}
                >
                  📊 Analytics
                </button>
              </nav>
            </div>
            <div className="header-right">
              <span className="course-count">{courses.length} Courses Available</span>
            </div>
          </header>

          {/* Main Content */}
          <main className="app-main">
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
              {activeTab === "sources" && (
                <div className="dashboard-layout">
                  <TagSources />
                </div>
              )}
              {activeTab === "editor" && (
                <div className="dashboard-layout">
                  <TagEditor />
                </div>
              )}
              {activeTab === "builder" && (
                <div className="builder-layout">
                  {/* Top: Intent */}
                  <div className="builder-header-area">
                    <LearningIntentHeader />
                  </div>

                  {/* Left: Input Panel */}
                  <aside className="library-panel">
                    <LeftPanel
                      courses={courses}
                      preSelectedSkill={preSelectedSkill}
                      onSkillUsed={() => setPreSelectedSkill(null)}
                    />
                  </aside>

                  {/* Center: Path Canvas */}
                  <section className="assembly-panel">
                    <AssemblyLine />
                  </section>

                  {/* Right: Outputs */}
                  <aside className="output-panel-area">
                    <OutputPanel />
                  </aside>
                </div>
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
              {activeTab === "analytics" && (
                <div className="analytics-layout">
                  <div className="analytics-header">
                    <h2>📊 Tag & Skill Analytics</h2>
                    <p className="analytics-subtitle">Insights from {courses.length} courses</p>
                  </div>

                  <div className="analytics-grid">
                    {/* Insights & Recommendations */}
                    <InsightsPanel onNavigate={handleInsightNavigate} />

                    {/* Skill Coverage vs Industry Demand */}
                    <CollapsibleSection
                      title="Coverage vs Industry Demand"
                      icon="🎯"
                      defaultExpanded={true}
                    >
                      <div className="coverage-grid">
                        <SkillRadar />
                        <SkillGapAnalysis />
                      </div>
                    </CollapsibleSection>

                    {/* Overview Section */}
                    <CollapsibleSection title="Overview" icon="📈">
                      <JourneyHeatmap />
                    </CollapsibleSection>

                    {/* Library Analysis Section */}
                    <CollapsibleSection title="Library Analysis" icon="📚">
                      <TagTrends />
                      <TagHeatmap />
                      <TagTimeline />
                      <InstructorMap />
                    </CollapsibleSection>

                    {/* Learning Paths Section */}
                    <CollapsibleSection title="Learning Paths" icon="🛤️">
                      <PrereqFlow />
                    </CollapsibleSection>

                    {/* Tag Relationship Graph Section */}
                    <CollapsibleSection
                      title="Tag Relationship Graph"
                      icon="🔗"
                      defaultExpanded={true}
                    >
                      <div className="tag-graph-wrapper">
                        <TagGraph tags={tags} edges={edges} courses={courses} />
                      </div>
                    </CollapsibleSection>
                  </div>
                </div>
              )}
            </Suspense>
          </main>

          <FeedbackButton />
        </div>
      </TagDataProvider>
    </PathProvider>
  );
}

export default App;
