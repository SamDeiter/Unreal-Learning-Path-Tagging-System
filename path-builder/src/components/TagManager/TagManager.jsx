import { useState, lazy, Suspense } from "react";
import "./TagManager.css";

const TagSources = lazy(() => import("../TagSources/TagSources"));
const TagEditor = lazy(() => import("../TagEditor/TagEditor"));

/**
 * TagManager — Wrapper that combines Tag Sources and Tag Editor
 * into a single view with sub-tabs.
 */
export default function TagManager() {
  const [subTab, setSubTab] = useState("sources");

  return (
    <div className="tag-manager">
      <div className="tag-manager-tabs">
        <button
          className={`tag-manager-tab ${subTab === "sources" ? "active" : ""}`}
          onClick={() => setSubTab("sources")}
        >
          📊 Tag Sources
        </button>
        <button
          className={`tag-manager-tab ${subTab === "editor" ? "active" : ""}`}
          onClick={() => setSubTab("editor")}
        >
          ✏️ Tag Editor
        </button>
      </div>

      <Suspense fallback={<div className="tag-manager-loading">Loading…</div>}>
        {subTab === "sources" ? <TagSources /> : <TagEditor />}
      </Suspense>
    </div>
  );
}
