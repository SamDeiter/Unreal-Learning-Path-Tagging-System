/**
 * prerequisiteGraph.js — Prerequisite Graph & Topological Ordering
 *
 * Builds a DAG of course prerequisites from tag metadata
 * and returns a topologically-sorted ordering for the learning path.
 *
 * Also detects cycles and provides a dependency-depth metric.
 */

// ── Graph Construction ─────────────────────────────────────────────

/**
 * Build a prerequisite adjacency list from courses.
 * Each course can declare prerequisites via:
 *   - course.gemini_enriched.prerequisites (array of course codes)
 *   - course.tags.prerequisites (comma-separated string)
 *
 * @param {Array} courses — Course objects
 * @returns {Map<string, Set<string>>} — code → Set of prerequisite codes
 */
export function buildPrerequisiteGraph(courses) {
  const graph = new Map();
  const codeSet = new Set(courses.map((c) => c.code));

  courses.forEach((c) => {
    if (!graph.has(c.code)) graph.set(c.code, new Set());

    // Source 1: Gemini-enriched prerequisites
    const enrichedPrereqs = c.gemini_enriched?.prerequisites || [];
    enrichedPrereqs.forEach((p) => {
      if (codeSet.has(p) && p !== c.code) {
        graph.get(c.code).add(p);
      }
    });

    // Source 2: Tag-based prerequisites (comma-separated)
    const tagPrereqs = (c.tags?.prerequisites || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    tagPrereqs.forEach((p) => {
      if (codeSet.has(p) && p !== c.code) {
        graph.get(c.code).add(p);
      }
    });
  });

  return graph;
}

// ── Cycle Detection ────────────────────────────────────────────────

/**
 * Detect if the prerequisite graph contains cycles.
 *
 * @param {Map} graph — Adjacency list from buildPrerequisiteGraph
 * @returns {{ hasCycle: boolean, cycleNodes: string[] }}
 */
export function detectCycles(graph) {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map();
  const cycleNodes = [];

  graph.forEach((_deps, node) => color.set(node, WHITE));

  function dfs(node) {
    color.set(node, GRAY);
    const deps = graph.get(node) || new Set();
    for (const dep of deps) {
      if (color.get(dep) === GRAY) {
        cycleNodes.push(dep, node);
        return true;
      }
      if (color.get(dep) === WHITE && dfs(dep)) {
        return true;
      }
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE && dfs(node)) {
      return { hasCycle: true, cycleNodes: [...new Set(cycleNodes)] };
    }
  }

  return { hasCycle: false, cycleNodes: [] };
}

// ── Topological Sort ───────────────────────────────────────────────

/**
 * Topologically sort courses by prerequisites (Kahn's algorithm).
 * Handles cycles gracefully by appending remaining nodes at the end.
 *
 * @param {Array} courses — Course objects to sort
 * @param {Map} [graph] — Optional pre-built graph; built if not provided
 * @returns {Array} — Courses in prerequisite-first order
 */
export function topologicalSort(courses, graph) {
  if (courses.length <= 1) return [...courses];

  const adjList = graph || buildPrerequisiteGraph(courses);
  const codeMap = new Map(courses.map((c) => [c.code, c]));

  // Calculate in-degrees
  const inDegree = new Map();
  adjList.forEach((_deps, node) => inDegree.set(node, 0));
  adjList.forEach((deps) => {
    deps.forEach((dep) => {
      // dep is a prerequisite of `node`, so node depends on dep
      // We want dep before node — so node has an incoming edge
    });
  });

  // Rebuild in-degree: for each node, its dependencies are prerequisites
  // A node's in-degree = number of its prerequisites
  adjList.forEach((deps, node) => {
    inDegree.set(node, deps.size);
  });

  // Queue starts with nodes that have no prerequisites
  const queue = [];
  inDegree.forEach((deg, node) => {
    if (deg === 0) queue.push(node);
  });

  // Process in BFS order
  const sorted = [];
  const visited = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);
    visited.add(node);

    // Find nodes that depend on this one (this node is their prerequisite)
    adjList.forEach((deps, dependent) => {
      if (deps.has(node) && !visited.has(dependent)) {
        const newDeg = inDegree.get(dependent) - 1;
        inDegree.set(dependent, newDeg);
        if (newDeg === 0) queue.push(dependent);
      }
    });
  }

  // Append any remaining (cyclic) nodes
  adjList.forEach((_deps, node) => {
    if (!visited.has(node)) sorted.push(node);
  });

  // Map sorted codes back to course objects
  return sorted.filter((code) => codeMap.has(code)).map((code) => codeMap.get(code));
}

// ── Depth Calculation ──────────────────────────────────────────────

/**
 * Calculate the maximum dependency depth for each course.
 * Depth 0 = no prerequisites. Depth 1 = has prerequisites that are depth 0.
 *
 * @param {Map} graph — Adjacency list
 * @returns {Map<string, number>} — code → depth
 */
export function calculateDepths(graph) {
  const depths = new Map();
  const memo = new Map();

  function getDepth(node) {
    if (memo.has(node)) return memo.get(node);

    memo.set(node, -1); // Cycle guard
    const deps = graph.get(node) || new Set();
    let maxDep = 0;

    for (const dep of deps) {
      const d = getDepth(dep);
      if (d >= 0) maxDep = Math.max(maxDep, d + 1);
    }

    memo.set(node, maxDep);
    depths.set(node, maxDep);
    return maxDep;
  }

  graph.forEach((_deps, node) => getDepth(node));
  return depths;
}
