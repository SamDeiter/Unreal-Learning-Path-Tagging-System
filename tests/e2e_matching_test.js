/**
 * e2e_matching_test.js — End-to-end test of the matching pipeline
 * against real course data from video_library_enriched.json.
 *
 * Standalone: loads tags/edges/courses directly and replicates
 * the core matching logic to avoid JSON import attribute issues.
 *
 * Usage: node tests/e2e_matching_test.js
 */

import { normalizeQuery, depluralize } from "../path-builder/src/services/QueryNormalizer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load data files directly
const tagsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "tags", "tags.json"), "utf-8")
);
const edgesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "tags", "edges.json"), "utf-8")
);
const videoLib = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "path-builder", "src", "data", "video_library_enriched.json"),
    "utf-8"
  )
);

const tags = tagsData.tags || [];
const edges = edgesData.edges || [];
const courses = videoLib.courses || videoLib;

// ── Build term index (replicates TagGraphService._buildTermIndex) ──
function buildTermIndex() {
  const index = [];
  const addTerm = (term, tagId, termType) => {
    if (!term || typeof term !== "string") return;
    const normalized = term.toLowerCase().trim();
    if (normalized.length < 2) return;
    const words = normalized.split(/\s+/);
    index.push({ term: normalized, tagId, termType, isPhrase: words.length > 1 });
    const dep = words.map((w) => depluralize(w)).join(" ");
    if (dep !== normalized) {
      index.push({ term: dep, tagId, termType, isPhrase: words.length > 1 });
    }
  };

  for (const tag of tags) {
    addTerm(tag.display_name, tag.tag_id, "display_name");
    const suffix = tag.tag_id.split(".").pop();
    if (suffix && suffix.length > 2)
      addTerm(suffix.replace(/_/g, " "), tag.tag_id, "tag_id_suffix");
    for (const syn of tag.synonyms || []) addTerm(syn, tag.tag_id, "synonym");
    for (const alias of tag.aliases || []) addTerm(alias.value, tag.tag_id, "alias");
    for (const term of tag.signals?.ui_terms || []) addTerm(term, tag.tag_id, "ui_term");
    for (const sig of tag.signals?.error_signatures || []) addTerm(sig, tag.tag_id, "error_sig");
  }

  index.sort((a, b) => {
    if (a.isPhrase !== b.isPhrase) return a.isPhrase ? -1 : 1;
    return b.term.length - a.term.length;
  });
  return index;
}

const termIndex = buildTermIndex();

// ── Extract tags from text (replicates TagGraphService.extractTagsFromText) ──
const TYPE_CONFIDENCE = {
  error_sig: 0.95,
  display_name: 0.85,
  synonym: 0.8,
  tag_id_suffix: 0.75,
  alias: 0.7,
  ui_term: 0.65,
};

function extractTagsFromText(text) {
  if (!text) return { matchedTagIds: [], matches: [] };
  const { normalized, negatedTerms } = normalizeQuery(text);
  const queryWords = new Set(normalized.split(/\s+/).filter((w) => w.length > 1));

  const matches = [];
  const seen = new Set();

  for (const entry of termIndex) {
    if (seen.has(entry.tagId)) continue;
    let matched = false;

    if (entry.isPhrase) {
      const re = new RegExp(`\\b${entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(normalized)) matched = true;
    } else {
      if (queryWords.has(entry.term)) {
        matched = true;
      } else {
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
      matches.push({
        tagId: entry.tagId,
        matchType: entry.termType,
        confidence: TYPE_CONFIDENCE[entry.termType] || 0.5,
      });
    }
  }

  // Apply negation
  const excludeIds = [];
  if (negatedTerms.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const tagSuffix = matches[i].tagId.split(".").pop();
      if (negatedTerms.some((nt) => tagSuffix.includes(nt) || nt.includes(tagSuffix))) {
        excludeIds.push(matches[i].tagId);
        matches.splice(i, 1);
      }
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return { matchedTagIds: matches.map((m) => m.tagId), matches, normalizedQuery: normalized };
}

// ── Score course relevance (replicates TagGraphService.scoreCourseRelevance) ──
const edgeWeights = {
  subtopic: { forward: 0.8, reverse: 0.6 },
  related: { forward: 0.5, reverse: 0.4 },
  symptom_of: { forward: 0.7, reverse: 0.3 },
  often_caused_by: { forward: 0.6, reverse: 0.4 },
  replaces: { forward: 0.5, reverse: 0.15 },
};

const edgesBySource = new Map();
const edgesByTarget = new Map();
for (const e of edges) {
  if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, []);
  edgesBySource.get(e.source).push(e);
  if (!edgesByTarget.has(e.target)) edgesByTarget.set(e.target, []);
  edgesByTarget.get(e.target).push(e);
}

function scoreCourseRelevance(queryTagIds, courseTags) {
  const courseTagSet = new Set(courseTags.map((t) => t.toLowerCase()));
  const querySet = new Set(queryTagIds);

  let directOverlap = 0;
  for (const qt of querySet) {
    if (courseTagSet.has(qt)) directOverlap += 25;
    // Suffix match
    const suffix = qt.split(".").pop();
    if (
      !courseTagSet.has(qt) &&
      [...courseTagSet].some((ct) => ct.endsWith("." + suffix) || ct === suffix)
    ) {
      directOverlap += 15;
    }
  }

  // Graph propagation
  let graphProp = 0;
  for (const qt of querySet) {
    let tagGraph = 0;
    // 1-hop forward
    for (const edge of edgesBySource.get(qt) || []) {
      if (courseTagSet.has(edge.target)) {
        const w = edgeWeights[edge.relation] || { forward: 0.2 };
        tagGraph += 15 * w.forward;
      }
    }
    // 1-hop reverse
    for (const edge of edgesByTarget.get(qt) || []) {
      if (courseTagSet.has(edge.source)) {
        const w = edgeWeights[edge.relation] || { reverse: 0.1 };
        tagGraph += 15 * (w.reverse || 0.1);
      }
    }
    graphProp += Math.min(15, tagGraph);
  }

  const score = Math.min(100, directOverlap + graphProp);
  return { score, directOverlap, graphProp };
}

// ── Run tests ──
const TEST_QUERIES = [
  "lumen reflections flickering in my level",
  "how to set up nanite meshes",
  "blueprint accessed none error",
  "niagara particle system VFX",
  "multiplayer replication dedicated server",
  "landscape terrain heightmap",
  "material shader PBR setup",
  "animation blueprint state machine",
  "sequencer cutscene camera",
  "MetaHuman face animation",
];

console.log(
  `\n🎯 E2E Matching Test — ${courses.length} courses, ${tags.length} tags, ${edges.length} edges\n`
);
console.log("═".repeat(80));

for (const query of TEST_QUERIES) {
  const { matchedTagIds, matches } = extractTagsFromText(query);

  console.log(`\n🔍 Query: "${query}"`);
  console.log(`   Tags matched: [${matchedTagIds.join(", ")}]`);
  console.log(`   Match types: ${matches.map((m) => `${m.tagId}(${m.matchType})`).join(", ")}`);

  // Score all courses
  const scored = [];
  for (const course of courses) {
    const courseTags = [
      ...(course.canonical_tags || []),
      ...(course.gemini_system_tags || []),
      ...(course.extracted_tags || []),
    ];
    const result = scoreCourseRelevance(matchedTagIds, courseTags);
    if (result.score > 0) {
      scored.push({ title: course.title, code: course.code, ...result });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5);

  if (top5.length === 0) {
    console.log("   ❌ No courses matched");
  } else {
    console.log(`   📊 Top ${Math.min(5, top5.length)} of ${scored.length} scoring courses:`);
    for (let i = 0; i < top5.length; i++) {
      const c = top5[i];
      const title = (c.title || "?").substring(0, 50).padEnd(50);
      console.log(
        `      ${i + 1}. [${String(c.score).padStart(3)}] ${title} (D:${c.directOverlap} G:${c.graphProp.toFixed(1)})`
      );
    }
  }
}

console.log("\n" + "═".repeat(80));
const matched = TEST_QUERIES.filter((q) => extractTagsFromText(q).matchedTagIds.length > 0).length;
console.log(`\n✅ ${matched}/${TEST_QUERIES.length} queries matched tags`);
console.log(`📊 Term index: ${termIndex.length} entries`);
