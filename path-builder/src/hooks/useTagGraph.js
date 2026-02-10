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

    // Only show nodes that have at least one connection (orphans are noise)
    const connectedTopTags = topTags.filter((tag) => connectedNodeIds.has(tag.id));
    const nodes = connectedTopTags.map((tag) => {
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
        stiffness: 0.05,
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
