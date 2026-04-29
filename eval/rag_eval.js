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
    rerank: "none", // none | gemini | managed
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--retrieval-only") args.retrievalOnly = true;
    else if (a === "--e2e") args.e2e = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--k") args.k = Number(argv[++i]);
    else if (a === "--case") args.case = argv[++i];
    else if (a.startsWith("--rerank=")) args.rerank = a.split("=")[1];
    else if (a === "--rerank") args.rerank = argv[++i];
  }
  if (!args.retrievalOnly && !args.e2e) args.retrievalOnly = true;
  if (!["none", "gemini", "managed"].includes(args.rerank)) {
    throw new Error(`--rerank must be one of none|gemini|managed (got "${args.rerank}")`);
  }
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
        text: c.text || c.content || "",
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
    section: c.section,
    text: c.text,
    similarity: cosineSim(queryVec, c.embedding),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

// ── Rerankers ──────────────────────────────────────────────────────────────
//
// rerank(query, candidates, mode, k) returns { topK, rerankElapsedMs }.
// `candidates` is an array of objects shaped like topKRetrieval rows
// (id, title, url, source, section, text, similarity). Returned topK
// preserves that shape so downstream scoring is mode-agnostic.

async function rerankWithGemini(query, candidates, k) {
  const fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const client = await getVertexAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("rerankWithGemini: failed to obtain ADC access token");

  // Mirror production: cap at 30 passages, 300-char text, sanitize brackets/quotes.
  const truncated = candidates.slice(0, 30);
  const passageList = truncated
    .map((p, i) => {
      const safeText = String(p.text || "").slice(0, 300).replace(/[\[\]"\\]/g, "");
      return `[${i}] ${safeText}`;
    })
    .join("\n");

  // Verbatim from functions/ai/rerankPassages.js (lines 61–75).
  const prompt = `You are a relevance scoring engine for Unreal Engine 5 technical content.

Query: "${query}"

Score each passage 0-10 for how relevant it is to answering this UE5 query.
- 10 = directly answers the question or describes the exact solution
- 7-9 = highly relevant context about the right subsystem/feature
- 4-6 = somewhat related but not directly useful
- 0-3 = irrelevant or wrong context

Passages:
${passageList}

Return ONLY a JSON array of objects: [{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]
Include ALL ${truncated.length} passages.`;

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.5-flash:generateContent`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
    },
  };

  const r = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    throw new Error(`rerankWithGemini HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  const body = await r.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  let scores;
  try {
    scores = JSON.parse(text);
    if (!Array.isArray(scores)) scores = [];
  } catch {
    scores = [];
  }
  const scoreMap = new Map();
  for (const s of scores) {
    if (typeof s.index === "number" && typeof s.score === "number") {
      scoreMap.set(s.index, Math.max(0, Math.min(10, s.score)));
    }
  }
  const reranked = truncated
    .map((p, i) => ({ ...p, _rerankScore: scoreMap.get(i) ?? 5 }))
    .sort((a, b) => b._rerankScore - a._rerankScore);
  return reranked.slice(0, k);
}

async function rerankWithManaged(query, candidates, k) {
  const fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const client = await getVertexAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("rerankWithManaged: failed to obtain ADC access token");

  const truncated = candidates.slice(0, 30);
  const records = truncated.map((p) => ({
    id: String(p.id),
    title: String(p.title || "").slice(0, 256),
    content: String(p.text || "").slice(0, 1024),
  }));

  const url = `https://discoveryengine.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/rankingConfigs/default_ranking_config:rank`;
  const payload = {
    model: "semantic-ranker-default@latest",
    query,
    topN: k,
    records,
  };

  const r = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-User-Project": PROJECT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    throw new Error(`rerankWithManaged HTTP ${r.status}: ${(await r.text()).slice(0, 500)}`);
  }
  const body = await r.json();
  const ranked = Array.isArray(body?.records) ? body.records : [];

  // Map back to original candidate objects by id, preserving the score from the API.
  const byId = new Map(truncated.map((p) => [String(p.id), p]));
  const out = [];
  for (const r0 of ranked) {
    const original = byId.get(String(r0.id));
    if (original) out.push({ ...original, _rerankScore: r0.score });
  }
  return out.slice(0, k);
}

async function rerank(query, candidates, mode, k) {
  const t0 = Date.now();
  let topK;
  if (mode === "none") {
    // Already cosine-sorted; just take top-k.
    topK = candidates.slice(0, k);
  } else if (mode === "gemini") {
    topK = await rerankWithGemini(query, candidates, k);
  } else if (mode === "managed") {
    topK = await rerankWithManaged(query, candidates, k);
  } else {
    throw new Error(`Unknown rerank mode: ${mode}`);
  }
  return { topK, rerankElapsedMs: Date.now() - t0 };
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
      // For rerank modes, pull a bigger candidate pool (production caps at 30).
      // For mode=none, skip the cost of grabbing 30 if the user only asked for k.
      const poolSize = args.rerank === "none" ? args.k : 30;
      const candidates = topKRetrieval(qVec, poolSize);
      const { topK, rerankElapsedMs } = await rerank(tc.query, candidates, args.rerank, args.k);
      const retrieval = scoreRetrieval(topK, tc);

      if (args.verbose) {
        console.log(`\n[${tc.id}] ${tc.query}`);
        topK.forEach((r, i) => {
          const tail = r._rerankScore !== undefined ? ` rscore=${r._rerankScore}` : "";
          console.log(
            `  ${i + 1}. sim=${(r.similarity ?? 0).toFixed(3)}${tail} src=${r.source} id=${r.id} ${r.title || r.url}`
          );
        });
        console.log("  score:", retrieval);
      }

      results.push({
        id: tc.id,
        query: tc.query,
        kind: tc.kind,
        retrieval,
        rerank_elapsed_ms: rerankElapsedMs,
        topK: args.verbose
          ? topK
          : topK.map((r) => ({
              id: r.id,
              similarity: r.similarity,
              ...(r._rerankScore !== undefined ? { rerankScore: r._rerankScore } : {}),
            })),
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

  const rerankElapsed = scored
    .map((r) => r.rerank_elapsed_ms)
    .filter((v) => typeof v === "number");
  const meanRerankMs =
    rerankElapsed.length > 0
      ? rerankElapsed.reduce((a, b) => a + b, 0) / rerankElapsed.length
      : null;

  const summary = {
    run_at: new Date().toISOString(),
    mode: args.e2e ? "e2e" : "retrieval-only",
    rerank_mode: args.rerank,
    k: args.k,
    cases_total: cases.length,
    cases_scored: scored.length,
    cases_errored: results.filter((r) => r.error).length,
    cases_skipped: results.filter((r) => r.skipped).length,
    "hit@k": Number(hitRate.toFixed(3)),
    "mrr@k": Number(mrr.toFixed(3)),
    "coverage@k": coverage !== null ? Number(coverage.toFixed(3)) : null,
    mean_rerank_elapsed_ms: meanRerankMs !== null ? Number(meanRerankMs.toFixed(1)) : null,
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
