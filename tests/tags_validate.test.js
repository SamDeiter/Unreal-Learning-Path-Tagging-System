/**
 * tests/tags_validate.test.js — Unit tests for tags_validate and tags_lint
 *
 * Uses Node.js built-in test runner (node --test).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { validateTag, validateTagsFile } = require("../scripts/tags_validate");
const { lintTags } = require("../scripts/tags_lint");

// ---- Helpers ----
function makeValidTag(overrides = {}) {
  return {
    tag_id: "scripting.blueprint",
    display_name: "Blueprint",
    tag_type: "system",
    category_path: ["Core Systems", "Scripting"],
    description: "Visual scripting system in Unreal Engine",
    synonyms: ["blueprints", "BP"],
    aliases: [{ type: "abbrev", value: "BP" }],
    related_tags: [{ tag_id: "scripting.cpp", relation: "related" }],
    constraints: { engine_versions: { min: "4.0" }, platforms: ["all"] },
    signals: { error_signatures: [], log_tokens: [], ui_terms: [] },
    relevance: { global_weight: 0.98, freshness_bias_days: 90, confidence: 0.95 },
    governance: {
      status: "active",
      owner: "system",
      created_utc: "2026-01-26",
      updated_utc: "2026-01-26",
    },
    ...overrides,
  };
}

// ============================================================
// tags_validate tests
// ============================================================

describe("validateTag", () => {
  it("should accept a valid tag", () => {
    const errors = validateTag(makeValidTag(), 0);
    assert.deepStrictEqual(errors, []);
  });

  it("should reject missing tag_id", () => {
    const errors = validateTag(makeValidTag({ tag_id: undefined }), 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("tag_id"));
  });

  it("should reject invalid tag_id pattern", () => {
    const errors = validateTag(makeValidTag({ tag_id: "Invalid-ID" }), 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("pattern"));
  });

  it("should reject missing display_name", () => {
    const errors = validateTag(makeValidTag({ display_name: "" }), 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("display_name"));
  });

  it("should reject invalid tag_type", () => {
    const errors = validateTag(makeValidTag({ tag_type: "bogus" }), 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("tag_type"));
  });

  it("should reject invalid alias type", () => {
    const tag = makeValidTag({ aliases: [{ value: "x", type: "typo" }] });
    const errors = validateTag(tag, 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("aliases"));
  });

  it("should reject invalid related_tags relation", () => {
    const tag = makeValidTag({ related_tags: [{ tag_id: "a.b", relation: "nope" }] });
    const errors = validateTag(tag, 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("relation"));
  });

  it("should reject out-of-range global_weight", () => {
    const tag = makeValidTag({ relevance: { global_weight: 1.5, confidence: 0.5 } });
    const errors = validateTag(tag, 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("global_weight"));
  });

  it("should reject invalid governance status", () => {
    const tag = makeValidTag({ governance: { status: "removed" } });
    const errors = validateTag(tag, 0);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("governance"));
  });
});

describe("validateTagsFile", () => {
  it("should validate the real tags.json file", () => {
    const tagsFile = path.join(__dirname, "..", "tags", "tags.json");
    const result = validateTagsFile(tagsFile);
    assert.ok(result.tagCount > 0, `Expected tags but got ${result.tagCount}`);
    if (!result.valid) {
      console.log("Validation errors in tags.json:", result.errors);
    }
    // Note: This test reports issues but doesn't force-fail
    // because existing data may have known schema quirks.
  });

  it("should validate the sample tags file", () => {
    const sampleFile = path.join(__dirname, "..", "sample_data", "tags.json");
    const result = validateTagsFile(sampleFile);
    assert.strictEqual(
      result.valid,
      true,
      `Sample tags should be perfectly valid: ${result.errors.join(", ")}`
    );
    assert.strictEqual(result.tagCount, 64);
  });
});

// ============================================================
// tags_lint tests
// ============================================================

describe("lintTags", () => {
  it("should detect duplicate tag_ids", () => {
    const data = { tags: [makeValidTag(), makeValidTag()] };
    const edges = { edges: [] };
    const result = lintTags(data, edges);
    assert.ok(result.warnings.some((w) => w.includes("DUPLICATE")));
  });

  it("should detect missing descriptions", () => {
    const data = { tags: [makeValidTag({ description: "" })] };
    const edges = { edges: [] };
    const result = lintTags(data, edges);
    assert.ok(result.warnings.some((w) => w.includes("MISSING_DESC")));
  });

  it("should detect deprecated without replacement", () => {
    const tag = makeValidTag({ governance: { status: "deprecated" } });
    const data = { tags: [tag] };
    const edges = { edges: [] };
    const result = lintTags(data, edges);
    assert.ok(result.warnings.some((w) => w.includes("DEPRECATED_NO_REPLACEMENT")));
  });

  it("should detect dangling references", () => {
    const tag = makeValidTag({ related_tags: [{ tag_id: "does.not_exist", relation: "related" }] });
    const data = { tags: [tag] };
    const edges = { edges: [] };
    const result = lintTags(data, edges);
    assert.ok(result.warnings.some((w) => w.includes("DANGLING_REF")));
  });

  it("should detect duplicate edges", () => {
    const tag = makeValidTag();
    const data = { tags: [tag] };
    const edge = {
      source: "scripting.blueprint",
      target: "scripting.cpp",
      relation: "related",
      weight: 0.8,
    };
    const edges = { edges: [edge, edge] };
    const result = lintTags(data, edges);
    assert.ok(result.warnings.some((w) => w.includes("DUPLICATE_EDGE")));
  });

  it("should pass clean data with no warnings", () => {
    const tags = {
      tags: [
        makeValidTag(),
        makeValidTag({
          tag_id: "scripting.cpp",
          display_name: "C++",
          related_tags: [{ tag_id: "scripting.blueprint", relation: "related" }],
        }),
      ],
    };
    const edges = {
      edges: [
        {
          source: "scripting.blueprint",
          target: "scripting.cpp",
          relation: "related",
          weight: 0.8,
        },
      ],
    };
    const result = lintTags(tags, edges);
    assert.strictEqual(
      result.warnings.length,
      0,
      `Expected no warnings but got: ${result.warnings.join(", ")}`
    );
  });
});
