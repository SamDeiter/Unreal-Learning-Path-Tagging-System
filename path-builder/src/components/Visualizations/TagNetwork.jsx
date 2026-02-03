import { useMemo, useState, useRef, useEffect } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './TagNetwork.css';

/**
 * Tag Co-occurrence Network
 * Force-directed graph showing which tags appear together
 * Reveals hidden skill clusters
 */
function TagNetwork() {
  const { edges, enrichedTags } = useTagData();
  const canvasRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [hoveredNode] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Build network data from edges
  const networkData = useMemo(() => {
    if (!edges || edges.length === 0) {
      return { nodes: [], links: [], clusters: [] };
    }

    // Get top tags by connection weight
    const tagWeights = new Map();
    edges.forEach(edge => {
      tagWeights.set(edge.sourceTagId, (tagWeights.get(edge.sourceTagId) || 0) + edge.weight);
      tagWeights.set(edge.targetTagId, (tagWeights.get(edge.targetTagId) || 0) + edge.weight);
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

    return { nodes, links, clusters };
  }, [edges, enrichedTags]);

  // Simple force simulation
  useEffect(() => {
    if (!canvasRef.current || networkData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let nodes = [...networkData.nodes];
    let animationId;

    const simulate = () => {
      // Apply forces
      nodes.forEach(node => {
        // Center gravity
        node.vx += (width / 2 - node.x) * 0.001;
        node.vy += (height / 2 - node.y) * 0.001;

        // Repulsion from other nodes
        nodes.forEach(other => {
          if (node.id !== other.id) {
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 500 / (dist * dist);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        });
      });

      // Links attraction
      networkData.links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 100) * 0.01 * (link.weight / 10);
          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        }
      });

      // Apply velocity and damping
      nodes.forEach(node => {
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        // Bounds
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });

      // Draw
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, width, height);

      // Draw links
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.2)';
      networkData.links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.lineWidth = Math.min(link.weight / 5, 3);
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const radius = Math.max(8, Math.min(20, node.count / 2));
        const isHovered = hoveredNode === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#58a6ff' : '#238636';
        ctx.fill();
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#c9d1d9';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + radius + 14);
      });

      animationId = requestAnimationFrame(simulate);
    };

    simulate();

    return () => cancelAnimationFrame(animationId);
  }, [networkData, hoveredNode]);

  return (
    <div className="tag-network">
      <div className="network-header">
        <div className="network-header-left">
          <h3>🔗 Tag Co-occurrence Network</h3>
          <p className="network-hint">Tags that appear together cluster. Click clusters to explore.</p>
        </div>
        <div className="network-controls">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} title="Zoom in">+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} title="Zoom out">−</button>
        </div>
      </div>

      <div className="network-canvas-container" style={{ transform: `scale(${zoom})` }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="network-canvas"
        />
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
              >
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
