/**
 * TagGraphService - Single source of truth for tag graph operations
 * Consumed by BOTH Persona Onboarding and Problem-First Learning modes
 */

// Import tag data (these are loaded at build time)
import tagsData from "../data/tags.json";
import edgesData from "../data/edges.json";

/**
 * TagGraphService - Provides graph traversal and matching operations
 */
class TagGraphService {
  constructor() {
    this.tags = tagsData?.tags || [];
    this.edges = edgesData?.edges || [];

    // Build lookup maps for O(1) access
    this.tagMap = new Map(this.tags.map((t) => [t.tag_id, t]));
    this.edgesBySource = this._buildEdgeMap("source");
    this.edgesByTarget = this._buildEdgeMap("target");

    // Build error signature index for fast matching
    this.errorSignatureIndex = this._buildErrorSignatureIndex();
  }

  /**
   * Build an edge map keyed by source or target
   * @param {string} key - 'source' or 'target'
   * @returns {Map<string, Array>}
   */
  _buildEdgeMap(key) {
    const map = new Map();
    for (const edge of this.edges) {
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
      .filter((e) => e.relation === "subtopic" || e.relation === "related")
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
    const seen = new Set();

    return allEdges
      .filter((e) => e.weight >= minWeight)
      .map((e) => {
        const relatedId = e.source === tagId ? e.target : e.source;
        if (seen.has(relatedId)) return null;
        seen.add(relatedId);
        return {
          tag: this.getTag(relatedId),
          weight: e.weight,
          relation: e.relation,
        };
      })
      .filter((r) => r !== null && r.tag !== null);
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
   * Score a course's relevance for a set of tags
   * @param {Object} course - Course object with tags array
   * @param {string[]} targetTagIds - Tag IDs to match against
   * @returns {number} Relevance score (0-100)
   */
  scoreCourseRelevance(course, targetTagIds) {
    if (!course || !targetTagIds || targetTagIds.length === 0) return 0;

    // Combine ALL tag sources from the enriched video library
    const allCourseTags = [
      ...(Array.isArray(course.canonical_tags) ? course.canonical_tags : []),
      ...(Array.isArray(course.ai_tags) ? course.ai_tags : []),
      ...(Array.isArray(course.gemini_system_tags) ? course.gemini_system_tags : []),
      ...(Array.isArray(course.transcript_tags) ? course.transcript_tags : []),
      ...(Array.isArray(course.extracted_tags) ? course.extracted_tags : []),
    ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));

    // Also include the legacy tags object fields
    if (course.tags && typeof course.tags === "object" && !Array.isArray(course.tags)) {
      Object.values(course.tags).forEach((v) => {
        if (typeof v === "string") allCourseTags.push(v.toLowerCase());
      });
    }

    let score = 0;
    const targetSet = new Set(targetTagIds.map((t) => t.toLowerCase()));

    // Direct tag matches (highest weight)
    for (const courseTag of allCourseTags) {
      if (targetSet.has(courseTag)) {
        score += 25; // Strong exact match
      }

      // Check for partial matches (e.g., 'lumen' matches 'rendering.lumen')
      for (const target of targetSet) {
        if (courseTag.includes(target) || target.includes(courseTag)) {
          score += 10;
        }
      }
    }

    // Bonus for gemini_system_tags matches (AI-curated, high quality)
    const geminiTags = (course.gemini_system_tags || []).map((t) => t.toLowerCase());
    for (const target of targetSet) {
      if (geminiTags.some((gt) => gt.includes(target) || target.includes(gt))) {
        score += 15; // Gemini tags are curated - bonus
      }
    }

    // Check related tags (indirect relevance)
    for (const tagId of targetTagIds) {
      const related = this.getRelated(tagId, 0.6);
      for (const rel of related) {
        const relTagId = rel.tag?.tag_id?.toLowerCase() || "";
        if (allCourseTags.some((ct) => ct.includes(relTagId.split(".").pop()))) {
          score += 5 * rel.weight;
        }
      }
    }

    // Normalize to 0-100
    return Math.min(100, score);
  }

  /**
   * Find tags mentioned in text (for intent extraction)
   * @param {string} text
   * @returns {Array<{tag: Object, confidence: number}>}
   */
  extractTagsFromText(text) {
    if (!text) return [];

    const textLower = text.toLowerCase();
    const matches = [];
    const seen = new Set();

    // Check error signatures first (highest priority)
    const errorMatches = this.matchErrorSignature(text);
    for (const m of errorMatches) {
      if (!seen.has(m.tag.tag_id)) {
        seen.add(m.tag.tag_id);
        matches.push({ tag: m.tag, confidence: m.confidence });
      }
    }

    // Check display names and synonyms
    for (const tag of this.tags) {
      if (seen.has(tag.tag_id)) continue;

      const displayLower = tag.display_name.toLowerCase();
      if (textLower.includes(displayLower)) {
        seen.add(tag.tag_id);
        matches.push({ tag, confidence: 0.8 });
        continue;
      }

      // Check UI terms
      const uiTerms = tag.signals?.ui_terms || [];
      for (const term of uiTerms) {
        if (textLower.includes(term.toLowerCase())) {
          if (!seen.has(tag.tag_id)) {
            seen.add(tag.tag_id);
            matches.push({ tag, confidence: 0.7 });
          }
          break;
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

// Singleton instance
const tagGraphService = new TagGraphService();

export { TagGraphService };
export default tagGraphService;
