#!/usr/bin/env node
/**
 * generate_golden_cases.js — synthesize RAG golden cases from UDN chunks.
 *
 * For each sampled UDN chunk, asks Gemini 2.5 Flash to roleplay a UE5
 * developer who is stuck and would search the docs for that chunk's content.
 * Emits JSONL cases compatible with eval/rag_golden.jsonl.
 *
 * Usage:
 *   node scripts/generate_golden_cases.js --count 50 --output eval/rag_golden_synth.jsonl
 *   node scripts/generate_golden_cases.js --count 5 --dry-run
 *
 * Cases generated have ground-truth derived from the source UDN chunk:
 *   - expected_url_substrings: the trailing slug from the file path
 *   - expected_sources: ["epic_docs"] (UDN → dev.epicgames.com/documentation)
 *
 * Auth: ADC against development-317819 (Vertex AI). Same auth pattern as
 * eval/rag_eval.js — locally requires `gcloud auth application-default login`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UDN_INGESTED = path.join(ROOT, "content", "udn_ingested.jsonl");
const DEFAULT_OUTPUT = path.join(ROOT, "eval", "rag_golden_synth.jsonl");

const PROJECT_ID = process.env.VERTEX_PROJECT_ID || "development-317819";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const MODEL = "gemini-2.5-flash";

function parseArgs(argv) {
  const args = { count: 50, output: DEFAULT_OUTPUT, dryRun: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count") args.count = Number(argv[++i]);
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--verbose") args.verbose = true;
  }
  return args;
}

function loadChunks() {
  if (!fs.existsSync(UDN_INGESTED)) {
    throw new Error(`UDN ingestion not found at ${UDN_INGESTED}. Run scripts/ingest_udn_from_p4.py first.`);
  }
  const text = fs.readFileSync(UDN_INGESTED, "utf-8");
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// Stratified sampling: take roughly equal counts from each top-level category,
// preferring chunks with rich metadata + section headings.
function sampleChunks(chunks, count) {
  const byCategory = new Map();
  for (const c of chunks) {
    const cat = c.section_path?.[0] || "_uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(c);
  }
  // Score each chunk for "good case material"
  for (const arr of byCategory.values()) {
    arr.sort((a, b) => {
      const score = (c) =>
        (c.section_heading ? 2 : 0) +
        (c.description ? 1 : 0) +
        (c.tags?.length || 0) * 0.2 +
        (c.token_estimate >= 200 && c.token_estimate <= 500 ? 1 : 0) -
        (c.doc_type === "Landing" ? 2 : 0); // skip landing pages
      return score(b) - score(a);
    });
  }
  const cats = Array.from(byCategory.keys());
  const perCat = Math.max(1, Math.ceil(count / cats.length));
  const sampled = [];
  for (const cat of cats) {
    const arr = byCategory.get(cat);
    sampled.push(...arr.slice(0, perCat));
    if (sampled.length >= count) break;
  }
  return sampled.slice(0, count);
}

function deriveExpectedSubstrings(chunk) {
  // Use the deepest meaningful slug from file_path for URL matching.
  // file_path: "animating-characters-and-objects/ControlRig/Animating/AnimBP/AnimBP.INT.udn"
  // → slug: "animbp" (last segment, lowercased, .INT.udn stripped)
  const fp = chunk.file_path || "";
  const last = fp.split(/[\\/]/).pop() || "";
  const slug = last.replace(/\.INT\.udn$/i, "").toLowerCase();
  // Also include the parent folder slug for broader coverage
  const parts = fp.split(/[\\/]/);
  const parentSlug = parts[parts.length - 2]?.toLowerCase();
  const subs = [slug];
  if (parentSlug && parentSlug !== slug) subs.push(parentSlug);
  // Filter trivial parts
  return subs.filter((s) => s && s.length > 3 && !["docs", "udn", "source"].includes(s));
}

let _auth = null;
function getAuth() {
  if (!_auth) {
    const { GoogleAuth } = require("google-auth-library");
    _auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  return _auth;
}

async function callGemini(systemPrompt, userPrompt) {
  const fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const client = await getAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Failed to obtain ADC access token");

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };
  const r = await fetchFn(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

// Extract a JSON object from a Gemini response — handles preambles and code fences.
function extractJson(text) {
  const trimmed = (text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }
  const start = trimmed.indexOf("{");
  if (start < 0) throw new Error(`No { found in: ${trimmed.slice(0, 200)}`);
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === "{") depth++;
    else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }
  throw new Error(`No balanced JSON in: ${trimmed.slice(0, 200)}`);
}

const SYSTEM_PROMPT = `You are roleplaying as a UE5 developer who is stuck and searching the official docs.
Given a UE5 doc excerpt, generate ONE realistic question that this developer would type — phrased
like a real Stack Overflow / Discord question, NOT like a doc title.

Rules:
- Use natural, problem-shaped phrasing ("Why is X breaking", "How do I make Y do Z", "What's the
  right way to wire up A").
- DO NOT echo the doc title verbatim. Reference the concept but in a developer's words.
- Keep it 8–18 words. One sentence.
- Mix intents across calls: ~70% "how do I" / "what's the right way", ~30% debug / "why isn't this".
- Also output 2-3 short topic keywords (1-3 words each, lowercased, hyphens for multi-word) that
  would appear in the TITLE or URL of any relevant doc. Examples for "How do I set up Lumen
  reflections in indoor scenes?": ["lumen", "reflections", "global-illumination"]. Keywords should
  be specific enough to discriminate (avoid generic words like "settings", "guide", "unreal").
- Output strict JSON: {"query": "...", "kind": "factual"|"precise_source", "topic_keywords": [...]}.
  Use "precise_source" only if asking for an exact menu path / setting name / specific API.`;

async function generateCase(chunk, idx) {
  const userPrompt = `Doc title: ${chunk.title}
Section: ${chunk.section_heading || "(intro)"}
Description: ${chunk.description || "(none)"}
Tags: ${(chunk.tags || []).join(", ") || "(none)"}

Excerpt (first 500 chars):
${(chunk.body || "").slice(0, 500)}

Generate one realistic developer question about this content.`;

  const text = await callGemini(SYSTEM_PROMPT, userPrompt);
  const parsed = extractJson(text);
  if (!parsed.query) throw new Error("Missing query in response");
  // Combine Gemini-derived topic keywords with file-path slugs.
  // Topic keywords match published doc titles/URLs; slugs catch the rare case
  // where Epic kept the internal naming. Dedup, lowercase, drop trivial.
  const keywords = (Array.isArray(parsed.topic_keywords) ? parsed.topic_keywords : [])
    .map((k) => String(k).toLowerCase().trim())
    .filter((k) => k.length > 3);
  const slugs = deriveExpectedSubstrings(chunk);
  const expectedSubs = Array.from(new Set([...keywords, ...slugs]));
  return {
    id: `synth-${String(idx).padStart(3, "0")}`,
    query: parsed.query,
    kind: parsed.kind === "precise_source" ? "precise_source" : "factual",
    expected_url_substrings: expectedSubs,
    expected_sources: ["epic_docs"],
    must_cite: true,
    should_refuse: false,
    notes: `Synthesized from UDN chunk ${chunk.chunk_id} (${chunk.file_path}). Section: ${chunk.section_heading || "(intro)"}. Topic keywords: ${keywords.join(", ") || "(none)"}.`,
    _source_chunk_id: chunk.chunk_id,
    _source_title: chunk.title,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  console.error(`[gen] Loading UDN chunks…`);
  const all = loadChunks();
  console.error(`[gen] Loaded ${all.length} chunks. Sampling ${args.count}.`);
  const samples = sampleChunks(all, args.count);
  console.error(`[gen] Sampled ${samples.length} (across ${new Set(samples.map((c) => c.section_path?.[0])).size} categories).`);

  const cases = [];
  for (let i = 0; i < samples.length; i++) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const c = await generateCase(samples[i], i + 1);
        cases.push(c);
        if (args.verbose || i % 5 === 0) {
          console.error(`[gen] ${i + 1}/${samples.length} ${c.kind} | ${c.query.slice(0, 80)}`);
        }
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt === 1) {
          console.error(`[gen] ${i + 1}/${samples.length} attempt 1 failed (${err.message.slice(0, 80)}); retrying`);
        }
      }
    }
    if (lastErr) {
      console.error(`[gen] ${i + 1}/${samples.length} FAILED after retry: ${lastErr.message}`);
    }
  }

  if (args.dryRun) {
    console.error(`\n[gen] Dry run — would write ${cases.length} cases to ${args.output}`);
    cases.slice(0, 5).forEach((c) => console.log(JSON.stringify(c)));
    return;
  }

  const lines = cases.map((c) => JSON.stringify(c)).join("\n") + "\n";
  fs.writeFileSync(args.output, lines);
  console.error(`\n[gen] Wrote ${cases.length} cases to ${args.output}`);
  console.error(`[gen] Append to rag_golden.jsonl with: cat ${args.output} >> eval/rag_golden.jsonl`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
