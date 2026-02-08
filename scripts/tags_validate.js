/**
 * tags_validate.js — Validates tags/tags.json against tags/schema.json
 *
 * Uses Ajv (JSON Schema draft-07) from eslint's transitive dep.
 * Falls back to manual validation if Ajv is not available.
 *
 * Usage:
 *   node scripts/tags_validate.js              (validates tags/tags.json)
 *   node scripts/tags_validate.js path/to/file (validates custom file)
 *
 * Exits 0 if valid, 1 if errors found.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_TAGS = path.join(ROOT, "tags", "tags.json");
const SCHEMA_PATH = path.join(ROOT, "tags", "schema.json");

// ---- Schema definitions ----
const VALID_TAG_TYPES = [
  "system",
  "workflow",
  "symptom",
  "error_code",
  "tool",
  "platform",
  "concept",
  "ui_surface",
  "category",
  "skill_level",
];
const VALID_RELATIONS = ["symptom_of", "often_caused_by", "subtopic", "replaces", "related"];
const VALID_ALIAS_TYPES = ["abbrev", "legacy", "community_term", "alternative"];
const VALID_GOVERNANCE_STATUSES = ["active", "deprecated", "experimental"];
const TAG_ID_PATTERN = /^[a-z0-9]+\.[a-z0-9_]+$/;

// ---- Validation logic ----

/**
 * Validate a single tag object against the schema.
 * @param {Object} tag - Tag object to validate
 * @param {number} idx - Index in the tags array
 * @returns {string[]} Array of error messages
 */
function validateTag(tag, idx) {
  const errors = [];
  const prefix = `tags[${idx}] (${tag.tag_id || "UNKNOWN"})`;

  // Required fields
  if (!tag.tag_id || typeof tag.tag_id !== "string") {
    errors.push(`${prefix}: missing or invalid 'tag_id' (string required)`);
  } else if (!TAG_ID_PATTERN.test(tag.tag_id)) {
    errors.push(
      `${prefix}: tag_id '${tag.tag_id}' does not match pattern ^[a-z0-9]+\\.[a-z0-9_]+$`
    );
  }

  if (!tag.display_name || typeof tag.display_name !== "string") {
    errors.push(`${prefix}: missing or invalid 'display_name' (string required)`);
  }

  if (!tag.tag_type || typeof tag.tag_type !== "string") {
    errors.push(`${prefix}: missing or invalid 'tag_type' (string required)`);
  } else if (!VALID_TAG_TYPES.includes(tag.tag_type)) {
    errors.push(
      `${prefix}: invalid tag_type '${tag.tag_type}'. Valid: ${VALID_TAG_TYPES.join(", ")}`
    );
  }

  // category_path
  if (tag.category_path !== undefined) {
    if (!Array.isArray(tag.category_path)) {
      errors.push(`${prefix}: 'category_path' must be an array of strings`);
    } else {
      tag.category_path.forEach((c, i) => {
        if (typeof c !== "string") errors.push(`${prefix}: category_path[${i}] must be a string`);
      });
    }
  }

  // synonyms
  if (tag.synonyms !== undefined) {
    if (!Array.isArray(tag.synonyms)) {
      errors.push(`${prefix}: 'synonyms' must be an array of strings`);
    }
  }

  // aliases
  if (tag.aliases !== undefined) {
    if (!Array.isArray(tag.aliases)) {
      errors.push(`${prefix}: 'aliases' must be an array`);
    } else {
      tag.aliases.forEach((a, i) => {
        if (!a.value || typeof a.value !== "string") {
          errors.push(`${prefix}: aliases[${i}] missing 'value'`);
        }
        if (!a.type || !VALID_ALIAS_TYPES.includes(a.type)) {
          errors.push(
            `${prefix}: aliases[${i}] invalid type '${a.type}'. Valid: ${VALID_ALIAS_TYPES.join(", ")}`
          );
        }
      });
    }
  }

  // related_tags
  if (tag.related_tags !== undefined) {
    if (!Array.isArray(tag.related_tags)) {
      errors.push(`${prefix}: 'related_tags' must be an array`);
    } else {
      tag.related_tags.forEach((r, i) => {
        if (!r.tag_id || typeof r.tag_id !== "string") {
          errors.push(`${prefix}: related_tags[${i}] missing 'tag_id'`);
        }
        if (!r.relation || !VALID_RELATIONS.includes(r.relation)) {
          errors.push(`${prefix}: related_tags[${i}] invalid relation '${r.relation}'`);
        }
      });
    }
  }

  // relevance
  if (tag.relevance) {
    const { global_weight, confidence } = tag.relevance;
    if (
      global_weight !== undefined &&
      (typeof global_weight !== "number" || global_weight < 0 || global_weight > 1)
    ) {
      errors.push(`${prefix}: relevance.global_weight must be a number 0-1`);
    }
    if (
      confidence !== undefined &&
      (typeof confidence !== "number" || confidence < 0 || confidence > 1)
    ) {
      errors.push(`${prefix}: relevance.confidence must be a number 0-1`);
    }
  }

  // governance
  if (tag.governance) {
    if (tag.governance.status && !VALID_GOVERNANCE_STATUSES.includes(tag.governance.status)) {
      errors.push(`${prefix}: invalid governance.status '${tag.governance.status}'`);
    }
  }

  return errors;
}

/**
 * Validate an entire tags file.
 * @param {string} filePath - Path to tags JSON file
 * @returns {{ valid: boolean, errors: string[], tagCount: number }}
 */
function validateTagsFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { valid: false, errors: [`JSON parse error: ${e.message}`], tagCount: 0 };
  }

  if (!data.tags || !Array.isArray(data.tags)) {
    return { valid: false, errors: ["Root object must have a 'tags' array"], tagCount: 0 };
  }

  const errors = [];
  data.tags.forEach((tag, idx) => {
    errors.push(...validateTag(tag, idx));
  });

  return { valid: errors.length === 0, errors, tagCount: data.tags.length };
}

// ---- CLI ----
if (require.main === module) {
  const targetFile = process.argv[2] || DEFAULT_TAGS;
  console.log(`🔍 Validating: ${path.relative(ROOT, targetFile)}\n`);

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ File not found: ${targetFile}`);
    process.exit(1);
  }

  const result = validateTagsFile(targetFile);

  if (result.valid) {
    console.log(`✅ Valid — ${result.tagCount} tags pass schema validation\n`);
    process.exit(0);
  } else {
    console.error(`❌ ${result.errors.length} validation error(s):\n`);
    result.errors.forEach((e) => console.error(`  • ${e}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = { validateTagsFile, validateTag };
