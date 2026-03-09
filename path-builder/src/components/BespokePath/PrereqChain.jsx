/**
 * PrereqChain — Visual dependency graph between learning path steps
 *
 * Renders the output of buildPrereqChain() as an SVG graph:
 *   - Nodes colored by category (foundation=cyan, core=blue, practice=purple)
 *   - Strong edges as solid lines, weak edges as dashed
 *   - Floating steps flagged with ⚠️ warning
 *   - Missing links shown with suggested bridge text
 *
 * Props:
 *   chain — { nodes, edges, floatingSteps, missingLinks } from buildPrereqChain()
 */

import { useMemo } from "react";

const CATEGORY_COLORS = {
  foundation: "#22d3ee", // cyan
  prerequisite: "#22d3ee",
  diagnosis: "#a78bfa", // violet
  core: "#60a5fa", // blue
  fix: "#60a5fa",
  practice: "#c084fc", // purple
  transfer: "#c084fc",
  default: "#94a3b8",
};

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}

export default function PrereqChain({ chain }) {
  // Layout calculation: position nodes in a left-to-right flow
  const layout = useMemo(() => {
    if (!chain || !chain.nodes || chain.nodes.length === 0) return null;

    const nodeWidth = 140;
    const nodeHeight = 44;
    const hGap = 40;
    const vGap = 60;
    const cols = Math.min(chain.nodes.length, 4); // Max 4 columns
    const rows = Math.ceil(chain.nodes.length / cols);
    const padding = 30;

    const positions = chain.nodes.map((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        ...node,
        x: padding + col * (nodeWidth + hGap),
        y: padding + row * (nodeHeight + vGap),
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    const svgWidth = padding * 2 + cols * (nodeWidth + hGap) - hGap;
    const svgHeight = padding * 2 + rows * (nodeHeight + vGap) - vGap;

    return { positions, svgWidth, svgHeight, nodeWidth, nodeHeight };
  }, [chain]);

  if (!chain || !chain.nodes || chain.nodes.length === 0) {
    return (
      <div className="prereq-chain">
        <div className="prereq-chain-empty">
          No dependency data available. Generate a path to see the prerequisite chain.
        </div>
      </div>
    );
  }

  const { positions, svgWidth, svgHeight, nodeWidth, nodeHeight } = layout;
  const floatingSet = new Set(chain.floatingSteps || []);

  return (
    <div className="prereq-chain" id="prereq-chain-view">
      <div className="prereq-chain-header">
        <h2>
          <i
            className="fa-solid fa-diagram-project"
            style={{ marginRight: "8px", opacity: 0.7 }}
          ></i>
          Prerequisite Chain
        </h2>
        <div className="prereq-chain-stats">
          <span className="prereq-chain-stat">
            <i className="fa-solid fa-circle-nodes"></i>
            {chain.nodes.length} steps
          </span>
          <span className="prereq-chain-stat">
            <i className="fa-solid fa-link"></i>
            {chain.edges.length} connections
          </span>
          {chain.floatingSteps?.length > 0 && (
            <span className="prereq-chain-stat" style={{ color: "#fb923c" }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              {chain.floatingSteps.length} floating
            </span>
          )}
        </div>
      </div>

      {/* SVG Graph */}
      <div className="prereq-chain-svg-container">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Prerequisite dependency graph"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
            </marker>
            <marker
              id="arrowhead-strong"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
            </marker>
          </defs>

          {/* Edges */}
          {chain.edges.map((edge, i) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            if (!from || !to) return null;

            const x1 = from.x + nodeWidth / 2;
            const y1 = from.y + nodeHeight;
            const x2 = to.x + nodeWidth / 2;
            const y2 = to.y;

            // Curved path for better readability
            const midY = (y1 + y2) / 2;
            const isStrong = edge.strength === "strong";

            return (
              <path
                key={`edge-${i}`}
                d={`M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke={isStrong ? "#60a5fa" : "#475569"}
                strokeWidth={isStrong ? 2 : 1}
                strokeDasharray={isStrong ? "none" : "4 4"}
                markerEnd={isStrong ? "url(#arrowhead-strong)" : "url(#arrowhead)"}
                opacity={isStrong ? 0.8 : 0.4}
              />
            );
          })}

          {/* Missing link indicators (dashed red) */}
          {(chain.missingLinks || []).map((link, i) => {
            const from = positions[link.from];
            const to = positions[link.to];
            if (!from || !to) return null;

            const x1 = from.x + nodeWidth / 2;
            const y1 = from.y + nodeHeight;
            const x2 = to.x + nodeWidth / 2;
            const y2 = to.y;
            const midY = (y1 + y2) / 2;

            return (
              <path
                key={`missing-${i}`}
                d={`M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={0.4}
              />
            );
          })}

          {/* Nodes */}
          {positions.map((node) => {
            const color = getCategoryColor(node.category);
            const isFloating = floatingSet.has(node.id);
            const truncTitle =
              node.title.length > 18 ? node.title.substring(0, 16) + "…" : node.title;

            return (
              <g key={`node-${node.id}`} id={`chain-node-${node.id}`}>
                {/* Node background */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={10}
                  fill={`${color}15`}
                  stroke={isFloating ? "#fb923c" : color}
                  strokeWidth={isFloating ? 2 : 1}
                  strokeDasharray={isFloating ? "4 2" : "none"}
                />
                {/* Step number */}
                <text
                  x={node.x + 14}
                  y={node.y + nodeHeight / 2 + 1}
                  textAnchor="middle"
                  fill={color}
                  fontSize="11"
                  fontWeight="700"
                >
                  {node.id + 1}
                </text>
                {/* Title */}
                <text
                  x={node.x + 28}
                  y={node.y + nodeHeight / 2 + 1}
                  textAnchor="start"
                  fill="#e6edf3"
                  fontSize="10"
                  fontWeight="500"
                  dominantBaseline="middle"
                >
                  {truncTitle}
                </text>
                {/* Floating warning icon */}
                {isFloating && (
                  <text
                    x={node.x + nodeWidth - 16}
                    y={node.y + 14}
                    fontSize="12"
                    textAnchor="middle"
                  >
                    ⚠️
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="prereq-chain-legend">
        {[
          { color: "#22d3ee", label: "Foundation" },
          { color: "#60a5fa", label: "Core" },
          { color: "#c084fc", label: "Practice" },
          { color: "#475569", label: "Weak link", dashed: true },
          { color: "#60a5fa", label: "Strong link" },
          { color: "#ef4444", label: "Missing link", dashed: true },
        ].map((item) => (
          <div key={item.label} className="prereq-chain-legend-item">
            <div
              className="prereq-chain-legend-dot"
              style={{
                backgroundColor: item.dashed ? "transparent" : item.color,
                border: item.dashed ? `2px dashed ${item.color}` : "none",
              }}
            ></div>
            {item.label}
          </div>
        ))}
      </div>

      {/* Warnings */}
      {(chain.floatingSteps?.length > 0 || chain.missingLinks?.length > 0) && (
        <div className="prereq-chain-warnings">
          {chain.floatingSteps?.map((stepIdx) => (
            <div key={`float-${stepIdx}`} className="prereq-chain-warning floating">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>
                Step {stepIdx + 1} ({positions[stepIdx]?.title}) has no prerequisite connection —
                consider adding a bridge
              </span>
            </div>
          ))}
          {chain.missingLinks?.map((link, i) => (
            <div key={`missing-warn-${i}`} className="prereq-chain-warning missing-link">
              <i className="fa-solid fa-link-slash"></i>
              <span>{link.suggestedBridge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
