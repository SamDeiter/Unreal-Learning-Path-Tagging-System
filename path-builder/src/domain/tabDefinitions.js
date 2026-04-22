/**
 * Tab definitions — shared between App.jsx, AppSidebar, and MobileNavDrawer.
 * Moved out of App.jsx to avoid circular imports.
 */

// Tab definitions — split into student-facing and admin/builder
// Newest mode always at the top of the list
export const PRIMARY_TABS = [
  { key: "authoring", label: "Authoring", icon: "✍️", tooltip: "Create and edit learning paths with AI assistance" },
  { key: "adaptive", label: "Adaptive Path", icon: "🎯", tooltip: "Dynamic learning paths based on your current knowledge" },
  { key: "path-builders", label: "Path Builders", icon: "🛤️", expandable: true, tooltip: "Choose between different path generation engines" },
  { key: "bespoke", label: "Fix a Problem", icon: "🔧", tooltip: "Generate a custom path to solve a specific technical issue" },
  { key: "problem", label: "Learn Why", icon: "🧠", tooltip: "Deep dive into the theory behind the concepts" },
  { key: "augmentation", label: "Augmentation", icon: "🔬", tooltip: "Experiment with AI models to improve content" },
  { key: "personas", label: "Onboarding", icon: "🚀", tooltip: "Configure your expertise level and learning goals" },
];

// Path Builder subtabs — newest first
export const PATH_BUILDER_TABS = [
  { key: "builder-v3", label: "V3 (Viewer)", icon: "🚀", tooltip: "Latest path builder with V3 viewer integration" },
  { key: "builder-v2", label: "V2", icon: "✨", tooltip: "Stabilized V2 path builder engine" },
  { key: "builder", label: "V1", icon: "🏗️", tooltip: "Legacy V1 builder (Classic)" },
];

export const SECONDARY_TABS = [
  { key: "dashboard", label: "Dashboard", icon: "📊", tooltip: "Overview of your learning progress and stats" },
  { key: "readiness", label: "Path Readiness", icon: "📚", tooltip: "Check which learning paths are complete and ready" },
  { key: "tags", label: "Tags", icon: "🏷️", tooltip: "Manage and explore the skill tagging system" },
  { key: "analytics", label: "Analytics", icon: "📈", expandable: true, tooltip: "Deep data insights into demand and coverage" },
];

export const ANALYTICS_SUBTABS = [
  { key: "analytics-overview", label: "Overview", icon: "📊", tooltip: "High-level analytics summary" },
  { key: "analytics-demand", label: "Demand Intelligence", icon: "🔥", tooltip: "Analyze community demand vs existing content" },
  { key: "analytics-uefn-demand", label: "UEFN Demand", icon: "🌌", tooltip: "Analyze community demand specific to UEFN & Verse" },
  { key: "analytics-insights", label: "Insights", icon: "💡", tooltip: "AI-generated strategic recommendations" },
  { key: "analytics-confidence", label: "Confidence", icon: "🧠", tooltip: "Measure AI confidence in tag accuracy" },
  { key: "analytics-coverage", label: "Coverage", icon: "🎯", tooltip: "Detailed content coverage by skill category" },
  { key: "analytics-library", label: "Library", icon: "📚", tooltip: "Manage the source video library" },
  { key: "analytics-paths", label: "Learning Paths", icon: "🛤️", tooltip: "Performance analytics for learning paths" },
  { key: "analytics-graph", label: "Tag Graph", icon: "🔗", tooltip: "Visualize skill relationships and dependencies" },
  { key: "analytics-gaps", label: "Content Gaps", icon: "🕳️", tooltip: "Identify missing topics requested by the community" },
  { key: "analytics-pipeline", label: "Pipeline", icon: "⚙️", tooltip: "Status of content processing pipeline" },
  { key: "analytics-costs", label: "Costs", icon: "💰", tooltip: "Tracking API and infrastructure costs" },
];

// Hidden tabs — addressable via hash routes but not surfaced in nav
export const HIDDEN_TABS = [
  { key: "lesson", label: "Lesson", icon: "📖", hidden: true, tooltip: "Generated lesson page" },
];

export const BASE_TABS = [...PRIMARY_TABS, ...PATH_BUILDER_TABS, ...SECONDARY_TABS, ...HIDDEN_TABS];

// On mobile, surface the most useful tabs first
export const MOBILE_TAB_ORDER = [
  "adaptive",
  "authoring",
  "builder-v3",
  "builder-v2",
  "bespoke",
  "problem",
  "personas",
  "builder",
  "dashboard",
  "readiness",
  "tags",
  "analytics-demand",
  "analytics-overview",
  "analytics-insights",
  "analytics-confidence",
  "analytics-coverage",
  "analytics-library",
  "analytics-paths",
  "analytics-graph",
  "analytics-gaps",
  "analytics-pipeline",
  "analytics-costs",
  "augmentation",
];
