import { useState, useMemo } from "react";
import { PathProvider } from "./context/PathContext";
import { TagDataProvider } from "./context/TagDataContext";
import { extractTagsFromCourses, buildTagEdges } from "./utils/dataProcessing";
import CourseLibrary from "./components/CourseLibrary/CourseLibrary";
import AssemblyLine from "./components/AssemblyLine/AssemblyLine";
import PathSummary from "./components/AssemblyLine/PathSummary";
import "./App.css";

// Import course data
import videoLibrary from "./data/video_library_enriched.json";
import tagsData from "./data/tags.json";
import edgesData from "./data/edges.json";

function App() {
  const [activeTab, setActiveTab] = useState("builder"); // 'builder' | 'tags'

  // Process course data
  const courses = useMemo(() => {
    return videoLibrary.courses || [];
  }, []);

  // Process tag data - either use pre-defined or extract from courses
  const { tags, edges } = useMemo(() => {
    // Use the rich tag data from tags.json
    const processedTags = (tagsData.tags || []).map((tag) => ({
      id: tag.tag_id,
      label: tag.display_name,
      count: tag.relevance?.global_weight * 100 || 50, // Convert weight to count-like metric
      description: tag.description,
      categoryPath: tag.category_path,
    }));

    // Use edges from edges.json
    const processedEdges = (edgesData.edges || []).map((edge) => ({
      sourceTagId: edge.source,
      targetTagId: edge.target,
      weight: edge.weight * 100, // Scale up for visibility
      relation: edge.relation,
    }));

    return { tags: processedTags, edges: processedEdges };
  }, []);

  return (
    <PathProvider>
      <TagDataProvider tags={tags} edges={edges}>
        <div className="app">
          {/* Header */}
          <header className="app-header">
            <div className="header-left">
              <h1 className="app-title">UE5 Learning Path Builder</h1>
              <nav className="main-nav">
                <button
                  className={`nav-tab ${activeTab === "builder" ? "active" : ""}`}
                  onClick={() => setActiveTab("builder")}
                >
                  Path Builder
                </button>
                <button
                  className={`nav-tab ${activeTab === "tags" ? "active" : ""}`}
                  onClick={() => setActiveTab("tags")}
                >
                  Tag Analysis
                </button>
              </nav>
            </div>
            <div className="header-right">
              <span className="course-count">{courses.length} Courses Available</span>
            </div>
          </header>

          {/* Main Content */}
          <main className="app-main">
            {activeTab === "builder" ? (
              <div className="builder-layout">
                {/* Left: Course Library */}
                <aside className="library-panel">
                  <CourseLibrary courses={courses} />
                </aside>

                {/* Right: Assembly Line + Summary */}
                <section className="assembly-panel">
                  <AssemblyLine />
                  <PathSummary />
                </section>
              </div>
            ) : (
              <div className="tags-layout">
                <p className="coming-soon">Tag Analysis views coming in Phase 3</p>
              </div>
            )}
          </main>
        </div>
      </TagDataProvider>
    </PathProvider>
  );
}

export default App;
