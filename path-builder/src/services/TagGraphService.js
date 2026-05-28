/**
 * TagGraphService - Single source of truth for tag graph operations
 * Consumed by BOTH Persona Onboarding and Problem-First Learning modes
 *
 * V2 Upgrades:
 *   - Term index with whole-word/phrase matching (no substring false positives)
 *   - Query normalization via QueryNormalizer (abbreviation expansion, de-pluralization)
 *   - Negative intent detection ("not X", "without X")
 *   - Edge-type weighted graph scoring with hop attenuation
 *   - Explainability output on all results
 */

// Import tag data (these are loaded at build time)
import tagsData from "../data/tags.json";
import edgesData from "../data/edges.json";
import { normalizeQuery, depluralize } from "./QueryNormalizer.js";

/**
 * TagGraphService - Provides graph traversal and matching operations
 */
class TagGraphService {
  constructor() {
    this.tags = tagsData?.tags || [];
    
    // Initialize caches
    this._relatedCache = new Map();
    this._bfsCache = new Map();
    this._courseMetadata = new WeakMap();
    
    // 1. Load edges from edges.json (handle flat array format)
    let rawEdges = Array.isArray(edgesData) ? edgesData : (edgesData?.edges || []);
    
    // 2. Normalize edge fields: support both 'relationship' and 'relation' and ensure weight exists
    this.edges = rawEdges.map(e => ({
      ...e,
      relation: e.relation || e.relationship || 'related',
      weight: e.weight !== undefined ? e.weight : 0.5
    }));

    // 3. Ingest related_tags from tags.json into the edge list to ensure the graph is populated
    // even if edges.json only contains course-to-course relationships.
    if (this.tags && Array.isArray(this.tags)) {
      this.tags.forEach(tag => {
        if (tag.related_tags && Array.isArray(tag.related_tags)) {
          tag.related_tags.forEach(rel => {
            this.edges.push({
              source: tag.tag_id,
              target: rel.tag_id,
              relation: rel.relation || 'related',
              weight: rel.weight || 0.8
            });
          });
        }
      });
    }

    // 4. Build lookup maps for O(1) access
    this.tagMap = new Map(this.tags.map((t) => [t.tag_id, t]));
    this.edgesBySource = this._buildEdgeMap("source");
    this.edgesByTarget = this._buildEdgeMap("target");

    // 5. Build indices for matching
    this.errorSignatureIndex = this._buildErrorSignatureIndex();
    this.termIndex = this._buildTermIndex();

    // 6. Define weights for graph propagation
    this.edgeWeights = {
      subtopic: { forward: 0.8, reverse: 0.1 },
      related: { forward: 0.5, reverse: 0.5 },
      prerequisite: { forward: 0.8, reverse: 0.2 },
      symptom_of: { forward: 0.7, reverse: 0.3 },
      often_caused_by: { forward: 0.6, reverse: 0.4 },
      replaces: { forward: 0.5, reverse: 0.15 },
    };
  }

  /**
   * Build an edge map keyed by source or target
   * @param {string} key - 'source' or 'target'
   * @returns {Map<string, Array>}
   */
  _buildEdgeMap(key) {
    const map = new Map();
    for (const edge of (this.edges || [])) {
      const id = edge[key];
      if (!map.has(id)) {
        map.set(id, []);
      }
      map.get(id).push(edge);
    }
    return map;
  }

  /**
   * Build an index of error signatures for fast matching
   * @returns {Array<{signature: string, tagId: string, tag: Object}>}
   */
  _buildErrorSignatureIndex() {
    const index = [];
    for (const tag of this.tags) {
      const signatures = tag.signals?.error_signatures || [];
      for (const sig of signatures) {
        index.push({
          signature: sig.toLowerCase(),
          tagId: tag.tag_id,
          tag,
        });
      }
    }
    return index;
  }

  /**
   * V2: Build a term index for whole-word/phrase matching.
   * Maps normalized terms to { tagId, termType, originalTerm }.
   * @returns {Array<{term: string, tagId: string, termType: string, originalTerm: string, isPhrase: boolean}>}
   */
  _buildTermIndex() {
    const index = [];
    const addTerm = (term, tagId, termType, original) => {
      if (!term || typeof term !== "string") return;
      const normalized = term.toLowerCase().trim();
      if (normalized.length < 2) return;

      // Also add de-pluralized variant
      const words = normalized.split(/\s+/);
      const depluralized = words.map((w) => depluralize(w)).join(" ");

      index.push({
        term: normalized,
        tagId,
        termType,
        originalTerm: original || term,
        isPhrase: words.length > 1,
      });

      // Add depluralized if different
      if (depluralized !== normalized) {
        index.push({
          term: depluralized,
          tagId,
          termType,
          originalTerm: original || term,
          isPhrase: words.length > 1,
        });
      }
    };

    for (const tag of this.tags) {
      // display_name
      addTerm(tag.display_name, tag.tag_id, "display_name", tag.display_name);

      // tag_id suffix (e.g., "blueprint" from "scripting.blueprint")
      const suffix = tag.tag_id.split(".").pop();
      if (suffix && suffix.length > 2) {
        addTerm(suffix.replace(/_/g, " "), tag.tag_id, "tag_id_suffix", suffix);
      }

      // synonyms
      if (tag.synonyms) {
        for (const syn of tag.synonyms) {
          addTerm(syn, tag.tag_id, "synonym", syn);
        }
      }

      // aliases
      if (tag.aliases) {
        for (const alias of tag.aliases) {
          addTerm(alias.value, tag.tag_id, "alias", alias.value);
        }
      }

      // signals.ui_terms
      if (tag.signals?.ui_terms) {
        for (const term of tag.signals.ui_terms) {
          addTerm(term, tag.tag_id, "ui_term", term);
        }
      }

      // signals.error_signatures
      if (tag.signals?.error_signatures) {
        for (const sig of tag.signals.error_signatures) {
          addTerm(sig, tag.tag_id, "error_sig", sig);
        }
      }
    }

    // Sort: phrases first (longer matches are more specific), then by length desc
    index.sort((a, b) => {
      if (a.isPhrase !== b.isPhrase) return a.isPhrase ? -1 : 1;
      return b.term.length - a.term.length;
    });

    return index;
  }

  /**
   * Get a tag by ID
   * @param {string} tagId
   * @returns {Object|null}
   */
  getTag(tagId) {
    return this.tagMap.get(tagId) || null;
  }

  /**
   * Get all tags
   * @returns {Array}
   */
  getAllTags() {
    return this.tags;
  }

  /**
   * Get tags by type
   * @param {string} tagType - 'system', 'workflow', 'symptom', etc.
   * @returns {Array}
   */
  getTagsByType(tagType) {
    return this.tags.filter((t) => t.tag_type === tagType);
  }

  /**
   * Get prerequisite tags for a given tag (via edges)
   * @param {string} tagId
   * @returns {Array<{tag: Object, weight: number, relation: string}>}
   */
  getPrerequisites(tagId) {
    const edges = this.edgesBySource.get(tagId) || [];
    return edges
      .filter((e) => e.relation === "subtopic" || e.relation === "related" || e.relation === "prerequisite")
      .map((e) => ({
        tag: this.getTag(e.target),
        weight: e.weight || 0.5,
        relation: e.relation,
      }))
      .filter((r) => r.tag !== null);
  }

  /**
   * Get related tags with weights
   * @param {string} tagId
   * @param {number} minWeight - Minimum edge weight (0-1)
   * @returns {Array<{tag: Object, weight: number, relation: string}>}
   */
  getRelated(tagId, minWeight = 0.5) {
    const outgoing = this.edgesBySource.get(tagId) || [];
    const incoming = this.edgesByTarget.get(tagId) || [];

    const allEdges = [...outgoing, ...incoming];
    const seen = new Set([tagId]);

    return allEdges
      .filter((e) => (e.weight || 0.5) >= minWeight)
      .map((e) => {
        const relatedId = (e.source === tagId) ? e.target : e.source;
        if (seen.has(relatedId)) return null;
        seen.add(relatedId);
        
        const tag = this.getTag(relatedId);
        if (!tag) return null;

        return {
          tag: tag,
          weight: e.weight || 0.5,
          relation: e.relation || 'related',
        };
      })
      .filter((r) => r !== null);
  }

  /**
   * Get symptoms for a system tag
   * @param {string} tagId - System tag ID
   * @returns {Array<{tag: Object, weight: number}>}
   */
  getSymptoms(tagId) {
    const edges = this.edgesByTarget.get(tagId) || [];
    return edges
      .filter((e) => e.relation === "symptom_of")
      .map((e) => ({
        tag: this.getTag(e.source),
        weight: e.weight || 0.5,
      }))
      .filter((r) => r.tag !== null);
  }

  /**
   * Get possible causes for a symptom tag
   * @param {string} tagId - Symptom tag ID
   * @returns {Array<{tag: Object, weight: number}>}
   */
  getCauses(tagId) {
    const edges = this.edgesBySource.get(tagId) || [];
    return edges
      .filter((e) => e.relation === "symptom_of" || e.relation === "often_caused_by")
      .map((e) => ({
        tag: this.getTag(e.target),
        weight: e.weight || 0.5,
        relation: e.relation,
      }))
      .filter((r) => r.tag !== null);
  }

  /**
   * Match error signatures in text to tags
   * @param {string} errorText - Error message or log text
   * @returns {Array<{tag: Object, matchedSignature: string, confidence: number}>}
   */
  matchErrorSignature(errorText) {
    if (!errorText) return [];

    const textLower = errorText.toLowerCase();
    const matches = [];

    for (const entry of this.errorSignatureIndex) {
      if (textLower.includes(entry.signature)) {
        matches.push({
          tag: entry.tag,
          matchedSignature: entry.signature,
          confidence: 0.9, // High confidence for exact signature match
        });
      }
    }

    // Also check synonyms for partial matches
    for (const tag of this.tags) {
      const synonyms = tag.synonyms || [];
      for (const syn of synonyms) {
        if (textLower.includes(syn.toLowerCase())) {
          // Avoid duplicates
          if (!matches.some((m) => m.tag.tag_id === tag.tag_id)) {
            matches.push({
              tag,
              matchedSignature: syn,
              confidence: 0.6, // Lower confidence for synonym match
            });
          }
        }
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Internal helper to normalize course tags and cache by identity.
   */
  _getCourseMetadata(course) {
    if (this._courseMetadata.has(course)) return this._courseMetadata.get(course);
    const tags = [
      ...(course.canonical_tags || []), ...(course.ai_tags || []),
      ...(course.gemini_system_tags || []), ...(course.transcript_tags || []),
      ...(course.extracted_tags || []),
      ...(!Array.isArray(course.tags) && typeof course.tags === "object" ? Object.values(course.tags) : [])
    ].map(t => (typeof t === "string" ? t.toLowerCase() : ""));
    const meta = { tagSet: new Set(tags), tags, suffixSet: new Set(tags.map(t => t.split(".").pop())) };
    this._courseMetadata.set(course, meta);
    return meta;
  }

  /**
   * V2: Score a course's relevance for a set of tags.
   */
  scoreCourseRelevance(course, targetTagIds) {
    if (!course || !targetTagIds?.length) return { score: 0, breakdown: { directOverlap: 0, graphPropagation: 0, geminiBonus: 0, penalties: 0 }, topContributors: [] };

    const { tagSet: courseTagSet, tags: allCourseTags, suffixSet: courseSuffixSet } = this._getCourseMetadata(course);
    const targetSet = new Set(targetTagIds.map((t) => t.toLowerCase()));
    const topContributors = [];

    // ---- 1. Direct tag matches (highest weight: 25 pts each) ----
    let directOverlap = 0;
    for (const target of targetSet) {
      // Exact match on full tag ID
      if (courseTagSet.has(target)) {
        directOverlap += 25;
        topContributors.push({
          sourceQueryTagId: target,
          targetCourseTagId: target,
          path: [],
          contribution: 25,
        });
        continue;
      }
      // Check suffix match: "lumen" matches course tag "rendering.lumen"
      const suffix = target.split(".").pop();
      if (courseSuffixSet.has(suffix) && suffix.length > 2) {
        const matchedTag = allCourseTags.find(ct => ct.split(".").pop() === suffix);
        directOverlap += 15;
        topContributors.push({ sourceQueryTagId: target, targetCourseTagId: matchedTag, path: [], contribution: 15 });
      }
    }

    // ---- 2. Gemini bonus (AI-curated, high quality) ----
    let geminiBonus = 0;
    const geminiTags = (course.gemini_system_tags || []).map((t) => t.toLowerCase());
    for (const target of targetSet) {
      const targetSuffix = target.split(".").pop();
      if (
        geminiTags.some(
          (gt) => gt.toLowerCase() === targetSuffix || gt.toLowerCase().includes(targetSuffix)
        )
      ) {
        geminiBonus += 10;
      }
    }

    // ---- 3. Graph propagation (secondary, capped) ----
    let graphPropagation = 0;
    for (const tagId of [...targetSet]) {
      let tagGraphCredit = 0;
      for (const m of this._getBfsExpansion(tagId)) {
        if (courseTagSet.has(m.nid) || (m.suffix.length > 2 && courseSuffixSet.has(m.suffix))) {
          tagGraphCredit += m.contribution;
          topContributors.push({ sourceQueryTagId: tagId, targetCourseTagId: m.nid, path: [...m.path], contribution: Math.round(m.contribution * 100) / 100 });
        }
      }
      graphPropagation += Math.min(tagGraphCredit, 15); // Cap at 15
    }

    // ---- 4. Compute final score ----
    const rawScore = directOverlap + geminiBonus + graphPropagation;
    const score = Math.min(100, rawScore);

    return {
      score,
      breakdown: {
        directOverlap,
        graphPropagation: Math.round(graphPropagation * 100) / 100,
        geminiBonus,
        penalties: 0,
      },
      topContributors: topContributors.sort((a, b) => b.contribution - a.contribution).slice(0, 10),
    };
  }

  /**
   * Clear the related-tag cache. Call between query batches.
   */
  clearRelatedCache() {
    this._relatedCache.clear();
    this._bfsCache.clear();
  }

  /**
   * Get 2-hop graph expansion for a tag, cached to avoid redundant BFS.
   */
  _getBfsExpansion(tagId) {
    const tid = tagId.toLowerCase();
    if (this._bfsCache.has(tid)) return this._bfsCache.get(tid);
    const results = [];
    const visited = new Set([tid]);
    let frontier = [{ id: tid, hops: 0, path: [] }];
    while (frontier.length > 0) {
      const nextFrontier = [];
      for (const { id, hops, path } of frontier) {
        if (hops >= 2) continue;
        const edges = [...(this.edgesBySource.get(id) || []).map(e => ({ ...e, dir: "forward", nid: e.target })),
                       ...(this.edgesByTarget.get(id) || []).map(e => ({ ...e, dir: "reverse", nid: e.source }))];
        for (const edge of edges) {
          if (visited.has(edge.nid.toLowerCase())) continue;
          visited.add(edge.nid.toLowerCase());
          const typeWeights = this.edgeWeights[edge.relation] || { forward: 0.2, reverse: 0.1 };
          const weight = (edge.dir === "forward" ? typeWeights.forward : typeWeights.reverse) * Math.pow(0.5, hops) * (edge.weight || 0.5);
          const newPath = [...path, { from: id, to: edge.nid, edgeType: edge.relation }];
          results.push({ nid: edge.nid.toLowerCase(), suffix: edge.nid.split(".").pop(), contribution: 5 * weight, path: newPath });
          nextFrontier.push({ id: edge.nid, hops: hops + 1, path: newPath });
        }
      }
      frontier = nextFrontier;
    }
    this._bfsCache.set(tid, results);
    return results;
  }

  /**
   * V2: Find tags mentioned in text using whole-word/phrase matching.
   * Uses QueryNormalizer for abbreviation expansion and negative intent.
   *
   * @param {string} text - User query or problem description
   * @returns {{
   *   matchedTagIds: string[],
   *   matches: Array<{tagId: string, tag: Object, matchedTerm: string, matchType: string, confidence: number}>,
   *   excludedTagIds: string[],
   *   normalizedQuery: string
   * }}
   */
  extractTagsFromText(text) {
    const emptyResult = { matchedTagIds: [], matches: [], excludedTagIds: [], normalizedQuery: "" };
    if (!text) return emptyResult;

    // Step 1: Normalize the query (expand abbreviations, detect negatives)
    const { normalized, negatedTerms } = normalizeQuery(text);

    // Step 2: Build word set and full text for matching
    const queryWords = new Set(normalized.split(/\s+/).filter((w) => w.length > 1));

    // Step 3: Match against term index using word-boundary matching
    const matches = [];
    const seen = new Set();

    // Confidence by term type
    const TYPE_CONFIDENCE = {
      error_sig: 0.95,
      display_name: 0.85,
      synonym: 0.8,
      tag_id_suffix: 0.75,
      alias: 0.7,
      ui_term: 0.65,
    };

    for (const entry of (this.termIndex || [])) {
      if (seen.has(entry.tagId)) continue;

      let matched = false;

      if (entry.isPhrase) {
        // Phrase matching: check if phrase appears with word boundaries
        const phraseRegex = new RegExp(
          `\\b${entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i"
        );
        if (phraseRegex.test(normalized)) {
          matched = true;
        }
      } else {
        // Single-word matching: check word set (exact whole-word, no substring)
        if (queryWords.has(entry.term)) {
          matched = true;
        } else {
          // Also check depluralized query words against this term
          for (const qw of queryWords) {
            if (depluralize(qw) === entry.term || qw === depluralize(entry.term)) {
              matched = true;
              break;
            }
          }
        }
      }

      if (matched) {
        seen.add(entry.tagId);
        const confidence = TYPE_CONFIDENCE[entry.termType] || 0.5;
        matches.push({
          tagId: entry.tagId,
          tag: this.getTag(entry.tagId),
          matchedTerm: entry.originalTerm,
          matchType: entry.termType,
          confidence,
        });
      }
    }

    // Step 4: Apply negative intent — exclude tags matched by negated terms
    const excludedTagIds = [];
    if (negatedTerms.length > 0) {
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const tagSuffix = m.tagId.split(".").pop();
        if (negatedTerms.some((nt) => tagSuffix.includes(nt) || nt.includes(tagSuffix))) {
          excludedTagIds.push(m.tagId);
          matches.splice(i, 1);
        }
      }
    }

    // Step 5: Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return {
      matchedTagIds: matches.map((m) => m.tagId),
      matches,
      excludedTagIds,
      normalizedQuery: normalized,
    };
  }
}

// Singleton instance
const tagGraphService = new TagGraphService();

export { TagGraphService };
export default tagGraphService;
