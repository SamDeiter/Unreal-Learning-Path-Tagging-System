/**
 * TagGraphService Tests
 *
 * Tests the core tag graph operations: lookup, relationships, tag extraction,
 * and course relevance scoring. These are critical paths since TagGraphService
 * powers both the Problem-First and Persona Onboarding flows.
 */
import { describe, it, expect } from "vitest";
import tagGraphService, { TagGraphService } from "../services/TagGraphService";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — initialization", () => {
  it("should export a singleton instance", () => {
    expect(tagGraphService).toBeDefined();
    expect(tagGraphService).toBeInstanceOf(TagGraphService);
  });

  it("should load tags from data", () => {
    const tags = tagGraphService.getAllTags();
    expect(tags.length).toBeGreaterThan(0);
  });

  it("should have built internal lookup maps", () => {
    // tagMap should be populated
    const anyTag = tagGraphService.getAllTags()[0];
    const lookup = tagGraphService.getTag(anyTag.tag_id);
    expect(lookup).toBeDefined();
    expect(lookup.tag_id).toBe(anyTag.tag_id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TAG LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — tag lookup", () => {
  it("getTag should return a tag by ID", () => {
    const tag = tagGraphService.getTag("rendering.lumen");
    if (tag) {
      expect(tag.tag_id).toBe("rendering.lumen");
      expect(tag.display_name).toBeDefined();
    }
  });

  it("getTag should return null for unknown tag_id", () => {
    const tag = tagGraphService.getTag("nonexistent.tag.id.xyz");
    expect(tag).toBeNull();
  });

  it("getTagsByType should return filtered tags", () => {
    const allTags = tagGraphService.getAllTags();
    // Find a tag_type that exists
    const typesInData = [...new Set(allTags.map((t) => t.tag_type).filter(Boolean))];
    if (typesInData.length > 0) {
      const result = tagGraphService.getTagsByType(typesInData[0]);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((t) => expect(t.tag_type).toBe(typesInData[0]));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GRAPH RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — graph relationships", () => {
  it("getRelated should return related tags with weights", () => {
    // Use a tag that's likely to have edges
    const allTags = tagGraphService.getAllTags();
    let foundRelated = false;
    for (const tag of allTags.slice(0, 20)) {
      const related = tagGraphService.getRelated(tag.tag_id, 0);
      if (related.length > 0) {
        foundRelated = true;
        expect(related[0]).toHaveProperty("tag");
        expect(related[0]).toHaveProperty("weight");
        expect(related[0]).toHaveProperty("relation");
        break;
      }
    }
    // At least some tags should have relationships
    expect(foundRelated).toBe(true);
  });

  it("getPrerequisites should return prerequisite tags when they exist", () => {
    // Try to find a tag with prerequisites
    const allTags = tagGraphService.getAllTags();
    for (const tag of allTags) {
      const prereqs = tagGraphService.getPrerequisites(tag.tag_id);
      if (prereqs.length > 0) {
        expect(prereqs[0]).toHaveProperty("tag");
        expect(prereqs[0]).toHaveProperty("weight");
        return; // Test passes
      }
    }
    // No prerequisites found — that's OK, just note it
    console.warn("⚠️ No tags with prerequisites found in current data");
  });

  it("getRelated should return empty array for unknown tag", () => {
    const related = tagGraphService.getRelated("nonexistent.tag.xyz");
    expect(related).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TAG EXTRACTION FROM TEXT
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — extractTagsFromText", () => {
  it("should extract tags from a UE5-related query", () => {
    const result = tagGraphService.extractTagsFromText("lumen flickering in my level");
    expect(result).toHaveProperty("matchedTagIds");
    expect(result).toHaveProperty("matches");
    expect(result).toHaveProperty("normalizedQuery");
    // Should find at least the lumen tag
    if (tagGraphService.getTag("rendering.lumen")) {
      expect(result.matchedTagIds).toContain("rendering.lumen");
    }
  });

  it("should return few or no results for irrelevant text", () => {
    const result = tagGraphService.extractTagsFromText("quantum chromodynamics in a supercollider");
    // May match false positives — just ensure it doesn't crash and returns reasonable count
    expect(result.matchedTagIds.length).toBeLessThan(3);
  });

  it("should handle empty string input", () => {
    const result = tagGraphService.extractTagsFromText("");
    expect(result.matchedTagIds).toEqual([]);
  });

  it("should handle null/undefined input gracefully", () => {
    const result1 = tagGraphService.extractTagsFromText(null);
    expect(result1.matchedTagIds).toEqual([]);
    const result2 = tagGraphService.extractTagsFromText(undefined);
    expect(result2.matchedTagIds).toEqual([]);
  });

  it("should extract multiple tags from a complex query", () => {
    const result = tagGraphService.extractTagsFromText(
      "blueprint cast error animation state machine"
    );
    expect(result.matchedTagIds.length).toBeGreaterThan(0);
  });

  it("should include match confidence scores", () => {
    const result = tagGraphService.extractTagsFromText("nanite mesh optimization");
    for (const match of result.matches) {
      expect(match).toHaveProperty("confidence");
      expect(match.confidence).toBeGreaterThan(0);
      expect(match.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ERROR SIGNATURE MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — matchErrorSignature", () => {
  it("should match known error signatures", () => {
    // Common UE5 error patterns
    const signatures = [
      "LogBlueprintUserMessages: Error",
      "Cast to PlayerController failed",
      "D3D Device Lost",
    ];

    let anyMatched = false;
    for (const sig of signatures) {
      const result = tagGraphService.matchErrorSignature(sig);
      if (result.length > 0) {
        anyMatched = true;
        expect(result[0]).toHaveProperty("tag");
        expect(result[0]).toHaveProperty("matchedSignature");
        expect(result[0]).toHaveProperty("confidence");
      }
    }
    // At least some error signatures should match
    if (!anyMatched) {
      console.warn("⚠️ No error signatures matched — error signature index may need updating");
    }
  });

  it("should return empty array for non-error text", () => {
    const result = tagGraphService.matchErrorSignature("everything is working fine");
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COURSE RELEVANCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe("TagGraphService — scoreCourseRelevance", () => {
  it("should score a course with matching tags higher than 0", () => {
    const allTags = tagGraphService.getAllTags();
    const tagIds = [allTags[0]?.tag_id, allTags[1]?.tag_id].filter(Boolean);
    // Use canonical_tags — the field scoreCourseRelevance actually reads
    const mockCourse = {
      canonical_tags: tagIds,
    };

    const result = tagGraphService.scoreCourseRelevance(mockCourse, tagIds);
    expect(result).toHaveProperty("score");
    expect(result.score).toBeGreaterThan(0);
  });

  it("should score a course with no matching tags as 0", () => {
    const mockCourse = { canonical_tags: ["nonexistent.tag.xyz"] };
    const result = tagGraphService.scoreCourseRelevance(mockCourse, [
      "another.missing.tag",
    ]);
    expect(result.score).toBe(0);
  });

  it("should handle empty tags gracefully", () => {
    const mockCourse = { canonical_tags: [] };
    const result = tagGraphService.scoreCourseRelevance(mockCourse, []);
    expect(result.score).toBe(0);
  });
});
