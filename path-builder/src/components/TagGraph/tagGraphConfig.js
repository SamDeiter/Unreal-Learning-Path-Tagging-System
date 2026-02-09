/**
 * tagGraphConfig.js — Visual constants, scaling functions, Cytoscape stylesheet & layout
 * Extracted from TagGraph.jsx (Pass 4 refactor)
 */

// ============================================================================
// SCALING FUNCTIONS
// ============================================================================

/**
 * Creates a clamped linear scale for mapping values to a visual range.
 */
export function clampedScale(value, minIn, maxIn, minOut, maxOut) {
  const clampedValue = Math.max(minIn, Math.min(maxIn, value));
  const ratio = (clampedValue - minIn) / (maxIn - minIn || 1);
  return minOut + ratio * (maxOut - minOut);
}

/** Node size 20–60px based on tag count */
export function getNodeSize(count, minCount, maxCount) {
  return clampedScale(count, minCount, maxCount, 20, 60);
}

/** Edge width 3–10px based on weight */
export function getEdgeWidth(weight, minWeight, maxWeight) {
  return clampedScale(weight, minWeight, maxWeight, 3, 10);
}

/** Edge opacity 0.6–1 based on weight */
export function getEdgeOpacity(weight, minWeight, maxWeight) {
  return clampedScale(weight, minWeight, maxWeight, 0.6, 1);
}

// ============================================================================
// CATEGORY COLORS — for visual clustering
// ============================================================================

export const CATEGORY_COLORS = {
  scripting:    { bg: '#a371f7', border: '#8957e5' },
  rendering:    { bg: '#58a6ff', border: '#1f6feb' },
  animation:    { bg: '#3fb950', border: '#238636' },
  environment:  { bg: '#f0883e', border: '#d47616' },
  character:    { bg: '#f778ba', border: '#db61a2' },
  multiplayer:  { bg: '#56d4dd', border: '#39c5cf' },
  ai:           { bg: '#d29922', border: '#bb8009' },
  ui:           { bg: '#bc8cff', border: '#a371f7' },
  optimization: { bg: '#ff7b72', border: '#f85149' },
  cinematic:    { bg: '#79c0ff', border: '#58a6ff' },
  audio:        { bg: '#7ee787', border: '#56d364' },
  procedural:   { bg: '#ffa657', border: '#f0883e' },
  default:      { bg: '#8b949e', border: '#6e7681' },
};

/** Gets color pair for a tag based on its category prefix */
export function getCategoryColor(tagId) {
  if (!tagId) return CATEGORY_COLORS.default;
  const category = tagId.split('.')[0]?.toLowerCase();
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}

// ============================================================================
// CYTOSCAPE STYLESHEET
// ============================================================================

export const GRAPH_STYLESHEET = [
  // Default node
  {
    selector: "node",
    style: {
      width: "data(size)",
      height: "data(size)",
      "background-color": "data(bgColor)",
      "border-width": 2,
      "border-color": "data(borderColor)",
      label: "data(label)",
      "font-size": "10px",
      color: "#e6edf3",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 8,
      "text-outline-width": 2,
      "text-outline-color": "#0d1117",
      "transition-property": "opacity, background-color, border-color",
      "transition-duration": "200ms",
      "z-index": 10,
    },
  },
  // Default edge
  {
    selector: "edge",
    style: {
      width: "data(width)",
      "line-color": "#58a6ff",
      "curve-style": "bezier",
      opacity: "data(opacity)",
      "transition-property": "opacity, line-color, width",
      "transition-duration": "200ms",
      "z-index": 1,
    },
  },
  // Isolated nodes
  {
    selector: "node[!hasConnections]",
    style: { opacity: 0.4, "background-color": "#6e7681" },
  },
  // Highlighted node
  {
    selector: "node.highlight",
    style: {
      "background-color": "#a371f7",
      "border-color": "#8957e5",
      "border-width": 3,
      "z-index": 12,
    },
  },
  // Neighbor nodes
  {
    selector: "node.neighbor",
    style: {
      "background-color": "#3fb950",
      "border-color": "#238636",
      opacity: 1,
      "z-index": 11,
    },
  },
  // Dimmed
  { selector: "node.dimmed", style: { opacity: 0.15 } },
  // Highlighted edges
  {
    selector: "edge.highlight",
    style: { "line-color": "#a371f7", opacity: 1, "z-index": 2 },
  },
  // Dimmed edges
  { selector: "edge.dimmed", style: { opacity: 0.05 } },
  // Focused node
  {
    selector: "node.focused",
    style: {
      "background-color": "#f0883e",
      "border-color": "#d29922",
      "border-width": 4,
      "z-index": 13,
    },
  },
];

// ============================================================================
// LAYOUT CONFIGURATION
// ============================================================================

export const LAYOUT_CONFIG = {
  name: "cose-bilkent",
  idealEdgeLength: 150,
  nodeRepulsion: 10000,
  nestingFactor: 0.1,
  gravity: 0.2,
  gravityRange: 3.0,
  numIter: 2500,
  tile: true,
  tilingPaddingVertical: 50,
  tilingPaddingHorizontal: 50,
  nodeDimensionsIncludeLabels: true,
  randomize: true,
  edgeElasticity: 0.45,
  componentSpacing: 60,
  nodeOverlap: 20,
  fit: true,
  padding: 30,
  quality: "default",
  stop: undefined,
};
