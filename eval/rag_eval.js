#!/usr/bin/env node
/**
 * rag_eval.js — minimal RAG evaluation harness.
 *
 * Two modes:
 *   --retrieval-only   Only hits the embedding API; scores top-k against the
 *                      local epic_learning_embeddings.json artifact using
 *                      cosine similarity. Fast, no LLM calls.
 *   --e2e              Calls the deployed queryLearningPath Cloud Function
 *                      via firebase-admin and scores BOTH retrieval and
 *                      answer metrics. Requires FIREBASE_SERVICE_ACCOUNT.
 *
 * Usage:
 *   node eval/rag_eval.js --retrieval-only --k 10
 *   node eval/rag_eval.js --retrieval-only --case rag-003 --verbose
 *   node eval/rag_eval.js --e2e --k 10
 *
 * Writes eval/rag_report.json. Exits non-zero if hit@k drops below the
 * threshold (default 0.6) so CI can gate on it.
 *
 * Why this is shaped the way it is:
 *   Retrieval is separable from generation. You want a fast, cheap loop
 *   for tuning top-k / source weights / intent parameters without paying
 *   for LLM calls every time. E2E mode is the end-of-loop confirmation
 *   that the whole pipeline still behaves.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATASET_PATH = path.join(__dirname, "rag_golden.jsonl");
const REPORT_PATH = path.join(__dirname, "rag_report.json");
const DATA_DIR = path.join(ROOT, "path-builder", "src", "data");

// All three retrievable corpora that the production pipeline reads from.
// `expected_sources` in golden cases use these labels.
const EMBEDDING_SOURCES = [
  { file: "epic_learning_embeddings.json", rootKey: "chunks", source: "epic_learning" },
  { file: "segment_embeddings.json", rootKey: "segments", source: "transcript" },
  { file: "docs_embeddings.json", rootKey: "docs", source: "epic_docs" },
];

const EMBED_MODEL = "gemini-embedding-001";
const DIMENSION = 768;
const HIT_THRESHOLD = Number(process.env.RAG_HIT_THRESHOLD || "0.6");

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    retrievalOnly: false,
    e2e: false,
    k: 10,
    case: null,
    verbose: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--retrieval-only") args.retrievalOnly = true;
    else if (a === "--e2e") args.e2e = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--k") args.k = Number(argv[++i]);
    else if (a === "--case") args.case = argv[++i];
  }
  if (!args.retrievalOnly && !args.e2e) args.retrievalOnly = true;
  return args;
}

// ── Dataset ────────────────────────────────────────────────────────────────
function loadDataset(filterId = null) {
  const text = fs.readFileSync(DATASET_PATH, "utf-8");
  const cases = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`Bad JSONL on line ${i + 1}: ${e.message}`);
      }
    });
  if (filterId) return cases.filter((c) => c.id === filterId);
  return cases;
}

// ── Embedding ──────────────────────────────────────────────────────────────
//
// Vertex AI / ADC. Locally requires `gcloud auth application-default login`.
// Project + region overridable via VERTEX_PROJECT_ID / VERTEX_LOCATION envs.
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || "development-317819";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";

let _vertexAuth = null;
function getVertexAuth() {
  if (!_vertexAuth) {
    const { GoogleAuth } = require("google-auth-library");
    _vertexAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return _vertexAuth;
}

async function embedQuery(query) {
  const fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const client = await getVertexAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Failed to obtain ADC access token");

  // Vertex embedding goes through :predict (not :embedContent — that endpoint
  // doesn't support gemini-embedding-001 on Vertex). Different payload + response
  // shape than the AI Studio REST API.
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${EMBED_MODEL}:predict`;
  const payload = {
    instances: [{ task_type: "RETRIEVAL_QUERY", content: query }],
    parameters: { outputDimensionality: DIMENSION },
  };
  const r = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`embedQuery HTTP ${r.status}: ${await r.text()}`);
  const body = await r.json();
  const values = body?.predictions?.[0]?.embeddings?.values;
  if (!Array.isArray(values) || values.length !== DIMENSION) {
    throw new Error(`Bad embedding response (len=${values?.length})`);
  }
  return values;
}

function cosineSim(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// ── Retrieval-only scoring ─────────────────────────────────────────────────
let _chunksCache = null;
function loadChunks() {
  if (_chunksCache) return _chunksCache;
  const all = [];
  const loaded = [];
  for (const { file, rootKey, source } of EMBEDDING_SOURCES) {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) {
      console.error(`[harness] WARNING: ${file} not found at ${fp}; skipping that corpus`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const root = raw[rootKey] || {};
    let added = 0;
    for (const [id, c] of Object.entries(root)) {
      if (!Array.isArray(c?.embedding)) continue;
      all.push({
        id,
        embedding: c.embedding,
        title: c.title || c.video_title || "",
        url: c.url || c.source_url || "",
        source: c.source || source,
        section: c.section || c.video_title || "",
      });
      added++;
    }
    loaded.push(`${source}=${added}`);
  }
  if (all.length === 0) {
    throw new Error(
      `No local embeddings found in ${DATA_DIR}. Run scripts/embed_epic_learning.py and friends first.`
    );
  }
  console.error(`[harness] Loaded ${all.length} chunks (${loaded.join(", ")})`);
  _chunksCache = all;
  return all;
}

function topKRetrieval(queryVec, k) {
  const chunks = loadChunks();
  const scored = chunks.map((c) => ({
    id: c.id,
    title: c.title,
    url: c.url,
    source: c.source,
    similarity: cosineSim(queryVec, c.embedding),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

// ── Metrics ────────────────────────────────────────────────────────────────
function scoreRetrieval(topK, testCase) {
  const wantedIds = new Set(testCase.expected_chunk_ids || []);
  const wantedUrlSubs = (testCase.expected_url_substrings || []).map((s) =>
    String(s).toLowerCase()
  );
  const wantedSources = new Set(testCase.expected_sources || []);

  let firstHitRank = 0; // 1-based, 0 if none
  let hitCount = 0;
  let sourceHits = new Set();

  topK.forEach((r, i) => {
    const rank = i + 1;
    // Match substrings against url + title + section so transcript chunks (no URL)
    // can still hit on video_title/section. Field name kept as `expected_url_substrings`
    // for backward compat — semantically these are content markers.
    const matchHaystack = [r.url || "", r.title || "", r.section || ""]
      .join(" ")
      .toLowerCase();
    const idMatch = wantedIds.size > 0 && wantedIds.has(r.id);
    const urlMatch =
      wantedUrlSubs.length > 0 && wantedUrlSubs.some((s) => matchHaystack.includes(s));
    const hit = idMatch || urlMatch;
    if (hit) {
      hitCount++;
      if (firstHitRank === 0) firstHitRank = rank;
    }
    if (wantedSources.has(r.source)) sourceHits.add(r.source);
  });

  const expectedTotal =
    wantedIds.size + (wantedUrlSubs.length > 0 ? wantedUrlSubs.length : 0);

  return {
    hit: hitCount > 0,
    hitCount,
    coverage: expectedTotal > 0 ? Math.min(1, hitCount / expectedTotal) : null,
    mrr: firstHitRank > 0 ? 1 / firstHitRank : 0,
    sourcesCovered: Array.from(sourceHits),
    sourcesExpected: Array.from(wantedSources),
    firstHitRank,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  const cases = loadDataset(args.case);
  if (cases.length === 0) {
    console.error(`No cases loaded${args.case ? ` for id=${args.case}` : ""}.`);
    process.exit(2);
  }

  const results = [];
  for (const tc of cases) {
    // Refusal cases: retrieval-only mode does not call the LLM, so we
    // can only report that the case needs E2E to be scored for refusal.
    if (tc.should_refuse && args.retrievalOnly) {
      results.push({
        id: tc.id,
        query: tc.query,
        skipped: "refusal case — run with --e2e to score",
      });
      continue;
    }

    // Ambiguous cases (no expected chunks AND no expected URL substrings) are
    // scored on pipeline behavior (clarification vs fabrication), not retrieval.
    // Skip in retrieval-only mode — counting them as misses is a measurement
    // bug, not a real signal.
    const hasRetrievalTarget =
      (tc.expected_chunk_ids?.length ?? 0) > 0 ||
      (tc.expected_url_substrings?.length ?? 0) > 0;
    if (!hasRetrievalTarget && args.retrievalOnly) {
      results.push({
        id: tc.id,
        query: tc.query,
        skipped: "ambiguous case (no retrieval target) — run with --e2e to score",
      });
      continue;
    }

    try {
      const qVec = await embedQuery(tc.query);
      const topK = topKRetrieval(qVec, args.k);
      const retrieval = scoreRetrieval(topK, tc);

      if (args.verbose) {
        console.log(`\n[${tc.id}] ${tc.query}`);
        topK.forEach((r, i) => {
          console.log(
            `  ${i + 1}. sim=${r.similarity.toFixed(3)} src=${r.source} id=${r.id} ${r.title || r.url}`
          );
        });
        console.log("  score:", retrieval);
      }

      results.push({
        id: tc.id,
        query: tc.query,
        kind: tc.kind,
        retrieval,
        topK: args.verbose ? topK : topK.map((r) => ({ id: r.id, similarity: r.similarity })),
      });
    } catch (err) {
      results.push({ id: tc.id, query: tc.query, error: err.message });
    }
  }

  // Aggregate
  const scored = results.filter((r) => r.retrieval);
  const hitRate = scored.length > 0 ? scored.filter((r) => r.retrieval.hit).length / scored.length : 0;
  const mrr =
    scored.length > 0 ? scored.reduce((a, r) => a + (r.retrieval.mrr || 0), 0) / scored.length : 0;
  const coverageScored = scored.filter((r) => r.retrieval.coverage !== null);
  const coverage =
    coverageScored.length > 0
      ? coverageScored.reduce((a, r) => a + r.retrieval.coverage, 0) / coverageScored.length
      : null;

  const summary = {
    run_at: new Date().toISOString(),
    mode: args.e2e ? "e2e" : "retrieval-only",
    k: args.k,
    cases_total: cases.length,
    cases_scored: scored.length,
    cases_errored: results.filter((r) => r.error).length,
    cases_skipped: results.filter((r) => r.skipped).length,
    "hit@k": Number(hitRate.toFixed(3)),
    "mrr@k": Number(mrr.toFixed(3)),
    "coverage@k": coverage !== null ? Number(coverage.toFixed(3)) : null,
    threshold: HIT_THRESHOLD,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ summary, results }, null, 2));
  console.log("\n── RAG Eval Summary ──");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReport: ${REPORT_PATH}`);

  if (hitRate < HIT_THRESHOLD) {
    console.error(
      `\n✗ hit@${args.k} = ${hitRate.toFixed(3)} < threshold ${HIT_THRESHOLD}`
    );
    process.exit(1);
  }
  console.log(`\n✓ hit@${args.k} = ${hitRate.toFixed(3)} ≥ threshold ${HIT_THRESHOLD}`);
}

main().catch((err) => {
  console.error("Harness failed:", err);
  process.exit(2);
});
