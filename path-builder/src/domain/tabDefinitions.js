/**
 * Tab definitions — shared between App.jsx, AppSidebar, and MobileNavDrawer.
 * Moved out of App.jsx to avoid circular imports.
 */

// Tab definitions — split into student-facing and admin/builder
// Newest mode always at the top of the list
export const PRIMARY_TABS = [
  { key: "adaptive", label: "Adaptive Path", icon: "🎯" },
  { key: "builder-v2", label: "Path Builder V2", icon: "✨" },
  { key: "bespoke", label: "Fix a Problem", icon: "🔧" },
  { key: "problem", label: "Learn Why", icon: "🧠" },
  { key: "augmentation", label: "Augmentation", icon: "🔬" },
  { key: "personas", label: "Onboarding", icon: "🚀" },
  { key: "builder", label: "Path Builder (V1)", icon: "🏗️" },
];

export const SECONDARY_TABS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "readiness", label: "Path Readiness", icon: "📚" },
  { key: "tags", label: "Tags", icon: "🏷️" },
  { key: "analytics", label: "Analytics", icon: "📈", expandable: true },
];

export const ANALYTICS_SUBTABS = [
  { key: "analytics-overview", label: "Overview", icon: "📊" },
  { key: "analytics-insights", label: "Insights", icon: "💡" },
  { key: "analytics-confidence", label: "Confidence", icon: "🧠" },
  { key: "analytics-coverage", label: "Coverage", icon: "🎯" },
  { key: "analytics-library", label: "Library", icon: "📚" },
  { key: "analytics-paths", label: "Learning Paths", icon: "🛤️" },
  { key: "analytics-graph", label: "Tag Graph", icon: "🔗" },
  { key: "analytics-gaps", label: "Content Gaps", icon: "🕳️" },
  { key: "analytics-pipeline", label: "Pipeline", icon: "⚙️" },
  { key: "analytics-costs", label: "Costs", icon: "💰" },
];

export const BASE_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

// On mobile, surface the most useful tabs first
export const MOBILE_TAB_ORDER = [
  "adaptive",
  "bespoke",
  "problem",
  "personas",
  "builder",
  "dashboard",
  "readiness",
  "tags",
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
