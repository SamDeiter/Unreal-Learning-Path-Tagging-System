/**
 * Docs Search Service - Search Epic UE5 documentation passages
 * Uses Firestore vector KNN via vectorSearchDocs Cloud Function.
 *
 * Semantic search delegates to server-side Firestore findNearest().
 * Topic-aware search still uses local doc_links.json.
 */

import { devLog, devWarn } from "../utils/logger";
import { stemMatch, getStems, stemMatchStems } from "../utils/stemmer";
import { fetchJSON } from "./dataLoader";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";

// ── Vertex AI Search (Cloud Function proxy) ────────────────────────────────

/**
 * Search official UE5 docs via Vertex AI Search (Discovery Engine).
 * Calls the searchVertexAIDocs Cloud Function which proxies to the data store.
 *
 * @param {string} query - User's natural-language query
 * @param {number} [pageSize=5] - Max results
 * @returns {Promise<{results: Array, summary: string, citations: Array, references: Array}>}
 */
export async function searchDocsVertexAI(query, pageSize = 5) {
  if (!query || query.trim().length === 0) {
    return { results: [], summary: "", citations: [], references: [] };
  }

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const searchFn = httpsCallable(functions, "searchVertexAIDocs");

    const result = await searchFn({ query: query.trim(), pageSize });

    if (result.data?.success) {
      devLog(
        `[VertexAI] ${result.data.results?.length || 0} doc results, summary: ${result.data.summary ? "yes" : "no"}`
      );
      return {
        results: result.data.results || [],
        summary: result.data.summary || "",
        citations: result.data.citations || [],
        references: result.data.references || [],
      };
    }

    devWarn("[VertexAI] Search returned unsuccessful:", result.data);
    return { results: [], summary: "", citations: [], references: [] };
  } catch (err) {
    devWarn("[VertexAI] Search failed:", err.message);
    return { results: [], summary: "", citations: [], references: [] };
  }
}

// Lazy-loaded (4.8MB quantized) — REMOVED, now served via Firestore

/**
 * Search Epic UE5 documentation by semantic similarity.
 * Delegates to vectorSearchDocs Cloud Function (Firestore KNN).
 *
 * @param {number[]|Float32Array} queryEmbedding - Query vector
 * @param {number} topK - Max results (default 5)
 * @param {number} _threshold - Unused, server handles ranking
 * @returns {Promise<Array<{id, slug, url, title, section, text, similarity}>>}
 */
export async function searchDocsSemantic(queryEmbedding, topK = 5, _threshold = 0.35) {
  if (!queryEmbedding) return [];

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const searchFn = httpsCallable(functions, "vectorSearchDocs");

    const queryVector = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);

    const result = await searchFn({ queryVector, topK });

    if (result.data?.results) {
      devLog(`[DocsSearch] ${result.data.results.length} results via Firestore KNN`);
      return result.data.results.map((r) => ({
        id: r.id,
        slug: r.slug || "",
        url: r.url || "",
        title: r.title || "",
        section: r.section || "",
        previewText: r.text || "",
        similarity: r.similarity || 0,
        source: "epic_docs",
      }));
    }
    return [];
  } catch (err) {
    devWarn("[DocsSearch] vectorSearchDocs failed:", err.message);
    return [];
  }
}

// ── Topic-Aware Doc Lookup (uses expanded doc_links.json) ──

let _docLinks = null;

/**
 * Lazily load doc_links.json from public/data/.
 * Optimizes doc search performance by pre-calculating and caching lowercased and stemmed fields.
 */
async function getDocLinks() {
  if (_docLinks) return _docLinks;
  try {
    const rawDocs = await fetchJSON("doc_links");
    _docLinks = {};
    for (const [key, doc] of Object.entries(rawDocs)) {
      const keyLower = key.toLowerCase().replace(/[-_]/g, " ");
      const labelLower = (doc.label || "").toLowerCase();
      // Extract slug from URL for matching: "https://...unreal-engine/blueprints-visual-scripting" → "blueprints visual scripting"
      const urlSlug = (doc.url || "").split("/").pop().replace(/-/g, " ").toLowerCase();
      // UDN tags array (e.g., ["optimization", "performance", "rendering"])
      const docTags = (doc.tags || []).map((t) => t.toLowerCase());
      const descLower = (doc.description || "").toLowerCase();

      // Pre-calculate stems to completely avoid O(N*M) redundant string parsing in matching loops
      const keyStems = getStems(keyLower);
      const labelStems = getStems(labelLower);
      const tagStems = docTags.flatMap((t) => getStems(t));
      const descStems = getStems(descLower);

      _docLinks[key] = {
        ...doc,
        _keyLower: keyLower,
        _labelLower: labelLower,
        _urlSlug: urlSlug,
        _docTags: docTags,
        _descLower: descLower,
        _keyStems: keyStems,
        _labelStems: labelStems,
        _tagStems: tagStems,
        _descStems: descStems,
      };
    }
    return _docLinks;
  } catch (err) {
    devWarn("⚠️ doc_links.json not available:", err.message);
    return {};
  }
}

/** Tier sort order: beginner → intermediate → advanced */
const TIER_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

// stemWord and stemMatch are now imported from ../utils/stemmer at top of file

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
  // Pre-calculate stems for user topics outside the loop to avoid redundant tokenization
  const topicStems = topicSet.map((t) => getStems(t));
  const results = [];

  for (const [key, doc] of Object.entries(docLinks)) {
    const tierOrder = TIER_ORDER[doc.tier] ?? 1;
    if (tierOrder > maxTierOrder) continue;

    // Score: how well does this doc match the requested topics?
    let score = 0;
    const {
      _keyLower: keyLower,
      _labelLower: labelLower,
      _urlSlug: urlSlug,
      _docTags: docTags,
      _descLower: descLower,
      _keyStems: keyStems,
      _labelStems: labelStems,
      _tagStems: tagStems,
      _descStems: descStems,
    } = doc;

    // Track which distinct topics matched this doc
    let matchedTopicCount = 0;
    for (let i = 0; i < topicSet.length; i++) {
      const topic = topicSet[i];
      const tStems = topicStems[i];
      let matched = false;

      // Priority 1: Key matches (what the doc IS about)
      if (keyLower === topic) {
        score += 15;
        matched = true;
      } else if (keyLower.includes(topic)) {
        score += 8;
        matched = true;
      } else if (topic.includes(keyLower)) {
        score += 6;
        matched = true;
      }
      // Priority 2: Label/subsystem matches (the doc's title)
      else if (doc.subsystem === topic) {
        score += 5;
        matched = true;
      } else if (labelLower.includes(topic)) {
        score += 6;
        matched = true;
      }
      // Priority 3: Tag matches (often noisy/inherited — lower weight)
      else if (docTags.includes(topic)) {
        score += 2;
        matched = true;
      } else if (docTags.some((t) => t.includes(topic) || topic.includes(t))) {
        score += 1;
        matched = true;
      }
      // Priority 4: URL slug and description matches
      else if (urlSlug.includes(topic)) {
        score += 2;
        matched = true;
      } else if (descLower.includes(topic)) {
        score += 1;
        matched = true;
      }
      // Stem-aware fallback: "mesh" ↔ "meshes", "import" ↔ "importing"
      else if (stemMatchStems(tStems, keyStems)) {
        score += 4;
        matched = true;
      } else if (stemMatchStems(tStems, labelStems)) {
        score += 3;
        matched = true;
      } else if (stemMatchStems(tStems, tagStems)) {
        score += 1;
        matched = true;
      } else if (stemMatchStems(tStems, descStems)) {
        score += 1;
        matched = true;
      }
      if (matched) matchedTopicCount++;
    }

    // Multi-topic diversity bonus: docs matching multiple query concepts are far more relevant
    if (matchedTopicCount >= 2) score += matchedTopicCount * 5;

    // Require minimum score of 3 — filters single-keyword description/tag matches (score 1-2)
    // that produce irrelevant results for vague queries
    if (score >= 3) {
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

  // Deduplicate near-identical docs (e.g. "Mesh Distance Fields" + "Mesh Distance Fields Properties")
  const deduped = [];
  for (const doc of results) {
    const docWords = new Set(doc.key.split(/[-_]+/).filter((w) => w.length > 2));
    const isDupe = deduped.some((existing) => {
      const existWords = new Set(existing.key.split(/[-_]+/).filter((w) => w.length > 2));
      const overlap = [...docWords].filter((w) => existWords.has(w)).length;
      return overlap / Math.min(docWords.size, existWords.size) > 0.6;
    });
    if (!isDupe) deduped.push(doc);
  }

  // Normalize scores to 0–100 range for UI match badges
  const maxScore = deduped.length > 0 ? deduped[0]._score : 1;
  return deduped.slice(0, limit).map(({ _score, ...rest }) => ({
    ...rest,
    _rawScore: _score,
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

  // Build maps of matchScore and rawScore by key for later lookup
  const scoreMap = new Map(matches.map((m) => [m.key, m.matchScore ?? 0]));
  const rawScoreMap = new Map(matches.map((m) => [m.key, m._rawScore ?? 0]));

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
      _rawScore: rawScoreMap.get(key) ?? 0,
      source: "epic_docs",
    });
  }

  // Process each match
  for (const match of matches) {
    addWithPrereqs(match.key);
  }

  // Sort by raw relevance score (highest first) for reliable differentiation
  ordered.sort((a, b) => (b._rawScore ?? 0) - (a._rawScore ?? 0));

  return ordered.slice(0, limit);
}

export default {
  searchDocsSemantic,
  searchDocsVertexAI,
  getDocsForTopic,
  getDocReadingPath,
};
