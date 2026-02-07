import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './TagNetwork.css';

// Cluster color palette - visually distinct colors
const CLUSTER_COLORS = [
  '#58a6ff', // Blue
  '#238636', // Green
  '#a371f7', // Purple
  '#f78166', // Orange
  '#3fb950', // Lime
  '#db6d28', // Burnt orange
  '#f0883e', // Amber
  '#8b949e', // Gray
  '#79c0ff', // Light blue
  '#7ee787', // Light green
];

/**
 * Tag Co-occurrence Network
 * Force-directed graph showing which tags appear together
 * Reveals hidden skill clusters
 */
function TagNetwork() {
  const { edges, enrichedTags } = useTagData();
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build network data from edges
  const networkData = useMemo(() => {
    if (!edges || edges.length === 0) {
      return { nodes: [], links: [], clusters: [], nodeClusterMap: new Map() };
    }

    // Get top tags by connection weight
    const tagWeights = new Map();
    const connectionCounts = new Map();
    edges.forEach(edge => {
      tagWeights.set(edge.sourceTagId, (tagWeights.get(edge.sourceTagId) || 0) + edge.weight);
      tagWeights.set(edge.targetTagId, (tagWeights.get(edge.targetTagId) || 0) + edge.weight);
      connectionCounts.set(edge.sourceTagId, (connectionCounts.get(edge.sourceTagId) || 0) + 1);
      connectionCounts.set(edge.targetTagId, (connectionCounts.get(edge.targetTagId) || 0) + 1);
    });

    // Top 50 most connected tags
    const topTagIds = [...tagWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([id]) => id);

    const topTagSet = new Set(topTagIds);

    // Filter edges to only include top tags
    const filteredEdges = edges.filter(
      e => topTagSet.has(e.sourceTagId) && topTagSet.has(e.targetTagId)
    );

    // Create nodes
    const nodes = topTagIds.map((id, i) => {
      const tag = enrichedTags.find(t => t.id === id) || { id, name: id, count: 1 };
      return {
        id,
        name: tag.name || id,
        count: tag.count || 1,
        weight: tagWeights.get(id) || 1,
        connections: connectionCounts.get(id) || 0,
        // Deterministic initial positions based on index
        x: 100 + (i % 7) * 100,
        y: 100 + Math.floor(i / 7) * 80,
        vx: 0,
        vy: 0
      };
    });

    // Create links
    const links = filteredEdges.map(e => ({
      source: e.sourceTagId,
      target: e.targetTagId,
      weight: e.weight
    }));

    // Simple cluster detection (connected components)
    const clusters = detectClusters(nodes, links);
    
    // Create node -> cluster index map for coloring
    const nodeClusterMap = new Map();
    clusters.forEach((cluster, clusterIndex) => {
      cluster.tags.forEach(tagName => {
        const node = nodes.find(n => n.name === tagName);
        if (node) {
          nodeClusterMap.set(node.id, clusterIndex);
        }
      });
    });

    return { nodes, links, clusters, nodeClusterMap };
  }, [edges, enrichedTags]);

  // Get connected node IDs for a given node
  const getConnectedNodes = useCallback((nodeId) => {
    const connected = new Set([nodeId]);
    networkData.links.forEach(link => {
      if (link.source === nodeId) connected.add(link.target);
      if (link.target === nodeId) connected.add(link.source);
    });
    return connected;
  }, [networkData.links]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  }, [zoom, pan]);

  // Find node at position
  const findNodeAtPosition = useCallback((x, y) => {
    for (const node of nodesRef.current) {
      const radius = Math.max(8, Math.min(20, node.count / 2));
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }, []);

  // Mouse move handler
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAtPosition(x, y);
    
    if (node) {
      setHoveredNode(node.id);
      const rect = canvasRef.current.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top - 10,
        node
      });
    } else {
      setHoveredNode(null);
      setTooltip(null);
    }
  }, [isDragging, dragStart, screenToCanvas, findNodeAtPosition]);

  // Mouse click handler
  const handleMouseClick = useCallback((e) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAtPosition(x, y);
    
    if (node) {
      setSelectedNode(selectedNode === node.id ? null : node.id);
    } else {
      setSelectedNode(null);
    }
  }, [screenToCanvas, findNodeAtPosition, selectedNode]);

  // Mouse down for panning
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle click or shift+left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  // Mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
  }, []);

  // Simple force simulation with interactivity
  useEffect(() => {
    if (!canvasRef.current || networkData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let nodes = networkData.nodes.map(n => ({ ...n }));
    nodesRef.current = nodes;
    let animationId;
    let alpha = 1;
    const alphaDecay = 0.97; // Faster cooling
    const alphaMin = 0.01;
    let simulationStopped = false;

    // Find top 10 nodes by weight to always show labels
    const topNodeIds = new Set(
      [...nodes]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 10)
        .map(n => n.id)
    );

    const draw = () => {
      // Get connected nodes if one is selected
      const connectedToSelected = selectedNode ? getConnectedNodes(selectedNode) : null;

      ctx.save();
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, width, height);

      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw links
      networkData.links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          const isHighlighted = hoveredNode && (link.source === hoveredNode || link.target === hoveredNode);
          const isConnectedToSelected = connectedToSelected && 
            (connectedToSelected.has(link.source) && connectedToSelected.has(link.target));
          const isDimmed = selectedNode && !isConnectedToSelected;
          
          ctx.beginPath();
          ctx.lineWidth = isHighlighted ? Math.min(link.weight / 3, 5) : Math.min(link.weight / 5, 3);
          
          if (isHighlighted) {
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.7)';
          } else if (isDimmed) {
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.05)';
          } else {
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.2)';
          }
          
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const radius = Math.max(12, Math.min(30, node.count / 1.5));
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const clusterIndex = networkData.nodeClusterMap.get(node.id) ?? 0;
        const baseColor = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length];
        const isDimmed = selectedNode && !connectedToSelected?.has(node.id);

        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, radius + 8);
          gradient.addColorStop(0, isSelected ? 'rgba(88, 166, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        
        if (isDimmed) {
          ctx.fillStyle = '#30363d';
          ctx.globalAlpha = 0.3;
        } else if (isSelected) {
          ctx.fillStyle = '#58a6ff';
        } else if (isHovered) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = baseColor;
        }
        
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSelected ? '#58a6ff' : '#30363d';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
      });

      // Draw labels
      nodes.forEach(node => {
        const radius = Math.max(12, Math.min(30, node.count / 1.5));
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const isDimmed = selectedNode && !connectedToSelected?.has(node.id);
        const isTopNode = topNodeIds.has(node.id);
        const isConnected = connectedToSelected?.has(node.id);
        
        const showLabel = isHovered || isSelected || isConnected || (!selectedNode && isTopNode);
        
        if (showLabel && !isDimmed) {
          const labelY = node.y + radius + 14;
          const fontSize = isHovered || isSelected ? 14 : 12;
          ctx.font = `${isHovered || isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          
          let label = node.name;
          if (label.length > 20) {
            label = label.substring(0, 18) + '…';
          }
          
          const textWidth = ctx.measureText(label).width;
          
          ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
          ctx.fillRect(node.x - textWidth / 2 - 4, labelY - 10, textWidth + 8, 14);
          
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : '#c9d1d9';
          ctx.fillText(label, node.x, labelY);
        }
      });

      ctx.restore();
    };

    const simulate = () => {
      if (simulationStopped) {
        draw();
        return;
      }

      alpha *= alphaDecay;
      
      if (alpha > alphaMin) {
        nodes.forEach(node => {
          node.vx += (width / 2 - node.x) * 0.001 * alpha;
          node.vy += (height / 2 - node.y) * 0.001 * alpha;

          nodes.forEach(other => {
            if (node.id !== other.id) {
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = 1200 / (dist * dist) * alpha;
              node.vx += (dx / dist) * force;
              node.vy += (dy / dist) * force;
            }
          });
        });

        networkData.links.forEach(link => {
          const source = nodes.find(n => n.id === link.source);
          const target = nodes.find(n => n.id === link.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - 150) * 0.006 * (link.weight / 10) * alpha;
            source.vx += (dx / dist) * force;
            source.vy += (dy / dist) * force;
            target.vx -= (dx / dist) * force;
            target.vy -= (dy / dist) * force;
          }
        });

        nodes.forEach(node => {
          node.vx *= 0.85;
          node.vy *= 0.85;
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(60, Math.min(width - 60, node.x));
          node.y = Math.max(60, Math.min(height - 60, node.y));
        });

        nodesRef.current = nodes;
        draw();
        animationId = requestAnimationFrame(simulate);
      } else {
        // Simulation done - final draw and stop
        simulationStopped = true;
        nodesRef.current = nodes;
        draw();
      }
    };

    simulate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [networkData, getConnectedNodes, hoveredNode, selectedNode, zoom, pan]);

  // Redraw on interaction changes (no simulation, just redraw)
  useEffect(() => {
    if (!canvasRef.current || networkData.nodes.length === 0 || nodesRef.current.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const nodes = nodesRef.current;
    
    const topNodeIds = new Set(
      [...nodes]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 10)
        .map(n => n.id)
    );
    
    const connectedToSelected = selectedNode ? getConnectedNodes(selectedNode) : null;

    ctx.save();
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw links
    networkData.links.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (source && target) {
        const isHighlighted = hoveredNode && (link.source === hoveredNode || link.target === hoveredNode);
        const isConnectedToSelected = connectedToSelected && 
          (connectedToSelected.has(link.source) && connectedToSelected.has(link.target));
        const isDimmed = selectedNode && !isConnectedToSelected;
        
        ctx.beginPath();
        ctx.lineWidth = isHighlighted ? Math.min(link.weight / 3, 5) : Math.min(link.weight / 5, 3);
        ctx.strokeStyle = isHighlighted ? 'rgba(88, 166, 255, 0.7)' : 
                          isDimmed ? 'rgba(88, 166, 255, 0.05)' : 'rgba(88, 166, 255, 0.2)';
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const radius = Math.max(12, Math.min(30, node.count / 1.5));
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const clusterIndex = networkData.nodeClusterMap.get(node.id) ?? 0;
      const baseColor = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length];
      const isDimmed = selectedNode && !connectedToSelected?.has(node.id);

      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, radius + 8);
        gradient.addColorStop(0, isSelected ? 'rgba(88, 166, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDimmed ? '#30363d' : isSelected ? '#58a6ff' : isHovered ? '#ffffff' : baseColor;
      ctx.globalAlpha = isDimmed ? 0.3 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSelected ? '#58a6ff' : '#30363d';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    });

    // Draw labels
    nodes.forEach(node => {
      const radius = Math.max(12, Math.min(30, node.count / 1.5));
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const isDimmed = selectedNode && !connectedToSelected?.has(node.id);
      const isTopNode = topNodeIds.has(node.id);
      const isConnected = connectedToSelected?.has(node.id);
      
      const showLabel = isHovered || isSelected || isConnected || (!selectedNode && isTopNode);
      
      if (showLabel && !isDimmed) {
        const labelY = node.y + radius + 14;
        const fontSize = isHovered || isSelected ? 14 : 12;
        ctx.font = `${isHovered || isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        
        let label = node.name;
        if (label.length > 20) label = label.substring(0, 18) + '…';
        
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.fillRect(node.x - textWidth / 2 - 4, labelY - 10, textWidth + 8, 14);
        ctx.fillStyle = isHovered || isSelected ? '#ffffff' : '#c9d1d9';
        ctx.fillText(label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [hoveredNode, selectedNode, zoom, pan, networkData, getConnectedNodes]);

  return (
    <div className="tag-network">
      <div className="network-header">
        <div className="network-header-left">
          <h3>🔗 Tag Co-occurrence Network</h3>
          <div className="network-description">
            <div className="description-section">
              <span className="description-label">📊 Analytics View:</span>
              <ul>
                <li>Visual clusters = related skill groups</li>
                <li>Larger nodes = more popular skills</li>
                <li>Lines = skills taught together</li>
              </ul>
            </div>
            <div className="description-section">
              <span className="description-label">💡 Use for:</span>
              <ul>
                <li>Spotting curriculum patterns</li>
                <li>Finding isolated topics</li>
                <li>Quick visual overview</li>
              </ul>
            </div>
          </div>
          <p className="network-hint">For detailed exploration with search/filter, use the Tags tab → Tag Graph</p>
        </div>
        <div className="network-controls">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} title="Zoom in">+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} title="Zoom out">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedNode(null); }} title="Reset view">⟳</button>
        </div>
      </div>

      <div className="network-canvas-container">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="network-canvas"
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); setTooltip(null); }}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? 'grabbing' : (hoveredNode ? 'pointer' : 'default') }}
        />
        
        {/* Tooltip */}
        {tooltip && (
          <div 
            className="network-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="tooltip-title">{tooltip.node.name}</div>
            <div className="tooltip-stat">
              <span className="tooltip-label">Occurrences:</span>
              <span className="tooltip-value">{tooltip.node.count}</span>
            </div>
            <div className="tooltip-stat">
              <span className="tooltip-label">Connections:</span>
              <span className="tooltip-value">{tooltip.node.connections}</span>
            </div>
            <div className="tooltip-stat">
              <span className="tooltip-label">Weight:</span>
              <span className="tooltip-value">{tooltip.node.weight.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>

      {networkData.clusters.length > 0 && (
        <div className="cluster-legend">
          <h4>Detected Clusters</h4>
          <div className="cluster-list">
            {networkData.clusters.slice(0, 5).map((cluster, i) => (
              <button
                key={i}
                className={`cluster-btn ${selectedCluster === i ? 'active' : ''}`}
                onClick={() => setSelectedCluster(selectedCluster === i ? null : i)}
                style={{ borderColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
              >
                <span className="cluster-color" style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
                {cluster.tags.slice(0, 3).join(', ')}
                <span className="cluster-size">({cluster.tags.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {networkData.nodes.length === 0 && (
        <div className="network-empty">
          <p>No tag co-occurrence data available.</p>
          <p className="hint">Tags need to appear together in courses to form connections.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Simple cluster detection using connected components
 */
function detectClusters(nodes, links) {
  const parent = new Map();
  nodes.forEach(n => parent.set(n.id, n.id));

  const find = (id) => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)));
    }
    return parent.get(id);
  };

  const union = (a, b) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  links.forEach(link => union(link.source, link.target));

  const clusters = new Map();
  nodes.forEach(node => {
    const root = find(node.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(node.name);
  });

  return [...clusters.values()]
    .filter(c => c.length > 2)
    .sort((a, b) => b.length - a.length)
    .map(tags => ({ tags }));
}

export default TagNetwork;
