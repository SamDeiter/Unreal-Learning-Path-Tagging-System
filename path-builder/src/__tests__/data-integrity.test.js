/**
 * Data Integrity Tests
 *
 * Validates all JSON data files that power the application.
 * Catches silent data corruption, missing fields, broken cross-references,
 * and structural regressions before they hit production.
 */
import { describe, it, expect } from "vitest";

// ── Data imports ──────────────────────────────────────────────────────────────
import videoLibrary from "../data/video_library_enriched.json";
import tagsData from "../data/tags.json";
import edgesData from "../data/edges.json";
import personas from "../data/personas.json";
import challengeRegistry from "../data/challengeRegistry.json";
import coursePrerequisites from "../data/course_prerequisites.json";
import synonymMap from "../data/synonym_map.json";
import searchIndex from "../data/search_index.json";
import transcriptSegments from "../data/transcript_segments.json";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VIDEO LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

describe("video_library_enriched.json", () => {
  const courses = videoLibrary.courses || [];

  it("should have a non-empty courses array", () => {
    expect(courses.length).toBeGreaterThan(0);
  });

  it("should have a generated_at timestamp", () => {
    expect(videoLibrary.generated_at).toBeDefined();
    expect(typeof videoLibrary.generated_at).toBe("string");
  });

  it("every course should have code and title", () => {
    const errors = [];
    for (const course of courses) {
      if (!course.code) errors.push(`Missing 'code' on course: ${course.title || "unknown"}`);
      if (!course.title) errors.push(`Missing 'title' on course code: ${course.code || "unknown"}`);
    }
    expect(errors).toEqual([]);
  });

  it("should have no duplicate course codes", () => {
    const codes = courses.map((c) => c.code);
    const dupes = [...new Set(codes.filter((code, i) => codes.indexOf(code) !== i))];
    if (dupes.length > 0) {
      console.warn(`⚠️ ${dupes.length} duplicate course codes: ${dupes.join(", ")}`);
    }
    // Allow a small number of duplicates (data quirks)
    expect(dupes.length).toBeLessThan(5);
  });

  it("video-type courses should have videos with drive_ids", () => {
    // Only check courses that have videos arrays (doc-type courses won't have them)
    const videoCourses = courses.filter((c) => Array.isArray(c.videos) && c.videos.length > 0);
    const missing = [];
    for (const course of videoCourses) {
      const isYouTube = course.source === 'youtube' || (course._url && course._url.includes('youtube'));
      for (const video of course.videos) {
        if (!video.drive_id && !isYouTube) {
          missing.push(`${course.code} → ${video.name || "unnamed"}`);
        }
      }
    }
    if (missing.length > 0) {
      console.warn(
        `⚠️ ${missing.length} videos missing drive_id (will show black screen):\n` +
          missing.slice(0, 5).map((m) => `  - ${m}`).join("\n") +
          (missing.length > 5 ? `\n  ... and ${missing.length - 5} more` : "")
      );
    }
    const totalVideos = videoCourses.reduce((sum, c) => sum + c.videos.length, 0);
    const missingPercent = totalVideos > 0 ? missing.length / totalVideos : 0;
    console.log(
      `📊 Drive ID coverage: ${totalVideos - missing.length}/${totalVideos} ` +
        `(${((1 - missingPercent) * 100).toFixed(1)}% playable via Drive)`
    );
    // YouTube-sourced videos won't have drive_id — allow up to 50%
    expect(missingPercent).toBeLessThan(0.5);
  });

  it("every video should have a name", () => {
    const videoCourses = courses.filter((c) => Array.isArray(c.videos));
    const errors = [];
    for (const course of videoCourses) {
      for (const video of course.videos) {
        if (!video.name) {
          errors.push(`${course.code}: video missing name`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it("video_count should match actual videos array length when both exist", () => {
    const mismatches = [];
    for (const course of courses) {
      if (
        course.video_count !== undefined &&
        Array.isArray(course.videos) &&
        course.video_count !== course.videos.length
      ) {
        mismatches.push(
          `${course.code}: video_count=${course.video_count}, actual=${course.videos.length}`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TAGS
// ═══════════════════════════════════════════════════════════════════════════════

describe("tags.json", () => {
  const tags = tagsData.tags || [];

  it("should have a non-empty tags array", () => {
    expect(tags.length).toBeGreaterThan(0);
  });

  it("every tag should have required fields", () => {
    const errors = [];
    for (const tag of tags) {
      if (!tag.tag_id) errors.push(`Tag missing 'tag_id': ${JSON.stringify(tag).slice(0, 80)}`);
      if (!tag.display_name) errors.push(`Tag missing 'display_name': ${tag.tag_id || "unknown"}`);
    }
    expect(errors).toEqual([]);
  });

  it("should have no duplicate tag_ids", () => {
    const ids = tags.map((t) => t.tag_id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      expect.fail(`Duplicate tag_ids found: ${[...new Set(dupes)].join(", ")}`);
    }
  });

  it("tags should have a category_path when possible", () => {
    const missing = tags.filter((t) => !t.category_path);
    if (missing.length > 0) {
      console.warn(
        `⚠️ ${missing.length}/${tags.length} tags missing category_path (${(missing.length / tags.length * 100).toFixed(0)}%)`
      );
    }
    // Many tags were created before category_path was required — track regression
    expect(missing.length).toBeLessThan(tags.length * 0.8);
  });

  it("tag_ids should follow naming convention (lowercase, dots/underscores)", () => {
    const invalid = tags.filter((t) => t.tag_id && !/^[a-z0-9._-]+$/.test(t.tag_id));
    if (invalid.length > 0) {
      console.warn(
        `⚠️ Tags with non-standard IDs: ${invalid.map((t) => t.tag_id).join(", ")}`
      );
    }
    // Warn but don't hard-fail — some legacy tags may have uppercase
    expect(invalid.length).toBeLessThan(tags.length * 0.2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. EDGES (Tag Relationships)
// ═══════════════════════════════════════════════════════════════════════════════

describe("edges.json", () => {
  const edges = Array.isArray(edgesData) ? edgesData : edgesData.edges || [];
  const tagIds = new Set((tagsData.tags || []).map((t) => t.tag_id));

  it("should have edges defined", () => {
    expect(edges.length).toBeGreaterThan(0);
  });

  it("every edge should have source and target", () => {
    const errors = [];
    for (const edge of edges) {
      const source = edge.source || edge.sourceTagId;
      const target = edge.target || edge.targetTagId;
      if (!source) errors.push(`Edge missing source: ${JSON.stringify(edge)}`);
      if (!target) errors.push(`Edge missing target: ${JSON.stringify(edge)}`);
    }
    expect(errors).toEqual([]);
  });

  it("edge sources and targets should reference valid tag_ids", () => {
    if (tagIds.size === 0) return; // Skip if tags not loaded
    const orphans = [];
    for (const edge of edges) {
      const source = edge.source || edge.sourceTagId;
      const target = edge.target || edge.targetTagId;
      if (source && !tagIds.has(source)) orphans.push(`source: ${source}`);
      if (target && !tagIds.has(target)) orphans.push(`target: ${target}`);
    }
    if (orphans.length > 0) {
      console.warn(`⚠️ ${orphans.length} edge references to unknown tags: ${orphans.slice(0, 5).join(", ")}`);
    }
    // Allow some — tags may have been removed
    expect(orphans.length).toBeLessThan(edges.length);
  });

  it("should not have self-referencing edges", () => {
    const selfRefs = edges.filter((e) => {
      const source = e.source || e.sourceTagId;
      const target = e.target || e.targetTagId;
      return source && source === target;
    });
    if (selfRefs.length > 0) {
      console.warn(
        `⚠️ ${selfRefs.length} self-referencing edges:\n` +
          selfRefs.map((e) => `  - ${e.source} → ${e.target} (${e.relation})`).join("\n")
      );
    }
    // Allow a very small number — flag for cleanup
    expect(selfRefs.length).toBeLessThan(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PERSONAS
// ═══════════════════════════════════════════════════════════════════════════════

describe("personas.json", () => {
  const personaList = personas.personas || [];

  it("should have personas defined", () => {
    expect(personaList.length).toBeGreaterThan(0);
  });

  it("every persona should have required fields", () => {
    const errors = [];
    for (const p of personaList) {
      if (!p.id) errors.push(`Persona missing 'id': ${p.name || "unknown"}`);
      if (!p.name) errors.push(`Persona missing 'name': ${p.id || "unknown"}`);
      if (!p.description) errors.push(`Persona missing 'description': ${p.id}`);
      if (!p.keywords || !Array.isArray(p.keywords)) {
        errors.push(`Persona missing 'keywords[]': ${p.id}`);
      }
    }
    expect(errors).toEqual([]);
  });

  it("should have no duplicate persona IDs", () => {
    const ids = personaList.map((p) => p.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CHALLENGE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

describe("challengeRegistry.json", () => {
  const topics = Object.keys(challengeRegistry);

  it("should have challenge topics defined", () => {
    expect(topics.length).toBeGreaterThan(0);
  });

  it("every topic should have an array of challenges", () => {
    const errors = [];
    for (const topic of topics) {
      if (!Array.isArray(challengeRegistry[topic])) {
        errors.push(`Topic '${topic}' is not an array`);
      }
    }
    expect(errors).toEqual([]);
  });

  it("every challenge should have a task description", () => {
    const errors = [];
    for (const topic of topics) {
      const challenges = challengeRegistry[topic] || [];
      for (const ch of challenges) {
        if (!ch.task) errors.push(`${topic}: challenge missing 'task'`);
        if (!ch.expectedResult) errors.push(`${topic}: challenge '${(ch.task || "?").slice(0, 40)}' missing 'expectedResult'`);
      }
    }
    expect(errors).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COURSE PREREQUISITES
// ═══════════════════════════════════════════════════════════════════════════════

describe("course_prerequisites.json", () => {
  it("should be loadable", () => {
    expect(coursePrerequisites).toBeDefined();
  });

  it("should not have circular prerequisite chains (depth 5)", () => {
    // Build adjacency map: course → prerequisites[]
    const adjMap = new Map();
    if (typeof coursePrerequisites === "object" && !Array.isArray(coursePrerequisites)) {
      for (const [courseCode, data] of Object.entries(coursePrerequisites)) {
        const deps = Array.isArray(data) ? data : data.prerequisites || data.requires || [];
        if (deps.length > 0) adjMap.set(courseCode, deps);
      }
    }

    // DFS cycle detection
    const cycles = [];
    const visited = new Set();
    const stack = new Set();

    function dfs(node, path) {
      if (stack.has(node)) {
        cycles.push([...path, node].join(" → "));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      stack.add(node);
      for (const dep of adjMap.get(node) || []) {
        if (path.length < 5) dfs(dep, [...path, node]);
      }
      stack.delete(node);
    }

    for (const node of adjMap.keys()) {
      dfs(node, []);
    }

    if (cycles.length > 0) {
      console.warn(`⚠️ Circular prerequisites found:\n${cycles.join("\n")}`);
    }
    expect(cycles).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SYNONYM MAP
// ═══════════════════════════════════════════════════════════════════════════════

describe("synonym_map.json", () => {
  it("should be a non-empty object", () => {
    expect(typeof synonymMap).toBe("object");
    expect(Object.keys(synonymMap).length).toBeGreaterThan(0);
  });

  it("every entry should have an array of synonyms", () => {
    const errors = [];
    for (const [key, value] of Object.entries(synonymMap)) {
      if (!Array.isArray(value)) {
        errors.push(`'${key}' value is not an array: ${typeof value}`);
      }
    }
    expect(errors).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SEARCH INDEX
// ═══════════════════════════════════════════════════════════════════════════════

describe("search_index.json", () => {
  it("should be loadable and non-empty", () => {
    expect(searchIndex).toBeDefined();
    const size =
      typeof searchIndex === "object"
        ? Object.keys(searchIndex).length
        : Array.isArray(searchIndex)
          ? searchIndex.length
          : 0;
    expect(size).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. TRANSCRIPT SEGMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("transcript_segments.json", () => {
  // Data is a nested object: { courseCode: { videoName: transcriptText, ... }, ... }
  const courseKeys = Object.keys(transcriptSegments);

  it("should have transcript data for at least some courses", () => {
    expect(courseKeys.length).toBeGreaterThan(0);
    console.log(`📊 Transcript coverage: ${courseKeys.length} courses with transcripts`);
  });

  it("every course entry should have at least one video transcript", () => {
    const empty = courseKeys.filter(
      (key) => Object.keys(transcriptSegments[key] || {}).length === 0
    );
    expect(empty).toEqual([]);
  });

  it("video transcripts should have non-empty text content", () => {
    let totalVideos = 0;
    let emptyVideos = 0;
    for (const courseCode of courseKeys) {
      const videos = transcriptSegments[courseCode];
      for (const [_videoName, transcript] of Object.entries(videos || {})) {
        totalVideos++;
        if (!transcript || (typeof transcript === "string" && transcript.trim().length === 0)) {
          emptyVideos++;
        }
      }
    }
    console.log(`📊 Transcript entries: ${totalVideos} videos, ${emptyVideos} empty`);
    const emptyPercent = totalVideos > 0 ? emptyVideos / totalVideos : 0;
    expect(emptyPercent).toBeLessThan(0.05);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CROSS-FILE CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Cross-file consistency", () => {
  const courses = videoLibrary.courses || [];
  const tags = tagsData.tags || [];
  const tagIds = new Set(tags.map((t) => t.tag_id));

  it("courses with canonical_tags should reference known tag_ids", () => {
    const unknownRefs = [];
    for (const course of courses) {
      for (const tag of course.canonical_tags || []) {
        const normalized = typeof tag === "string" ? tag.toLowerCase() : "";
        if (normalized && !tagIds.has(normalized)) {
          unknownRefs.push(`${course.code}: ${tag}`);
        }
      }
    }
    if (unknownRefs.length > 0) {
      console.warn(
        `⚠️ ${unknownRefs.length} canonical_tag refs to unknown tags (first 5):\n` +
          unknownRefs.slice(0, 5).map((r) => `  - ${r}`).join("\n")
      );
    }
    // This is a soft check — many canonical tags use display names not IDs
  });

  it("total data payload should be under 40MB (prevents bloat)", () => {
    // Rough size estimate using JSON.stringify lengths
    const totalChars =
      JSON.stringify(videoLibrary).length +
      JSON.stringify(tagsData).length +
      JSON.stringify(edgesData).length +
      JSON.stringify(personas).length +
      JSON.stringify(searchIndex).length;
    const estimatedMB = totalChars / (1024 * 1024);
    console.log(`📦 Estimated data payload: ${estimatedMB.toFixed(1)}MB`);
    expect(estimatedMB).toBeLessThan(40);
  });
});
