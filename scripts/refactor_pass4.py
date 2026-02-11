"""Pass 4 — Split TagGraph.jsx (933 lines) into:
1. tagGraphConfig.js   — scaling functions, CATEGORY_COLORS, stylesheet, layoutConfig
2. useTagGraph.js       — custom hook with all state, effects, event handlers
3. TagGraph.jsx (slim)  — thin view (~250 lines).
"""
import pathlib
import textwrap

SRC = pathlib.Path(r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src")
COMP = SRC / "components" / "TagGraph"
HOOKS = SRC / "hooks"
HOOKS.mkdir(exist_ok=True)

# ── 1. tagGraphConfig.js ───────────────────────────────────────────────────
config_code = textwrap.dedent(r'''
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
''').lstrip()

(COMP / "tagGraphConfig.js").write_text(config_code, encoding="utf-8")
print("✅ tagGraphConfig.js created")

# ── 2. useTagGraph.js ──────────────────────────────────────────────────────
hook_code = textwrap.dedent(r'''
/**
 * useTagGraph — Custom hook for TagGraph state management and event handling
 * Extracted from TagGraph.jsx (Pass 4 refactor)
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { getNodeSize, getEdgeWidth, getEdgeOpacity, getCategoryColor, LAYOUT_CONFIG } from "../components/TagGraph/tagGraphConfig";
import { resolveCollisions } from "../components/TagGraph/layoutUtils";

/**
 * @param {Object} params
 * @param {Array} params.tags   Array of { id, label, count }
 * @param {Array} params.edges  Array of { sourceTagId, targetTagId, weight }
 * @returns Hook state and handlers consumed by <TagGraph />
 */
export default function useTagGraph({ tags = [], edges = [] }) {
  // ── Refs ──
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const focusedNodeIdRef = useRef(null);

  // ── State ──
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [pinnedNode, setPinnedNode] = useState(null);
  const [pinnedData, setPinnedData] = useState(null);
  const [minWeightFilter, setMinWeightFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxNodesDisplay, setMaxNodesDisplay] = useState(50);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [cyReady, setCyReady] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);

  // Keep ref in sync
  useEffect(() => { focusedNodeIdRef.current = focusedNodeId; }, [focusedNodeId]);

  // ── Derived: min/max ──
  const { minCount, maxCount, minWeight, maxWeight } = useMemo(() => {
    const counts = tags.map((t) => t.count);
    const weights = edges.map((e) => e.weight);
    return {
      minCount: Math.min(...counts, 0),
      maxCount: Math.max(...counts, 100),
      minWeight: Math.min(...weights, 0),
      maxWeight: Math.max(...weights, 100),
    };
  }, [tags, edges]);

  // ── Filtered elements ──
  const filteredElements = useMemo(() => {
    const sortedTags = [...tags].sort((a, b) => b.count - a.count);
    const topTags = sortedTags.slice(0, maxNodesDisplay);
    const topTagIds = new Set(topTags.map((t) => t.id));

    const filteredEdges = edges.filter(
      (e) =>
        e.weight >= minWeightFilter &&
        topTagIds.has(e.sourceTagId) &&
        topTagIds.has(e.targetTagId) &&
        e.sourceTagId !== e.targetTagId
    );

    const connectedNodeIds = new Set();
    filteredEdges.forEach((e) => {
      connectedNodeIds.add(e.sourceTagId);
      connectedNodeIds.add(e.targetTagId);
    });

    const nodes = topTags.map((tag) => {
      const nodeSize = getNodeSize(tag.count, minCount, maxCount);
      const labelWidth = Math.max(tag.label.length * 7 + 40, nodeSize);
      const totalHeight = nodeSize + 30;
      const colors = getCategoryColor(tag.id);
      return {
        data: {
          id: tag.id,
          label: tag.label,
          count: tag.count,
          size: nodeSize,
          width: labelWidth,
          height: totalHeight,
          hasConnections: connectedNodeIds.has(tag.id),
          bgColor: colors.bg,
          borderColor: colors.border,
          category: tag.id.split('.')[0] || 'other',
        },
      };
    });

    const edgeElements = filteredEdges.map((edge) => ({
      data: {
        id: `${edge.sourceTagId}-${edge.targetTagId}`,
        source: edge.sourceTagId,
        target: edge.targetTagId,
        weight: edge.weight,
        width: getEdgeWidth(edge.weight, minWeight, maxWeight),
        opacity: getEdgeOpacity(edge.weight, minWeight, maxWeight),
      },
    }));

    return [...nodes, ...edgeElements];
  }, [tags, edges, minWeightFilter, maxNodesDisplay, minCount, maxCount, minWeight, maxWeight]);

  // ── Search ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tags.filter((t) => t.label.toLowerCase().includes(query)).slice(0, 10);
  }, [tags, searchQuery]);

  // ── Tooltip computer ──
  const computeTooltipData = useCallback((cy, nodeId) => {
    const node = cy.getElementById(nodeId);
    if (!node || node.length === 0) return null;
    const nodeData = node.data();
    const neighborhood = node.neighborhood("edge");
    const connections = [];
    neighborhood.forEach((edge) => {
      const edgeData = edge.data();
      const connectedId = edgeData.source === nodeId ? edgeData.target : edgeData.source;
      const connectedNode = cy.getElementById(connectedId);
      if (connectedNode && connectedNode.length > 0) {
        connections.push({
          id: connectedId,
          label: connectedNode.data("label"),
          weight: edgeData.weight,
        });
      }
    });
    connections.sort((a, b) => b.weight - a.weight);
    return {
      label: nodeData.label,
      count: nodeData.count,
      neighborCount: connections.length,
      topConnections: connections.slice(0, 5),
    };
  }, []);

  // ── Cy instance handler ──
  const handleCy = useCallback((cy) => {
    cyRef.current = cy;
    setTimeout(() => setCyReady(true), 0);
  }, []);

  // ── Event handlers effect ──
  useEffect(() => {
    if (!cyReady) return;
    const cy = cyRef.current;
    if (!cy) return;

    const handleMouseOver = (event) => {
      const node = event.target;
      const nodeId = node.id();
      if (!focusedNodeIdRef.current) {
        const neighborhood = node.closedNeighborhood();
        node.addClass("highlight");
        neighborhood.edges().addClass("highlight");
        neighborhood.nodes().not(node).addClass("neighbor");
        cy.elements().not(neighborhood).addClass("dimmed");
      }
      setHoveredNode(nodeId);
      setTooltipData(computeTooltipData(cy, nodeId));
      const position = event.renderedPosition || event.position;
      setTooltipPosition({ x: position.x + 15, y: position.y - 10 });
    };

    const handleMouseOut = () => {
      if (!focusedNodeIdRef.current) {
        cy.elements().removeClass("highlight neighbor dimmed");
      }
      setHoveredNode(null);
      setTooltipData(null);
    };

    const handleNodeTap = (event) => {
      const node = event.target;
      const nodeId = node.id();
      if (focusedNodeIdRef.current === nodeId) {
        setFocusedNodeId(null);
        cy.elements().removeClass("focused highlight neighbor dimmed");
      } else {
        setFocusedNodeId(nodeId);
      }
      setPinnedNode(nodeId);
      setPinnedData(computeTooltipData(cy, nodeId));
    };

    const handleCanvasTap = (event) => {
      if (event.target === cy) {
        setFocusedNodeId(null);
        setPinnedNode(null);
        setPinnedData(null);
        cy.elements().removeClass("focused highlight neighbor dimmed");
      }
    };

    const handleMouseMove = (event) => {
      if (event.target.isNode && event.target.isNode()) {
        setTooltipPosition({
          x: event.renderedPosition.x + 15,
          y: event.renderedPosition.y - 10,
        });
      }
    };

    cy.on("mouseover", "node", handleMouseOver);
    cy.on("mouseout", "node", handleMouseOut);
    cy.on("tap", "node", handleNodeTap);
    cy.on("tap", handleCanvasTap);
    cy.on("mousemove", handleMouseMove);
    return () => {
      cy.off("mouseover", "node", handleMouseOver);
      cy.off("mouseout", "node", handleMouseOut);
      cy.off("tap", "node", handleNodeTap);
      cy.off("tap", handleCanvasTap);
      cy.off("mousemove", handleMouseMove);
    };
  }, [computeTooltipData, cyReady]);

  // ── Focus mode effect ──
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.elements().removeClass("focused highlight neighbor dimmed");
    if (focusedNodeId) {
      const node = cy.getElementById(focusedNodeId);
      if (node && node.length > 0) {
        const neighborhood = node.closedNeighborhood();
        node.addClass("focused");
        neighborhood.edges().addClass("highlight");
        neighborhood.nodes().not(node).addClass("neighbor");
        cy.elements().not(neighborhood).addClass("dimmed");
      }
    }
  }, [focusedNodeId]);

  // ── Control handlers ──
  const handleFitToScreen = useCallback(() => {
    if (cyRef.current) cyRef.current.fit(null, 50);
  }, []);

  const handleClearFocus = useCallback(() => {
    setFocusedNodeId(null);
    if (cyRef.current) {
      cyRef.current.elements().removeClass("focused highlight neighbor dimmed");
    }
  }, []);

  const handleRunLayout = useCallback(() => {
    if (cyRef.current && !isLayoutRunning) {
      setIsLayoutRunning(true);
      const layout = cyRef.current.layout(LAYOUT_CONFIG);
      layout.on("layoutstop", () => setIsLayoutRunning(false));
      layout.run();
    }
  }, [isLayoutRunning]);

  const handleSearchSelect = useCallback((tagId) => {
    setFocusedNodeId(tagId);
    setSearchQuery("");
    if (cyRef.current) {
      const node = cyRef.current.getElementById(tagId);
      if (node && node.length > 0) {
        cyRef.current.animate({ center: { eles: node }, zoom: 1.5, duration: 300 });
      }
    }
  }, []);

  // ── Collision resolution effect ──
  useEffect(() => {
    if (!cyReady || !cyRef.current) return;
    const cy = cyRef.current;

    const handleLayoutStop = () => {
      const nodes = cy.nodes();
      if (nodes.length === 0) return;
      const newPositions = resolveCollisions(nodes, {
        padding: 30,
        gridSize: 200,
        maxIterations: 50,
        stiffness: 0.1,
      });
      cy.batch(() => {
        nodes.forEach((node) => {
          const id = node.id();
          if (newPositions[id]) node.position(newPositions[id]);
        });
      });
    };

    cy.on("layoutstop", handleLayoutStop);
    if (cy.elements().length > 0) handleLayoutStop();
    return () => { cy.off("layoutstop", handleLayoutStop); };
  }, [cyReady, isLayoutRunning]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'Escape': handleClearFocus(); break;
        case 'f': case 'F': handleFitToScreen(); break;
        case '+': case '=':
          if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.2);
          break;
        case '-': case '_':
          if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearFocus, handleFitToScreen]);

  // ── Unpin handler ──
  const handleUnpin = useCallback(() => {
    setPinnedNode(null);
    setPinnedData(null);
  }, []);

  return {
    // Refs
    cyRef, containerRef,
    // State
    focusedNodeId, hoveredNode, tooltipPosition, tooltipData,
    pinnedNode, pinnedData,
    minWeightFilter, setMinWeightFilter,
    searchQuery, setSearchQuery,
    maxNodesDisplay, setMaxNodesDisplay,
    isLayoutRunning,
    // Derived
    maxWeight, filteredElements, searchResults,
    // Handlers
    handleCy, handleFitToScreen, handleClearFocus,
    handleRunLayout, handleSearchSelect, handleUnpin,
  };
}
''').lstrip()

(HOOKS / "useTagGraph.js").write_text(hook_code, encoding="utf-8")
print("✅ hooks/useTagGraph.js created")

# ── 3. Rewrite TagGraph.jsx ────────────────────────────────────────────────
slim_jsx = textwrap.dedent(r'''
/**
 * TagGraph Component - Interactive Tag Connection Graph (Thin View)
 *
 * Visualization layer only — all state, events, and config are
 * extracted to useTagGraph hook and tagGraphConfig.js.
 */
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import useTagGraph from "../../hooks/useTagGraph";
import { CATEGORY_COLORS, GRAPH_STYLESHEET, LAYOUT_CONFIG } from "./tagGraphConfig";
import "./TagGraph.css";

// Register the cose-bilkent layout algorithm
cytoscape.use(coseBilkent);

function TagGraph({ tags = [], edges = [] }) {
  const {
    containerRef,
    focusedNodeId, hoveredNode, tooltipPosition, tooltipData,
    pinnedNode, pinnedData,
    minWeightFilter, setMinWeightFilter,
    searchQuery, setSearchQuery,
    maxNodesDisplay, setMaxNodesDisplay,
    isLayoutRunning,
    maxWeight, filteredElements, searchResults,
    handleCy, handleFitToScreen, handleClearFocus,
    handleRunLayout, handleSearchSelect, handleUnpin,
  } = useTagGraph({ tags, edges });

  return (
    <div className="tag-graph">
      {/* ── Control Panel ── */}
      <div className="graph-controls">
        {/* Search */}
        <div className="control-group search-group">
          <label>Search Tags</label>
          <input
            type="text"
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((tag) => (
                <button
                  key={tag.id}
                  className="search-result-item"
                  onClick={() => handleSearchSelect(tag.id)}
                >
                  <span className="result-label">{tag.label}</span>
                  <span className="result-count">{tag.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weight Filter */}
        <div className="control-group">
          <label>Min Edge Weight: {minWeightFilter.toFixed(0)}</label>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={maxWeight}
              step={1}
              value={minWeightFilter}
              onChange={(e) => setMinWeightFilter(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Max Nodes */}
        <div className="control-group">
          <label>Show Top {maxNodesDisplay === tags.length ? "All" : maxNodesDisplay} Tags</label>
          <div className="slider-row">
            <input
              type="range"
              min={10}
              max={tags.length}
              step={10}
              value={maxNodesDisplay}
              onChange={(e) => setMaxNodesDisplay(Number(e.target.value))}
            />
            <button className="show-all-btn" onClick={() => setMaxNodesDisplay(tags.length)} title="Show all tags">
              All
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="control-group buttons">
          <button onClick={handleFitToScreen} title="Fit graph to screen">🔍 Fit</button>
          <button onClick={handleRunLayout} disabled={isLayoutRunning} title="Recalculate node positions">
            {isLayoutRunning ? "⏳ Running..." : "🔄 Re-layout"}
          </button>
          {focusedNodeId && (
            <button onClick={handleClearFocus} className="clear-focus" title="Deselect the focused node">
              ✕ Clear Focus
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="graph-stats">
          <span>Nodes: {filteredElements.filter((e) => !e.data.source).length}</span>
          <span>Edges: {filteredElements.filter((e) => e.data.source).length}</span>
        </div>

        {/* Tips */}
        <div className="graph-tips">
          💡 <strong>Click</strong> node to focus • <strong>Hover</strong> for connections • <strong>Esc</strong> to reset • <strong>F</strong> to fit
        </div>

        {/* Legend */}
        <div className="category-legend">
          {Object.entries(CATEGORY_COLORS)
            .filter(([key]) => key !== 'default')
            .slice(0, 8)
            .map(([category, colors]) => (
              <div key={category} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: colors.bg }} />
                <span className="legend-label">{category}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ── Cytoscape Graph ── */}
      <div className="graph-container" ref={containerRef}>
        <CytoscapeComponent
          elements={filteredElements}
          stylesheet={GRAPH_STYLESHEET}
          layout={LAYOUT_CONFIG}
          cy={handleCy}
          style={{ width: "100%", height: "calc(100vh - 200px)" }}
          wheelSensitivity={0.3}
          boxSelectionEnabled={false}
          autounselectify={true}
          userPanningEnabled={true}
          userZoomingEnabled={true}
          minZoom={0.3}
          maxZoom={3}
          pan={{ x: 0, y: 0 }}
        />

        {/* Tooltip */}
        {hoveredNode && tooltipData && (
          <div className="graph-tooltip" style={{ left: tooltipPosition.x, top: tooltipPosition.y }}>
            <div className="tooltip-header">
              <span className="tooltip-label">{tooltipData.label}</span>
            </div>
            <div className="tooltip-stats">
              <span>Count: {tooltipData.count}</span>
              <span>Connections: {tooltipData.neighborCount}</span>
            </div>
            {tooltipData.topConnections.length > 0 && (
              <div className="tooltip-connections">
                <div className="connections-title">Top Connections:</div>
                {tooltipData.topConnections.map((conn) => (
                  <div key={conn.id} className="connection-item">
                    <span className="conn-label">{conn.label}</span>
                    <span className="conn-weight">{conn.weight.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pinned Stats Panel */}
        {pinnedNode && pinnedData && (
          <div className="pinned-stats-panel">
            <div className="pinned-header">
              <h3>📌 {pinnedData.label}</h3>
              <button className="unpin-btn" onClick={handleUnpin} title="Unpin">✕</button>
            </div>
            <div className="pinned-stats">
              <div className="stat-row" title="Number of courses that include this tag">
                <span className="stat-label">Count:</span>
                <span className="stat-value">{pinnedData.count}</span>
                <span className="stat-hint">courses with this tag</span>
              </div>
              <div className="stat-row" title="Number of other tags that appear together with this tag">
                <span className="stat-label">Connections:</span>
                <span className="stat-value">{pinnedData.neighborCount}</span>
                <span className="stat-hint">related tags</span>
              </div>
            </div>
            {pinnedData.topConnections.length > 0 && (
              <div className="pinned-connections">
                <h4 title="Tags that most frequently appear together with this tag">Top Connections</h4>
                <p className="connections-hint">Tags that often appear together (weight = co-occurrence strength)</p>
                {pinnedData.topConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className="pinned-connection-item"
                    title={`Weight ${conn.weight.toFixed(0)}: How strongly ${conn.label} is associated with ${pinnedData.label}`}
                  >
                    <span className="conn-name">{conn.label}</span>
                    <span className="conn-strength">{conn.weight.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TagGraph;
''').lstrip()

(COMP / "TagGraph.jsx").write_text(slim_jsx, encoding="utf-8")

# Count lines
orig = 933
new = slim_jsx.count('\n') + 1
print(f"✅ TagGraph.jsx rewritten: {orig} → {new} lines")

print("\n─── Pass 4 Complete ───")
