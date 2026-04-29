# RAG Evaluation Plan

This plan covers **retrieval quality** and **answer quality** as two separable
measurements. The repo previously had `eval/run_eval.js` + `eval/golden_queries.json`
for *tag extraction* — that is not a RAG eval. This plan and the new harness sit
alongside that work without replacing it.

---

## 1. What we measure, and why

Two stages, two dimensions:

| Stage | Metric | What it tells you |
|---|---|---|
| Retrieval | **hit@k** | Did at least one expected chunk/doc appear in top-k? Primary signal of "is retrieval broken?" |
| Retrieval | **coverage@k** | What fraction of the expected chunks appeared in top-k? Catches one-hit-right-but-rest-missing. |
| Retrieval | **MRR** | Mean reciprocal rank of the first expected chunk. Catches "right chunk but ranked 9th". |
| Answer | **citation_validity_rate** | Of the `[n]` references the model emitted, how many pointed at a passage actually sent in? Groundedness proxy. |
| Answer | **citation_density** | Cited passages / total passages sent. Low density often means retrieval returned junk the model ignored. |
| Answer | **refusal_correctness** | For `should_refuse=true` cases: did the pipeline return `NEEDS_MORE_CONTEXT` / `confidence=NO_DATA_AVAILABLE`? |

Retrieval can (and should) be evaluated **without** calling the LLM — it is much
cheaper to iterate on retrieval tuning (top-k, source weights, reranker
on/off) when you are not paying for generation on every run.

---

## 2. Dataset format

`eval/rag_golden.jsonl` — one JSON object per line:

```json
{
  "id": "rag-001",
  "query": "Why is my Nanite mesh flickering at distance?",
  "kind": "factual",
  "expected_chunk_ids": ["epic_xxxx_002"],
  "expected_url_substrings": ["nanite"],
  "expected_sources": ["epic_learning", "epic_docs", "transcript"],
  "must_cite": true,
  "should_refuse": false,
  "notes": "Nanite + LOD interaction — chunk must mention either Nanite fallback or cluster culling."
}
```

Field semantics:

- `kind` ∈ `{factual, multi_part, ambiguous, refuse, precise_source}` — covers
  the five case shapes the audit required.
- `expected_chunk_ids` — any chunk id in Firestore, e.g. `epic_559X_002`. Optional.
- `expected_url_substrings` — if any doc URL in top-k contains one of these, it
  counts as a hit. Loose but useful when chunk ids churn.
- `expected_sources` — at least one passage must come from each named source.
- `must_cite` — answer eval requires ≥1 valid citation.
- `should_refuse` — answer eval requires `refused=true` OR
  `confidence === "NO_DATA_AVAILABLE"`.

The starter set ships with 8 queries covering all five case shapes. Add more
as you harvest real failure cases from production.

---

## 3. How to run

### 3.1 Retrieval-only (offline, no LLM calls)

Fast loop for iterating on retrieval tuning. Requires `GEMINI_API_KEY` so the
harness can embed queries, but hits **only** the embedding endpoint — no
generation, no reranker. It scores the *raw* top-k from the local
`epic_learning_embeddings.json` artifact.

```bash
# From repo root
export GEMINI_API_KEY=...
node eval/rag_eval.js --retrieval-only --k 10
# Writes eval/rag_report.json and prints summary to stdout
```

Exits 0 if hit@10 ≥ 0.6 over the dataset, else 1 — use as a CI smoke test.

### 3.2 End-to-end (live functions)

Calls the deployed `embedQuery` → `vectorSearchEpic` → `queryLearningPath`
chain via `firebase-admin`. Measures both retrieval and answer metrics.
Requires admin credentials.

```bash
export GEMINI_API_KEY=...
export FIREBASE_SERVICE_ACCOUNT=./path/to/serviceAccount.json
node eval/rag_eval.js --e2e --k 10
```

Results land in `eval/rag_report.json` with per-query detail.

### 3.3 Single-case debugging

```bash
node eval/rag_eval.js --retrieval-only --case rag-003 --verbose
```

Prints the top-k passages, similarities, and which expected ids matched.

---

## 4. Target thresholds (starting point)

| Metric | Minimum green | Notes |
|---|---|---|
| hit@10 | ≥ 0.70 | Across all non-refuse cases |
| coverage@10 | ≥ 0.50 | Average fraction of expected chunks retrieved |
| MRR@10 | ≥ 0.40 | Rewards good rank ordering |
| citation_validity_rate | ≥ 0.90 | Invalid `[n]` citations are a red flag |
| refusal_correctness | = 1.00 | Every `should_refuse` case must refuse |

Tune these after the first baseline run — the numbers above are goals, not
measurements.

---

## 5. How the new observability feeds eval

Every query now emits a single `rag_retrieval_trace` log line
(`functions/pipeline/retrievalLog.js`) with:

- `retrieved.count`, `retrieved.sources`, `retrieved.similarity.{min,max,mean}`, `retrieved.ids`
- `citations.{cited_count, valid_count, invalid_count, unused_count, validity_rate}`
- `flags.{sparse_backfill, refused, reason?}`

That means the same metrics the harness computes offline are emitted in
production. You can build a BigQuery view off `Cloud Logging → rag_retrieval_trace`
and watch weekly drift without rerunning the harness.

---

## 6. Known limits of the starter harness

- No semantic groundedness (e.g. NLI-based "does answer follow from evidence").
  Citation validity is a coarse proxy. If you want that, wire in a second
  Gemini pass scoring "does passage P support claim C."
- The retrieval-only mode bypasses the reranker. That is intentional — it
  measures embedding-space recall. Add an `--include-rerank` flag once
  there's a deployable reranker you can call from Node.
- Expected chunk ids rot. Re-harvest them after any reindex.
