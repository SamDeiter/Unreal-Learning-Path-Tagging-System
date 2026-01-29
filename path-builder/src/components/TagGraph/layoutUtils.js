/**
 * Resolves node collisions using an iterative spatial hash approach.
 *
 * @param {Array} nodes - Array of Cytoscape nodes to process
 * @param {Object} options - Configuration options
 * @param {number} options.padding - Padding around nodes (default: 10)
 * @param {number} options.maxIterations - Maximum iterations (default: 50)
 * @param {number} options.gridSize - Spatial hash cell size (default: 100)
 * @param {number} options.stiffness - Spring stiffness for returning to origin (default: 0.1)
 * @param {boolean} options.useLabels - Whether to include labels in bounding box (default: true)
 * @returns {Object} Map of node IDs to new positions { id: {x, y} }
 */
export function resolveCollisions(nodes, options = {}) {
  const {
    padding = 20,
    maxIterations = 50,
    gridSize = 200,
    stiffness = 0.05,
    useLabels = true,
  } = options;

  // 1. Initialize State
  // Store initial positions to calculate restoring force
  const nodeState = nodes.map((node) => {
    const pos = node.position();
    const bb = node.boundingBox({ includeLabels: useLabels });
    return {
      id: node.id(),
      node: node,
      x: pos.x,
      y: pos.y,
      originalX: pos.x,
      originalY: pos.y,
      width: bb.w,
      height: bb.h,
      halfWidth: bb.w / 2 + padding,
      halfHeight: bb.h / 2 + padding,
      locked: node.locked(),
      mass: 1, // Could be based on size
    };
  });

  // 2. Iteration Loop
  for (let iter = 0; iter < maxIterations; iter++) {
    let maxDisplacement = 0;

    // Spatial Hash
    const grid = new Map();

    // Populate Grid
    nodeState.forEach((n, index) => {
      // Determine grid cells the node overlaps
      const startX = Math.floor((n.x - n.halfWidth) / gridSize);
      const endX = Math.floor((n.x + n.halfWidth) / gridSize);
      const startY = Math.floor((n.y - n.halfHeight) / gridSize);
      const endY = Math.floor((n.y + n.halfHeight) / gridSize);

      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          const key = `${x},${y}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(index);
        }
      }
    });

    // Detect and Resolve Collisions
    const visitedPairs = new Set();

    nodeState.forEach((n1, i) => {
      if (n1.locked) return;

      const startX = Math.floor((n1.x - n1.halfWidth) / gridSize);
      const endX = Math.floor((n1.x + n1.halfWidth) / gridSize);
      const startY = Math.floor((n1.y - n1.halfHeight) / gridSize);
      const endY = Math.floor((n1.y + n1.halfHeight) / gridSize);

      // Check all neighbors in relevant grid cells
      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          const cell = grid.get(`${x},${y}`);
          if (!cell) continue;

          for (const j of cell) {
            if (i >= j) continue; // Avoid self and duplicates

            const pairKey = `${i}-${j}`;
            if (visitedPairs.has(pairKey)) continue;
            visitedPairs.add(pairKey);

            const n2 = nodeState[j];

            // AABB Collision Detection
            let dx = n1.x - n2.x;
            let dy = n1.y - n2.y;

            // Handle exact overlap (jitter)
            if (dx === 0 && dy === 0) {
              dx = Math.random() - 0.5 || 0.01;
              dy = Math.random() - 0.5 || 0.01;
            }
            const combinedHalfWidth = n1.halfWidth + n2.halfWidth;
            const combinedHalfHeight = n1.halfHeight + n2.halfHeight;

            if (Math.abs(dx) < combinedHalfWidth && Math.abs(dy) < combinedHalfHeight) {
              // Collision detected!

              // Calculate overlap
              const overlapX = combinedHalfWidth - Math.abs(dx);
              const overlapY = combinedHalfHeight - Math.abs(dy);

              // Resolve along axis of least penetration
              let moveX = 0;
              let moveY = 0;

              if (overlapX < overlapY) {
                moveX = dx > 0 ? overlapX : -overlapX;
              } else {
                moveY = dy > 0 ? overlapY : -overlapY;
              }

              // Apply displacement
              // Split equally if both movable, or full if one locked
              if (!n2.locked) {
                n1.x += moveX * 0.5;
                n1.y += moveY * 0.5;
                n2.x -= moveX * 0.5;
                n2.y -= moveY * 0.5;
              } else {
                n1.x += moveX;
                n1.y += moveY;
              }

              maxDisplacement = Math.max(maxDisplacement, Math.abs(moveX), Math.abs(moveY));
            }
          }
        }
      }

      // Apply restoring force (Spring back to original layout)
      // This prevents the graph from exploding outward too much
      if (!n1.locked) {
        const distFromOrigX = n1.originalX - n1.x;
        const distFromOrigY = n1.originalY - n1.y;

        n1.x += distFromOrigX * stiffness;
        n1.y += distFromOrigY * stiffness;
      }
    });

    // Early exit if unified
    if (maxDisplacement < 1) break;
  }

  // Return new positions
  const positions = {};
  nodeState.forEach((n) => {
    positions[n.id] = { x: n.x, y: n.y };
  });

  return positions;
}
