/**
 * Docs Search Service - Search Epic UE5 documentation passages
 * Uses pre-computed embeddings from scrape_epic_docs.py (docs_embeddings.json)
 *
 * Follows the same lazy-loading + float16 decoding pattern as segmentSearchService.
 */

import { cosineSimilarity } from "./semanticSearchService";

import { devLog, devWarn } from "../utils/logger";

// Lazy-loaded (4.8MB quantized)
let _docsEmbeddings = null;
let _decodedVectors = null;

/**
 * Decode a base64-encoded float16 vector to Float32Array.
 */
function decodeFloat16Vector(b64, dim = 768) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const result = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    const half = view.getUint16(i * 2, true);
    result[i] = float16ToFloat32(half);
  }
  return result;
}

function float16ToFloat32(half) {
  const sign = (half >> 15) & 0x1;
  const exponent = (half >> 10) & 0x1f;
  const mantissa = half & 0x3ff;

  if (exponent === 0) {
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mantissa / 1024);
  } else if (exponent === 31) {
    return mantissa ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
}

/**
 * Lazily load and decode doc embeddings.
 */
async function getDocsEmbeddings() {
  if (_decodedVectors) return _decodedVectors;

  if (!_docsEmbeddings) {
    try {
      // Use fetch() instead of import() — Vite resolves import() at build time,
      // which fails in CI where this optional file doesn't exist.
      const resp = await fetch(new URL("../data/docs_embeddings.json", import.meta.url));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      _docsEmbeddings = await resp.json();
    } catch (err) {
      devWarn("⚠️ docs_embeddings.json not available:", err.message);
      return null;
    }
  }

  const docs = _docsEmbeddings?.docs;
  if (!docs) return null;

  _decodedVectors = new Map();
  for (const [id, doc] of Object.entries(docs)) {
    _decodedVectors.set(id, {
      vector: decodeFloat16Vector(doc.embedding),
      slug: doc.slug,
      url: doc.url,
      title: doc.title,
      section: doc.section,
      text: doc.text,
      tokenEstimate: doc.token_estimate,
    });
  }

  devLog(`[DocsSearch] Decoded ${_decodedVectors.size} doc embeddings`);
  return _decodedVectors;
}

/**
 * Search Epic UE5 documentation by semantic similarity.
 *
 * @param {number[]|Float32Array} queryEmbedding - 768-dim query vector
 * @param {number} topK - Max results (default 5)
 * @param {number} threshold - Min similarity (default 0.35)
 * @returns {Promise<Array<{id, slug, url, title, section, text, similarity}>>}
 */
export async function searchDocsSemantic(queryEmbedding, topK = 5, threshold = 0.35) {
  if (!queryEmbedding) return [];

  const embeddings = await getDocsEmbeddings();
  if (!embeddings) {
    devWarn("[DocsSearch] Semantic search unavailable — no embeddings loaded");
    return [];
  }

  const results = [];
  for (const [id, doc] of embeddings) {
    const similarity = cosineSimilarity(queryEmbedding, doc.vector);
    if (similarity >= threshold) {
      results.push({
        id,
        slug: doc.slug,
        url: doc.url,
        title: doc.title,
        section: doc.section,
        previewText: doc.text,
        similarity,
        source: "epic_docs",
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

// ── Topic-Aware Doc Lookup (uses expanded doc_links.json) ──

let _docLinks = null;

/**
 * Lazily load doc_links.json.
 */
async function getDocLinks() {
  if (_docLinks) return _docLinks;
  try {
    const mod = await import("../data/doc_links.json");
    _docLinks = mod.default || mod;
    return _docLinks;
  } catch (err) {
    devWarn("⚠️ doc_links.json not available:", err.message);
    return {};
  }
}

/** Tier sort order: beginner → intermediate → advanced */
const TIER_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Simple stemmer for fuzzy matching — strips common English suffixes.
 * e.g. "meshes" → "mesh", "importing" → "import"
 */
function stemWord(word) {
  return word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(es|s|ing|ed|tion|ment)$/i, "")
    .toLowerCase();
}

/** Check if any stemmed word in `a` matches any stemmed word in `b`. */
function stemMatch(a, b) {
  const aStems = a.split(/[\s_-]+/).filter(w => w.length > 2).map(stemWord);
  const bStems = b.split(/[\s_-]+/).filter(w => w.length > 2).map(stemWord);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}

/**
 * Get doc links matching a set of topics/keywords.
 * Matches against subsystem, key name, label, tags, URL slug, and description.
 * Uses stemming so "mesh" matches "meshes", "import" matches "importing", etc.
 *
 * @param {string[]} topics - Topic keywords (e.g., ["lumen", "lighting"])
 * @param {Object} [options]
 * @param {string} [options.maxTier] - Max difficulty tier to include ("beginner"|"intermediate"|"advanced")
 * @param {number} [options.limit] - Max results (default 10)
 * @returns {Promise<Array<{key, label, url, tier, subsystem, readTimeMinutes}>>}
 */
export async function getDocsForTopic(topics, { maxTier = "advanced", limit = 10 } = {}) {
  const docLinks = await getDocLinks();
  if (!docLinks || !topics?.length) return [];

  const maxTierOrder = TIER_ORDER[maxTier] ?? 2;
  const topicSet = topics.map((t) => t.toLowerCase());
  const results = [];

  for (const [key, doc] of Object.entries(docLinks)) {
    const tierOrder = TIER_ORDER[doc.tier] ?? 1;
    if (tierOrder > maxTierOrder) continue;

    // Score: how well does this doc match the requested topics?
    let score = 0;
    const keyLower = key.toLowerCase();
    const labelLower = (doc.label || "").toLowerCase();
    // Extract slug from URL for matching: "https://...unreal-engine/blueprints-visual-scripting" → "blueprints visual scripting"
    const urlSlug = (doc.url || "").split("/").pop().replace(/-/g, " ").toLowerCase();
    // UDN tags array (e.g., ["optimization", "performance", "rendering"])
    const docTags = (doc.tags || []).map((t) => t.toLowerCase());
    const descLower = (doc.description || "").toLowerCase();

    for (const topic of topicSet) {
      if (keyLower === topic) score += 10;             // exact key match
      else if (keyLower.includes(topic)) score += 5;   // partial key match
      else if (topic.includes(keyLower)) score += 4;   // reverse: topic word contains the key
      else if (doc.subsystem === topic) score += 4;    // subsystem match
      else if (docTags.includes(topic)) score += 4;    // UDN tag exact match
      else if (labelLower.includes(topic)) score += 3; // label match
      else if (docTags.some((t) => t.includes(topic) || topic.includes(t))) score += 2; // partial tag match
      else if (urlSlug.includes(topic)) score += 2;    // URL slug match
      else if (descLower.includes(topic)) score += 1;  // description match
      // Stem-aware fallback: "mesh" ↔ "meshes", "import" ↔ "importing"
      else if (stemMatch(topic, keyLower)) score += 3;
      else if (docTags.some((t) => stemMatch(topic, t))) score += 2;
      else if (stemMatch(topic, labelLower)) score += 2;
      else if (stemMatch(topic, descLower)) score += 1;
    }

    if (score > 0) {
      results.push({
        key,
        label: doc.label,
        description: doc.description || "",
        url: doc.url,
        tier: doc.tier,
        subsystem: doc.subsystem,
        readTimeMinutes: doc.readTimeMinutes || 10,
        prerequisites: doc.prerequisites || [],
        sections: doc.sections || [],
        keySteps: doc.keySteps || [],
        seeAlso: doc.seeAlso || [],
        _score: score,
        source: "epic_docs",
      });
    }
  }

  // Sort: highest relevance first, then by tier (beginner first)
  results.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return (TIER_ORDER[a.tier] ?? 1) - (TIER_ORDER[b.tier] ?? 1);
  });

  // Normalize scores to 0–100 range for UI match badges
  const maxScore = results.length > 0 ? results[0]._score : 1;
  return results.slice(0, limit).map(({ _score, ...rest }) => ({
    ...rest,
    matchScore: Math.round((_score / Math.max(maxScore, 1)) * 100),
  }));
}

/**
 * Build a prerequisite-ordered reading path for given topics.
 * Resolves prerequisites recursively so the learner reads foundational
 * docs before advanced ones.
 *
 * @param {string[]} topics - Topic keywords
 * @param {Object} [options]
 * @param {number} [options.limit] - Max results (default 8)
 * @returns {Promise<Array<{key, label, url, tier, subsystem, readTimeMinutes}>>}
 */
export async function getDocReadingPath(topics, { limit = 8 } = {}) {
  const docLinks = await getDocLinks();
  if (!docLinks) return [];

  // Get matching docs (now includes matchScore)
  const matches = await getDocsForTopic(topics, { limit: limit * 2 });
  if (!matches.length) return [];

  // Build a map of matchScore by key for later lookup
  const scoreMap = new Map(matches.map((m) => [m.key, m.matchScore ?? 0]));

  // Collect all prerequisite keys
  const needed = new Set();
  const ordered = [];

  function addWithPrereqs(key) {
    if (needed.has(key)) return;
    needed.add(key);

    const doc = docLinks[key];
    if (!doc) return;

    // Add prerequisites first (recursive)
    for (const prereq of doc.prerequisites || []) {
      addWithPrereqs(prereq);
    }

    ordered.push({
      key,
      label: doc.label,
      description: doc.description || "",
      keySteps: doc.keySteps || [],
      seeAlso: doc.seeAlso || [],
      url: doc.url,
      tier: doc.tier,
      subsystem: doc.subsystem,
      readTimeMinutes: doc.readTimeMinutes || 10,
      matchScore: scoreMap.get(key) ?? 0,
      source: "epic_docs",
    });
  }

  // Process each match
  for (const match of matches) {
    addWithPrereqs(match.key);
  }

  return ordered.slice(0, limit);
}

export default {
  searchDocsSemantic,
  getDocsForTopic,
  getDocReadingPath,
};
