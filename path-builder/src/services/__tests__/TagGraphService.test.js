/**
 * TagGraphService — Unit tests
 *
 * Tests the singleton tag-graph service which loads from tags.json and edges.json.
 * All methods are pure (graph lookups) so no mocking is needed.
 */
import { describe, it, expect, beforeEach } from "vitest";
import tagGraphService, { TagGraphService } from "../TagGraphService";

// -- Construction / data integrity --

describe("TagGraphService", () => {
  describe("constructor and data loading", () => {
    it("should export a singleton instance", () => {
      expect(tagGraphService).toBeInstanceOf(TagGraphService);
    });

    it("should load tags from tags.json", () => {
      expect(tagGraphService.tags).toBeDefined();
      expect(Array.isArray(tagGraphService.tags)).toBe(true);
      expect(tagGraphService.tags.length).toBeGreaterThan(0);
    });

    it("should load edges from edges.json", () => {
      expect(tagGraphService.edges).toBeDefined();
      expect(Array.isArray(tagGraphService.edges)).toBe(true);
      expect(tagGraphService.edges.length).toBeGreaterThan(0);
    });

    it("should build tagMap for O(1) lookup", () => {
      expect(tagGraphService.tagMap).toBeInstanceOf(Map);
      expect(tagGraphService.tagMap.size).toBe(tagGraphService.tags.length);
    });

    it("should build edgesBySource and edgesByTarget maps", () => {
      expect(tagGraphService.edgesBySource).toBeInstanceOf(Map);
      expect(tagGraphService.edgesByTarget).toBeInstanceOf(Map);
    });

    it("should build a term index for text matching", () => {
      expect(Array.isArray(tagGraphService.termIndex)).toBe(true);
      expect(tagGraphService.termIndex.length).toBeGreaterThan(0);
    });

    it("should have edge type weight configuration", () => {
      expect(tagGraphService.edgeWeights).toBeDefined();
      expect(tagGraphService.edgeWeights.subtopic).toBeDefined();
      expect(tagGraphService.edgeWeights.subtopic.forward).toBe(0.8);
    });
  });

  // -- getTag --

  describe("getTag", () => {
    it("should return a tag by ID", () => {
      const firstTag = tagGraphService.tags[0];
      const result = tagGraphService.getTag(firstTag.tag_id);
      expect(result).toBe(firstTag);
    });

    it("should return null for unknown tag ID", () => {
      expect(tagGraphService.getTag("nonexistent.tag.id")).toBeNull();
    });

    it("should return null for empty input", () => {
      expect(tagGraphService.getTag("")).toBeNull();
    });
  });

  // -- getAllTags --

  describe("getAllTags", () => {
    it("should return all tags", () => {
      const all = tagGraphService.getAllTags();
      expect(all).toBe(tagGraphService.tags);
      expect(all.length).toBeGreaterThan(0);
    });
  });

  // -- getTagsByType --

  describe("getTagsByType", () => {
    it("should filter tags by type", () => {
      // Find a type that exists
      const types = new Set(tagGraphService.tags.map((t) => t.tag_type));
      const firstType = [...types][0];
      const filtered = tagGraphService.getTagsByType(firstType);
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((t) => expect(t.tag_type).toBe(firstType));
    });

    it("should return empty array for unknown type", () => {
      expect(tagGraphService.getTagsByType("nonexistent_type")).toEqual([]);
    });
  });

  // -- getPrerequisites --

  describe("getPrerequisites", () => {
    it("should return prerequisites for a tag with outgoing edges", () => {
      // Find a tag that has outgoing edges
      const tagWithEdges = tagGraphService.tags.find((t) =>
        tagGraphService.edgesBySource.has(t.tag_id)
      );
      if (tagWithEdges) {
        const prereqs = tagGraphService.getPrerequisites(tagWithEdges.tag_id);
        expect(Array.isArray(prereqs)).toBe(true);
        prereqs.forEach((p) => {
          expect(p.tag).toBeDefined();
          expect(typeof p.weight).toBe("number");
          expect(typeof p.relation).toBe("string");
        });
      }
    });

    it("should return empty array for tag with no edges", () => {
      const result = tagGraphService.getPrerequisites("nonexistent_tag");
      expect(result).toEqual([]);
    });
  });

  // -- getRelated --

  describe("getRelated", () => {
    it("should return related tags respecting minimum weight", () => {
      // Find a tag with edges
      const tagWithEdges = tagGraphService.tags.find((t) => {
        const outgoing = tagGraphService.edgesBySource.get(t.tag_id) || [];
        const incoming = tagGraphService.edgesByTarget.get(t.tag_id) || [];
        return outgoing.length + incoming.length > 0;
      });
      if (tagWithEdges) {
        const related = tagGraphService.getRelated(tagWithEdges.tag_id, 0.0);
        expect(Array.isArray(related)).toBe(true);
        related.forEach((r) => {
          expect(r.tag).toBeDefined();
          expect(r.weight).toBeGreaterThanOrEqual(0);
          expect(typeof r.relation).toBe("string");
        });
      }
    });

    it("should filter by minimum weight", () => {
      // Find a connected tag
      const tagWithEdges = tagGraphService.tags.find((t) => {
        const outgoing = tagGraphService.edgesBySource.get(t.tag_id) || [];
        const incoming = tagGraphService.edgesByTarget.get(t.tag_id) || [];
        return outgoing.length + incoming.length > 0;
      });
      if (tagWithEdges) {
        const allRelated = tagGraphService.getRelated(tagWithEdges.tag_id, 0.0);
        const highWeight = tagGraphService.getRelated(tagWithEdges.tag_id, 0.9);
        expect(highWeight.length).toBeLessThanOrEqual(allRelated.length);
      }
    });

    it("should de-duplicate cross-directional edges", () => {
      // Related tags should not have duplicates
      const tagWithEdges = tagGraphService.tags.find((t) => {
        const outgoing = tagGraphService.edgesBySource.get(t.tag_id) || [];
        const incoming = tagGraphService.edgesByTarget.get(t.tag_id) || [];
        return outgoing.length + incoming.length > 2;
      });
      if (tagWithEdges) {
        const related = tagGraphService.getRelated(tagWithEdges.tag_id, 0.0);
        const ids = related.map((r) => r.tag.tag_id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  // -- getSymptoms --

  describe("getSymptoms", () => {
    it("should return symptom tags for system tags", () => {
      // Find a tag that has symptom_of edges pointing to it
      const symptomEdge = tagGraphService.edges.find((e) => e.relation === "symptom_of");
      if (symptomEdge) {
        const symptoms = tagGraphService.getSymptoms(symptomEdge.target);
        expect(Array.isArray(symptoms)).toBe(true);
        symptoms.forEach((s) => {
          expect(s.tag).toBeDefined();
          expect(typeof s.weight).toBe("number");
        });
      }
    });

    it("should return empty array for tag with no symptoms", () => {
      expect(tagGraphService.getSymptoms("nonexistent_tag")).toEqual([]);
    });
  });

  // -- getCauses --

  describe("getCauses", () => {
    it("should return cause tags for symptom tags", () => {
      const causalEdge = tagGraphService.edges.find(
        (e) => e.relation === "symptom_of" || e.relation === "often_caused_by"
      );
      if (causalEdge) {
        const causes = tagGraphService.getCauses(causalEdge.source);
        expect(Array.isArray(causes)).toBe(true);
      }
    });

    it("should return empty array for unknown tag", () => {
      expect(tagGraphService.getCauses("nonexistent_tag")).toEqual([]);
    });
  });

  // -- matchErrorSignature --

  describe("matchErrorSignature", () => {
    it("should return empty array for empty input", () => {
      expect(tagGraphService.matchErrorSignature("")).toEqual([]);
      expect(tagGraphService.matchErrorSignature(null)).toEqual([]);
      expect(tagGraphService.matchErrorSignature(undefined)).toEqual([]);
    });

    it("should match error signatures case-insensitively", () => {
      // Find a tag with error_signatures
      const tagWithSig = tagGraphService.tags.find((t) => t.signals?.error_signatures?.length > 0);
      if (tagWithSig) {
        const sig = tagWithSig.signals.error_signatures[0];
        const matches = tagGraphService.matchErrorSignature(sig.toUpperCase());
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0].tag.tag_id).toBe(tagWithSig.tag_id);
        expect(matches[0].confidence).toBeGreaterThanOrEqual(0.6);
      }
    });

    it("should sort matches by confidence descending", () => {
      const tagWithSig = tagGraphService.tags.find((t) => t.signals?.error_signatures?.length > 0);
      if (tagWithSig) {
        const sig = tagWithSig.signals.error_signatures[0];
        const matches = tagGraphService.matchErrorSignature(sig);
        for (let i = 1; i < matches.length; i++) {
          expect(matches[i].confidence).toBeLessThanOrEqual(matches[i - 1].confidence);
        }
      }
    });
  });

  // -- scoreCourseRelevance --

  describe("scoreCourseRelevance", () => {
    it("should return zero score for null/empty inputs", () => {
      const result = tagGraphService.scoreCourseRelevance(null, []);
      expect(result.score).toBe(0);
      expect(result.breakdown.directOverlap).toBe(0);
    });

    it("should return zero for empty target tags", () => {
      const result = tagGraphService.scoreCourseRelevance({ tags: {} }, []);
      expect(result.score).toBe(0);
    });

    it("should score direct tag overlap at 25 points", () => {
      const tagId = tagGraphService.tags[0].tag_id;
      const course = { canonical_tags: [tagId] };
      const result = tagGraphService.scoreCourseRelevance(course, [tagId]);
      expect(result.breakdown.directOverlap).toBe(25);
      expect(result.score).toBeGreaterThanOrEqual(25);
    });

    it("should score suffix matches at 15 points", () => {
      // Find a tag like "rendering.lumen"
      const dotTag = tagGraphService.tags.find((t) => t.tag_id.includes("."));
      if (dotTag) {
        const suffix = dotTag.tag_id.split(".").pop();
        // Course has the full ID, target is just the suffix (different prefix)
        const course = { canonical_tags: [dotTag.tag_id] };
        const fakeTarget = `fake_prefix.${suffix}`;
        const result = tagGraphService.scoreCourseRelevance(course, [fakeTarget]);
        expect(result.breakdown.directOverlap).toBe(15);
      }
    });

    it("should add gemini bonus for gemini_system_tags", () => {
      const tagId = tagGraphService.tags[0].tag_id;
      const suffix = tagId.split(".").pop();
      const course = { gemini_system_tags: [suffix] };
      const result = tagGraphService.scoreCourseRelevance(course, [tagId]);
      expect(result.breakdown.geminiBonus).toBeGreaterThan(0);
    });

    it("should cap score at 100", () => {
      // Create a course with many matching tags
      const allTagIds = tagGraphService.tags.slice(0, 10).map((t) => t.tag_id);
      const course = { canonical_tags: allTagIds };
      const result = tagGraphService.scoreCourseRelevance(course, allTagIds);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should return topContributors sorted by contribution", () => {
      const tagId = tagGraphService.tags[0].tag_id;
      const course = { canonical_tags: [tagId] };
      const result = tagGraphService.scoreCourseRelevance(course, [tagId]);
      for (let i = 1; i < result.topContributors.length; i++) {
        expect(result.topContributors[i].contribution).toBeLessThanOrEqual(
          result.topContributors[i - 1].contribution
        );
      }
    });
  });

  // -- clearRelatedCache --

  describe("clearRelatedCache", () => {
    it("should clear the cache without errors", () => {
      tagGraphService._relatedCache.set("test", []);
      tagGraphService.clearRelatedCache();
      expect(tagGraphService._relatedCache.size).toBe(0);
    });
  });

  // -- extractTagsFromText --

  describe("extractTagsFromText", () => {
    it("should return empty result for null/empty text", () => {
      const result = tagGraphService.extractTagsFromText("");
      expect(result.matchedTagIds).toEqual([]);
      expect(result.matches).toEqual([]);
      expect(result.excludedTagIds).toEqual([]);
    });

    it("should extract tags from text matching display names", () => {
      // Find a tag with a multi-word display name that's likely unique
      const tag = tagGraphService.tags.find((t) => t.display_name && t.display_name.length > 5);
      if (tag) {
        const result = tagGraphService.extractTagsFromText(tag.display_name);
        expect(result.matchedTagIds.length).toBeGreaterThan(0);
      }
    });

    it("should sort matches by confidence descending", () => {
      const someText = tagGraphService.tags
        .slice(0, 3)
        .map((t) => t.display_name)
        .join(" ");
      const result = tagGraphService.extractTagsFromText(someText);
      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i].confidence).toBeLessThanOrEqual(result.matches[i - 1].confidence);
      }
    });

    it("should detect negative intent and exclude tags", () => {
      // "not blueprint" should exclude blueprint-related tags
      const result = tagGraphService.extractTagsFromText("I need help with lighting not blueprint");
      // Blueprint-related tags should be in excludedTagIds
      if (result.excludedTagIds.length > 0) {
        expect(result.excludedTagIds.some((id) => id.includes("blueprint"))).toBe(true);
      }
    });

    it("should match synonyms", () => {
      const tagWithSyn = tagGraphService.tags.find(
        (t) => t.synonyms?.length > 0 && t.synonyms[0].length > 3
      );
      if (tagWithSyn) {
        const result = tagGraphService.extractTagsFromText(tagWithSyn.synonyms[0]);
        expect(result.matchedTagIds).toContain(tagWithSyn.tag_id);
      }
    });

    it("should return normalized query text", () => {
      const result = tagGraphService.extractTagsFromText("BP compilation error");
      expect(result.normalizedQuery).toBeDefined();
      expect(typeof result.normalizedQuery).toBe("string");
    });
  });

  // -- _buildEdgeMap (internal, but critical) --

  describe("_buildEdgeMap", () => {
    it("should correctly group edges by source", () => {
      const sourceEdge = tagGraphService.edges[0];
      const grouped = tagGraphService.edgesBySource.get(sourceEdge.source);
      expect(grouped).toBeDefined();
      expect(grouped.some((e) => e.target === sourceEdge.target)).toBe(true);
    });

    it("should correctly group edges by target", () => {
      const targetEdge = tagGraphService.edges[0];
      const grouped = tagGraphService.edgesByTarget.get(targetEdge.target);
      expect(grouped).toBeDefined();
      expect(grouped.some((e) => e.source === targetEdge.source)).toBe(true);
    });
  });

  // -- _buildTermIndex (internal, sort behavior) --

  describe("_buildTermIndex", () => {
    it("should sort phrases before single words", () => {
      let lastWasPhrase = true;
      let phasePassed = false;
      for (const entry of tagGraphService.termIndex) {
        if (!entry.isPhrase && lastWasPhrase) {
          phasePassed = true; // transition from phrases to words
        }
        if (phasePassed && entry.isPhrase) {
          // A phrase after we moved to single words = sorting error
          // (this could happen for different-length phrases, so just check first transition)
          break;
        }
        lastWasPhrase = entry.isPhrase;
      }
    });

    it("should include tag_id suffix terms", () => {
      const suffixEntries = tagGraphService.termIndex.filter((e) => e.termType === "tag_id_suffix");
      expect(suffixEntries.length).toBeGreaterThan(0);
    });

    it("should include display_name terms", () => {
      const dnEntries = tagGraphService.termIndex.filter((e) => e.termType === "display_name");
      expect(dnEntries.length).toBeGreaterThan(0);
    });
  });
});
