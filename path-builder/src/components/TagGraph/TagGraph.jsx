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
          wheelSensitivity={0.8}
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
