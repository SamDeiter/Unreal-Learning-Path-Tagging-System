/**
 * TagGraph Component - Interactive Tag Connection Graph
 *
 * A weighted network graph visualization using Cytoscape.js that displays
 * relationships between tags with interactive hover/click focus modes.
 *
 * Features:
 * - Force-directed layout (cose-bilkent) for organic node positioning
 * - Node size scaled by tag count
 * - Edge thickness scaled by connection weight
 * - Hover highlighting with tooltip showing connected tags
 * - Click focus mode (hub-and-spoke view)
 * - Edge weight filtering slider
 * - Search/filter functionality
 * - Zoom, pan, and fit-to-screen
 *
 * @param {Array} tags - Array of { id, label, count } objects
 * @param {Array} edges - Array of { sourceTagId, targetTagId, weight } objects
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import "./TagGraph.css";

// Register the cose-bilkent layout algorithm
cytoscape.use(coseBilkent);

// ============================================================================
// SCALING FUNCTIONS
// ============================================================================

/**
 * Creates a clamped linear scale for mapping values to a visual range.
 * Prevents outliers from dominating the visualization.
 *
 * @param {number} value - Input value to scale
 * @param {number} minIn - Minimum input value
 * @param {number} maxIn - Maximum input value
 * @param {number} minOut - Minimum output value
 * @param {number} maxOut - Maximum output value
 * @returns {number} - Scaled and clamped output value
 */
function clampedScale(value, minIn, maxIn, minOut, maxOut) {
  // Clamp input to range
  const clampedValue = Math.max(minIn, Math.min(maxIn, value));
  // Linear interpolation
  const ratio = (clampedValue - minIn) / (maxIn - minIn || 1);
  return minOut + ratio * (maxOut - minOut);
}

/**
 * Calculates node size based on tag count.
 * Uses clamped scale to prevent outliers from being too large.
 *
 * Range: 20px (min) to 60px (max)
 */
function getNodeSize(count, minCount, maxCount) {
  return clampedScale(count, minCount, maxCount, 20, 60);
}

/**
 * Calculates edge width based on weight.
 * Uses clamped scale for consistent visual density.
 *
 * Range: 1px (min) to 8px (max)
 */
function getEdgeWidth(weight, minWeight, maxWeight) {
  return clampedScale(weight, minWeight, maxWeight, 1, 8);
}

/**
 * Calculates edge opacity based on weight.
 * Stronger connections are more visible.
 *
 * Range: 0.3 (min) to 1 (max)
 */
function getEdgeOpacity(weight, minWeight, maxWeight) {
  return clampedScale(weight, minWeight, maxWeight, 0.3, 1);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function TagGraph({ tags = [], edges = [] }) {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  // Cytoscape instance reference
  const cyRef = useRef(null);

  // Container ref (for tooltip positioning)
  const containerRef = useRef(null);

  // Focus mode: which node (if any) is currently focused
  const [focusedNodeId, setFocusedNodeId] = useState(null);

  // Hover state for tooltip
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Pinned stats panel - stays visible when you click a node
  const [pinnedNode, setPinnedNode] = useState(null);
  const [pinnedData, setPinnedData] = useState(null);

  // Filter controls
  const [minWeightFilter, setMinWeightFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxNodesDisplay, setMaxNodesDisplay] = useState(50);

  // Layout running state
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);

  // -------------------------------------------------------------------------
  // DERIVED DATA: Compute min/max for scaling
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // FILTERED DATA: Apply weight filter and top-N limit
  // -------------------------------------------------------------------------

  const { filteredElements } = useMemo(() => {
    // Create tag lookup for quick access
    const lookup = new Map(tags.map((t) => [t.id, t]));

    // Sort tags by count (descending) and take top N
    const sortedTags = [...tags].sort((a, b) => b.count - a.count);
    const topTags = sortedTags.slice(0, maxNodesDisplay);
    const topTagIds = new Set(topTags.map((t) => t.id));

    // Filter edges by weight threshold AND only include edges between top tags
    const filteredEdges = edges.filter(
      (e) =>
        e.weight >= minWeightFilter && topTagIds.has(e.sourceTagId) && topTagIds.has(e.targetTagId)
    );

    // Build edge set for checking node connectivity
    const connectedNodeIds = new Set();
    filteredEdges.forEach((e) => {
      connectedNodeIds.add(e.sourceTagId);
      connectedNodeIds.add(e.targetTagId);
    });

    // Convert to Cytoscape elements format
    const nodes = topTags.map((tag) => ({
      data: {
        id: tag.id,
        label: tag.label,
        count: tag.count,
        // Pre-compute node size for styling
        size: getNodeSize(tag.count, minCount, maxCount),
        // Track if node has visible connections
        hasConnections: connectedNodeIds.has(tag.id),
      },
    }));

    const edgeElements = filteredEdges.map((edge) => ({
      data: {
        id: `${edge.sourceTagId}-${edge.targetTagId}`,
        source: edge.sourceTagId,
        target: edge.targetTagId,
        weight: edge.weight,
        // Pre-compute edge styling values
        width: getEdgeWidth(edge.weight, minWeight, maxWeight),
        opacity: getEdgeOpacity(edge.weight, minWeight, maxWeight),
      },
    }));

    return {
      filteredElements: [...nodes, ...edgeElements],
      tagLookup: lookup,
    };
  }, [tags, edges, minWeightFilter, maxNodesDisplay, minCount, maxCount, minWeight, maxWeight]);

  // -------------------------------------------------------------------------
  // SEARCH RESULTS: Filter tags by search query
  // -------------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return tags.filter((t) => t.label.toLowerCase().includes(query)).slice(0, 10); // Limit results
  }, [tags, searchQuery]);

  // -------------------------------------------------------------------------
  // TOOLTIP DATA: State for tooltip content (computed in event handler)
  // -------------------------------------------------------------------------

  const [tooltipData, setTooltipData] = useState(null);

  /**
   * Computes tooltip data for a given node.
   * Called from the mouseover event handler.
   */
  const computeTooltipData = useCallback((cy, nodeId) => {
    const node = cy.getElementById(nodeId);
    if (!node || node.length === 0) return null;

    const nodeData = node.data();
    const neighborhood = node.neighborhood("edge");

    // Get connected nodes with their edge weights
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

    // Sort by weight (strongest first) and take top 5
    connections.sort((a, b) => b.weight - a.weight);
    const topConnections = connections.slice(0, 5);

    return {
      label: nodeData.label,
      count: nodeData.count,
      neighborCount: connections.length,
      topConnections,
    };
  }, []);

  // -------------------------------------------------------------------------
  // CYTOSCAPE STYLESHEET
  // Defines visual styling for nodes, edges, and state classes
  // -------------------------------------------------------------------------

  const stylesheet = useMemo(
    () => [
      // Default node styling
      {
        selector: "node",
        style: {
          width: "data(size)",
          height: "data(size)",
          "background-color": "#58a6ff",
          "border-width": 2,
          "border-color": "#1f6feb",
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
          "z-index": 10, // Ensure nodes render above edges
        },
      },
      // Default edge styling
      {
        selector: "edge",
        style: {
          width: "data(width)",
          "line-color": "#30363d",
          "curve-style": "bezier",
          opacity: "data(opacity)",
          "transition-property": "opacity, line-color, width",
          "transition-duration": "200ms",
          "z-index": 1, // Edges behind nodes
        },
      },
      // Nodes without connections (isolated after filtering)
      {
        selector: "node[!hasConnections]",
        style: {
          opacity: 0.4,
          "background-color": "#6e7681",
        },
      },
      // Highlighted node (on hover or focus)
      {
        selector: "node.highlight",
        style: {
          "background-color": "#a371f7",
          "border-color": "#8957e5",
          "border-width": 3,
          "z-index": 999,
        },
      },
      // Neighbor nodes (connected to highlighted node)
      {
        selector: "node.neighbor",
        style: {
          "background-color": "#3fb950",
          "border-color": "#238636",
          opacity: 1,
        },
      },
      // Dimmed nodes (not in focus neighborhood)
      {
        selector: "node.dimmed",
        style: {
          opacity: 0.15,
        },
      },
      // Highlighted edges
      {
        selector: "edge.highlight",
        style: {
          "line-color": "#a371f7",
          opacity: 1,
          "z-index": 998,
        },
      },
      // Dimmed edges
      {
        selector: "edge.dimmed",
        style: {
          opacity: 0.05,
        },
      },
      // Focused node (clicked)
      {
        selector: "node.focused",
        style: {
          "background-color": "#f0883e",
          "border-color": "#d29922",
          "border-width": 4,
          "z-index": 1000,
        },
      },
    ],
    []
  );

  // -------------------------------------------------------------------------
  // LAYOUT CONFIGURATION
  // Uses cose-bilkent for stable force-directed layout
  // -------------------------------------------------------------------------

  const layoutConfig = useMemo(
    () => ({
      name: "cose-bilkent",
      // Animation
      animate: "end",
      animationDuration: 1000,
      // Physics - LARGE spacing to prevent label overlap
      idealEdgeLength: 800, // Very large - ensures connected nodes are far apart
      nodeRepulsion: 300000, // Very high repulsion
      nestingFactor: 0.1,
      gravity: 0.015, // Very low gravity - let graph spread wide
      gravityRange: 2.0,
      numIter: 5000, // More iterations for better convergence
      // Padding for nodes
      tile: true,
      tilingPaddingVertical: 200, // Large padding between tiled components
      tilingPaddingHorizontal: 200,
      nodeDimensionsIncludeLabels: true, // CRITICAL: Include label size in spacing
      // Randomize positions
      randomize: true,
      // Anti-overlap - LARGE VALUES
      edgeElasticity: 0.02, // Very soft edges
      componentSpacing: 300, // Large space between disconnected components
      nodeOverlap: 150, // Large minimum space between nodes (accounts for labels)
      // Fit to viewport
      fit: true,
      padding: 80,
      quality: "proof",
    }),
    []
  );

  // -------------------------------------------------------------------------
  // CYTOSCAPE INSTANCE HANDLER
  // Just stores the instance reference, events are attached via useEffect
  // -------------------------------------------------------------------------

  // Track when cy instance is ready for event attachment
  const [cyReady, setCyReady] = useState(false);

  const handleCy = useCallback((cy) => {
    cyRef.current = cy;
    // Defer state update to avoid calling setState during render
    setTimeout(() => setCyReady(true), 0);
  }, []);

  // Keep refs for state values needed in event handlers to avoid stale closures
  const focusedNodeIdRef = useRef(focusedNodeId);
  useEffect(() => {
    focusedNodeIdRef.current = focusedNodeId;
  }, [focusedNodeId]);

  // -------------------------------------------------------------------------
  // EVENT HANDLERS EFFECT
  // Attaches Cytoscape event listeners after mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!cyReady) return;
    const cy = cyRef.current;
    if (!cy) return;

    // ----- HOVER BEHAVIOR -----
    const handleMouseOver = (event) => {
      const node = event.target;
      const nodeId = node.id();

      // Don't override focus mode (use ref to avoid stale closure)
      if (!focusedNodeIdRef.current) {
        const neighborhood = node.closedNeighborhood();
        node.addClass("highlight");
        neighborhood.edges().addClass("highlight");
        neighborhood.nodes().not(node).addClass("neighbor");
        cy.elements().not(neighborhood).addClass("dimmed");
      }

      // Update tooltip state
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

      // Pin the stats for this node
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

    // Attach listeners
    cy.on("mouseover", "node", handleMouseOver);
    cy.on("mouseout", "node", handleMouseOut);
    cy.on("tap", "node", handleNodeTap);
    cy.on("tap", handleCanvasTap);
    cy.on("mousemove", handleMouseMove);

    // Cleanup
    return () => {
      cy.off("mouseover", "node", handleMouseOver);
      cy.off("mouseout", "node", handleMouseOut);
      cy.off("tap", "node", handleNodeTap);
      cy.off("tap", handleCanvasTap);
      cy.off("mousemove", handleMouseMove);
    };
  }, [computeTooltipData, cyReady]);

  // -------------------------------------------------------------------------
  // FOCUS MODE EFFECT
  // Applies focus styling when focusedNodeId changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    // Clear previous styling
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

  // -------------------------------------------------------------------------
  // CONTROL HANDLERS
  // -------------------------------------------------------------------------

  const handleFitToScreen = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(null, 50); // 50px padding
    }
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
      const layout = cyRef.current.layout(layoutConfig);
      layout.on("layoutstop", () => setIsLayoutRunning(false));
      layout.run();
    }
  }, [layoutConfig, isLayoutRunning]);

  const handleSearchSelect = useCallback((tagId) => {
    setFocusedNodeId(tagId);
    setSearchQuery("");

    // Center on the selected node
    if (cyRef.current) {
      const node = cyRef.current.getElementById(tagId);
      if (node && node.length > 0) {
        cyRef.current.animate({
          center: { eles: node },
          zoom: 1.5,
          duration: 300,
        });
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="tag-graph">
      {/* Control Panel */}
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

        {/* Weight Filter Slider */}
        <div className="control-group">
          <label>Min Edge Weight: {minWeightFilter.toFixed(0)}</label>
          <input
            type="range"
            min={0}
            max={maxWeight}
            step={1}
            value={minWeightFilter}
            onChange={(e) => setMinWeightFilter(Number(e.target.value))}
          />
        </div>

        {/* Max Nodes Display */}
        <div className="control-group">
          <label>Show Top {maxNodesDisplay === tags.length ? "All" : maxNodesDisplay} Tags</label>
          <input
            type="range"
            min={10}
            max={tags.length}
            step={10}
            value={maxNodesDisplay}
            onChange={(e) => setMaxNodesDisplay(Number(e.target.value))}
          />
          <button
            className="show-all-btn"
            onClick={() => setMaxNodesDisplay(tags.length)}
            title="Show all tags"
          >
            All
          </button>
        </div>

        {/* Action Buttons */}
        <div className="control-group buttons">
          <button onClick={handleFitToScreen} title="Fit graph to screen">
            🔍 Fit
          </button>
          <button onClick={handleRunLayout} disabled={isLayoutRunning}>
            {isLayoutRunning ? "⏳ Running..." : "🔄 Re-layout"}
          </button>
          {focusedNodeId && (
            <button onClick={handleClearFocus} className="clear-focus">
              ✕ Clear Focus
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="graph-stats">
          <span>Nodes: {filteredElements.filter((e) => !e.data.source).length}</span>
          <span>Edges: {filteredElements.filter((e) => e.data.source).length}</span>
        </div>
      </div>

      {/* Cytoscape Graph */}
      <div className="graph-container" ref={containerRef}>
        <CytoscapeComponent
          elements={filteredElements}
          stylesheet={stylesheet}
          layout={layoutConfig}
          cy={handleCy}
          style={{ width: "100%", height: "calc(100vh - 200px)" }}
          wheelSensitivity={1.0}
          boxSelectionEnabled={false}
          autounselectify={true}
        />

        {/* Tooltip */}
        {hoveredNode && tooltipData && (
          <div
            className="graph-tooltip"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
            }}
          >
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

        {/* Pinned Stats Panel - Right Side */}
        {pinnedNode && pinnedData && (
          <div className="pinned-stats-panel">
            <div className="pinned-header">
              <h3>📌 {pinnedData.label}</h3>
              <button
                className="unpin-btn"
                onClick={() => {
                  setPinnedNode(null);
                  setPinnedData(null);
                }}
                title="Unpin"
              >
                ✕
              </button>
            </div>
            <div className="pinned-stats">
              <div className="stat-row" title="Number of courses that include this tag">
                <span className="stat-label">Count:</span>
                <span className="stat-value">{pinnedData.count}</span>
                <span className="stat-hint">courses with this tag</span>
              </div>
              <div
                className="stat-row"
                title="Number of other tags that appear together with this tag"
              >
                <span className="stat-label">Connections:</span>
                <span className="stat-value">{pinnedData.neighborCount}</span>
                <span className="stat-hint">related tags</span>
              </div>
            </div>
            {pinnedData.topConnections.length > 0 && (
              <div className="pinned-connections">
                <h4 title="Tags that most frequently appear together with this tag">
                  Top Connections
                </h4>
                <p className="connections-hint">
                  Tags that often appear together (weight = co-occurrence strength)
                </p>
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
