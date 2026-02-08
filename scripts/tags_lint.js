/**
 * tags_lint.js — Lints tag data for quality issues beyond schema validity.
 *
 * Checks:
 *   1. Duplicate tag_id values
 *   2. Missing descriptions
 *   3. Deprecated tags without replacedBy edge
 *   4. Orphan tags (not referenced by any edge)
 *   5. Prerequisite cycles (via edges)
 *   6. Related tags pointing to non-existent tag_ids
 *   7. Duplicate edges
 *
 * Usage:
 *   node scripts/tags_lint.js
 *
 * Exits 0 if clean, 1 if warnings found.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TAGS_PATH = path.join(ROOT, "tags", "tags.json");
const EDGES_PATH = path.join(ROOT, "tags", "edges.json");

/**
 * Lint tags and edges for quality issues.
 * @param {Object} tagsData - Parsed tags.json
 * @param {Object} edgesData - Parsed edges.json
 * @returns {{ warnings: string[], info: string[] }}
 */
function lintTags(tagsData, edgesData) {
  const warnings = [];
  const info = [];
  const tags = tagsData.tags || [];
  const edges = edgesData.edges || [];
  const tagMap = new Map();

  // ---- 1. Duplicate tag_id ----
  const seenIds = new Set();
  for (const tag of tags) {
    if (seenIds.has(tag.tag_id)) {
      warnings.push(`DUPLICATE: tag_id '${tag.tag_id}' appears more than once`);
    }
    seenIds.add(tag.tag_id);
    tagMap.set(tag.tag_id, tag);
  }

  // ---- 2. Missing description ----
  for (const tag of tags) {
    if (!tag.description || tag.description.trim() === "") {
      warnings.push(`MISSING_DESC: '${tag.tag_id}' has no description`);
    }
  }

  // ---- 3. Deprecated without replacement ----
  const deprecatedTags = tags.filter((t) => t.governance?.status === "deprecated");
  const replacesEdges = edges.filter((e) => e.relation === "replaces");
  const replacedSet = new Set(replacesEdges.map((e) => e.source));

  for (const tag of deprecatedTags) {
    if (!replacedSet.has(tag.tag_id)) {
      warnings.push(
        `DEPRECATED_NO_REPLACEMENT: '${tag.tag_id}' is deprecated but has no 'replaces' edge`
      );
    }
  }

  // ---- 4. Orphan tags (not in any edge) ----
  const edgeTagIds = new Set();
  for (const edge of edges) {
    edgeTagIds.add(edge.source);
    edgeTagIds.add(edge.target);
  }
  // Also include tags referenced in related_tags
  for (const tag of tags) {
    if (tag.related_tags) {
      for (const rt of tag.related_tags) {
        edgeTagIds.add(rt.tag_id);
      }
    }
  }

  const orphans = tags.filter((t) => !edgeTagIds.has(t.tag_id));
  for (const orphan of orphans) {
    info.push(`ORPHAN: '${orphan.tag_id}' is not referenced by any edge or related_tag`);
  }

  // ---- 5. Prerequisite / subtopic cycles ----
  const adjList = new Map();
  for (const edge of edges) {
    if (edge.relation === "subtopic" || edge.relation === "replaces") {
      if (!adjList.has(edge.source)) adjList.set(edge.source, []);
      adjList.get(edge.source).push(edge.target);
    }
  }

  function hasCycle(startNode) {
    const visited = new Set();
    const stack = [startNode];
    while (stack.length > 0) {
      const node = stack.pop();
      if (visited.has(node)) return node;
      visited.add(node);
      const neighbors = adjList.get(node) || [];
      for (const n of neighbors) {
        if (n === startNode) return startNode;
        stack.push(n);
      }
    }
    return null;
  }

  for (const node of adjList.keys()) {
    const cycleNode = hasCycle(node);
    if (cycleNode) {
      warnings.push(`CYCLE: detected cycle involving '${node}' → '${cycleNode}'`);
    }
  }

  // ---- 6. Dangling references ----
  for (const tag of tags) {
    if (tag.related_tags) {
      for (const rt of tag.related_tags) {
        if (!tagMap.has(rt.tag_id)) {
          warnings.push(
            `DANGLING_REF: '${tag.tag_id}' references non-existent tag '${rt.tag_id}' in related_tags`
          );
        }
      }
    }
  }

  for (const edge of edges) {
    if (!tagMap.has(edge.source)) {
      warnings.push(`DANGLING_EDGE: edge source '${edge.source}' not found in tags`);
    }
    if (!tagMap.has(edge.target)) {
      warnings.push(`DANGLING_EDGE: edge target '${edge.target}' not found in tags`);
    }
  }

  // ---- 7. Duplicate edges ----
  const edgeKeys = new Set();
  for (const edge of edges) {
    const key = `${edge.source}→${edge.target}:${edge.relation}`;
    if (edgeKeys.has(key)) {
      warnings.push(`DUPLICATE_EDGE: '${key}' appears more than once`);
    }
    edgeKeys.add(key);
  }

  return { warnings, info };
}

// ---- CLI ----
if (require.main === module) {
  console.log("🧹 Linting tag data quality...\n");

  if (!fs.existsSync(TAGS_PATH)) {
    console.error(`❌ Tags file not found: ${TAGS_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(EDGES_PATH)) {
    console.error(`❌ Edges file not found: ${EDGES_PATH}`);
    process.exit(1);
  }

  const tagsData = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
  const edgesData = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));

  const result = lintTags(tagsData, edgesData);

  if (result.info.length > 0) {
    console.log(`ℹ️  ${result.info.length} info notice(s):`);
    result.info.forEach((i) => console.log(`  • ${i}`));
    console.log("");
  }

  if (result.warnings.length === 0) {
    console.log(
      `✅ Clean — ${tagsData.tags.length} tags, ${edgesData.edges.length} edges, no quality issues\n`
    );
    process.exit(0);
  } else {
    console.error(`⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach((w) => console.error(`  • ${w}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = { lintTags };
