# RAG Audit — Unreal Learning Path Tutor

Date: 2026-04-22
Scope: the live path a Problem-First user query takes through the system —
from the React client through Firebase Cloud Functions to Firestore vector
KNN, Gemini, and back.

---

## 1. Current architecture (as actually implemented)

### 1.1 Entry points for user queries

| Surface | Entry component | Hook | Cloud Function(s) |
|---|---|---|---|
| Problem-First tab (main RAG tutor) | `path-builder/src/components/ProblemFirst/*` | `hooks/useProblemFirst.js::handleSubmit` | `queryLearningPath` (→ `handleProblemFirst`) |
| Onboarding | `components/OnboardingRAG/*` | `hooks/useOnboardingRAG.js` | `queryLearningPath` (→ `handleOnboarding`) |
| Spoke / mini-lesson | `components/SpokeViewer/*` | `hooks/useGapFill.js` / `useLesson.js` | `generateSpoke`, `generateLesson` |

The Problem-First flow is the canonical RAG path; the audit focuses there.

### 1.2 Live path for a Problem-First query

```
User types query
  │
  ▼  path-builder/src/hooks/useProblemFirst.js::handleSubmit
runSearchPipeline(query)                         [services/searchPipeline.js]
  ├─ embedQuery CF               (Gemini gemini-embedding-001, 768d, RETRIEVAL_QUERY)
  ├─ expandQuery CF              (LLM-generated query variants)
  ├─ searchDocsVertexAI CF       (Vertex AI Search on ue5-docs-datastore — independent)
  │
  ├─ findSimilarCourses → vectorSearchCourses CF (Firestore findNearest → course_embeddings)
  ├─ searchSegmentsHybrid        (keyword + vectorSearchSegments + vectorSearchEpic)
  ├─ searchDocsSemantic → vectorSearchDocs CF (findNearest → docs_embeddings)
  ├─ Expansion loop: each variant → searchSegmentsHybrid (semantic embedding NOT threaded in)
  │
  ├─ Source weighting (intent-aware) + text & semantic dedup
  └─ rerankPassages CF           (Gemini 2.0 Flash cross-encoder, scores 0–10)
  │
  ▼  useProblemFirst calls queryLearningPath CF  (mode="problem-first")
handleProblemFirst                               [functions/ai/handleProblemFirst.js]
  ├─ sanitize input, pull session/skill/feedback/misconception context
  ├─ Diagnosis cache check     (BUG: uses text-embedding-004, 768d — see §3.1)
  │    └─ findCachedDiagnosis  (findNearest → cached_diagnoses)
  ├─ Intent stage              (runStage → Gemini 2.0 Flash JSON)
  ├─ (opt) Socratic elicit OR (opt) NEEDS_CLARIFICATION OR (opt) NEEDS_MORE_CONTEXT
  ├─ Diagnosis stage           (evidence block = passages wrapped by wrapEvidence)
  ├─ Objectives stage
  ├─ Parallel: validation, path_summary, micro_lesson (if passages), answer_data
  └─ Assemble response = { cart, mostLikelyCause, confidence, fastChecks, fixSteps,
                            ifStillBrokenBranches, whyThisResult, evidence: [all passages],
                            learnPath, sessionId, _debug?(admin) }
```

### 1.3 Storage

- **Firestore collections** (768-dim COSINE vector indexes — see `firestore.indexes.json`):
  `epic_embeddings` (3,031 RAG chunks), `course_embeddings`, `segment_embeddings`,
  `docs_embeddings`, `cached_diagnoses`.
- **Local JSONs under `path-builder/src/data/`** (`segment_index.json`,
  `search_index.json`, `doc_links.json`, `tags.json`) — used for keyword search,
  prefix index, and topic-aware doc lookup. Per memory: local `*_embeddings.json`
  are build artifacts only; Firestore is the source of truth at query time.
- **Vertex AI Search** data store: `ue5-docs-datastore_1771869696176` — a
  separate retrieval surface; not a vector space managed by this repo.

### 1.4 Ingestion pipeline (build-time only)

Python scripts under `scripts/`:

| Script | Output collection | Model | Task type |
|---|---|---|---|
| `build_embeddings.py` | `course_embeddings` | `gemini-embedding-001` | RETRIEVAL_DOCUMENT |
| `embed_segments.py` | `segment_embeddings` | `gemini-embedding-001` | RETRIEVAL_DOCUMENT |
| `embed_epic_learning.py` | `epic_embeddings` | `gemini-embedding-001` | RETRIEVAL_DOCUMENT |
| `embed_udn_docs.py` | `docs_embeddings` | `gemini-embedding-001` | RETRIEVAL_DOCUMENT |
| `upload_embeddings_to_firestore.py` | writes to Firestore with `Vector()` field |

All index-time embeddings use `gemini-embedding-001` / 768d / RETRIEVAL_DOCUMENT —
internally consistent and aligned with the query-time `embedQuery` CF.

---

## 2. Intended architecture (inferred from code + docs)

Inferred from `ARCHITECTURE.md`, `README.md`, `handleProblemFirst.js` comments,
and memory:

1. Query arrives; one embedding pass serves retrieval AND diagnosis-cache lookup.
2. Retrieval fans out across video transcripts, docs, Epic Learning articles,
   official UE5 docs (Vertex AI), and course-level vectors — with intent-aware
   source weighting.
3. A reranker narrows the context.
4. The server receives those passages as read-only evidence, runs a multi-stage
   prompt pipeline that grounds every factual claim in evidence, and returns
   an answer-first payload with inline `[n]` citations that map to the passages
   actually used.
5. The UI renders `mostLikelyCause → fastChecks → fixSteps → ifStillBroken → why`
   with an evidence panel tied to the citations.

Key divergences between intended and actual behavior are listed in §3.

---

## 3. Gaps, bugs, and risks

> Each finding has a severity (S1=blocking, S2=high, S3=medium, S4=low) and the
> exact file + line.

### 3.1 Embedding-model split — query/cache incoherent with index  **[S2 — RESOLVED 2026-04-29]**

> **Status:** Resolved. `functions/ai/handleProblemFirst.js:234` now uses the canonical
> `embedQueryText` helper from `functions/pipeline/queryEmbedding.js`, which calls
> `gemini-embedding-001` via Vertex AI. Repo-wide grep for `text-embedding-004` returns
> zero hits in `functions/`. Verified during the 2026-04-29 RAG-improvement session.

**Original finding (kept for history):**
`functions/ai/handleProblemFirst.js:165` previously hard-coded `text-embedding-004`
for the diagnosis-cache embedding. Every other embedding call (`embedQuery.js:13`,
`generateSpoke.js:25`, `generateLesson.js:38`, and all Python builders) used
`gemini-embedding-001`. TE-004 and gemini-embedding-001 are different vector spaces.
Consequences:

- Two HTTP round-trips per query (embedQuery + the handler's hard-coded call) to
  two different model endpoints — added 200–400ms per call.
- `cached_diagnoses` ended up self-consistent (writes and reads both TE-004)
  but conceptually isolated from the rest of the system — hard to reason
  about and a footgun for anyone reusing the embedding for other lookups.

### 3.2 Citations are generated but never validated  **[S2]**

- The model is told: "Cite with [1], [2] where you use retrieved passages"
  (`handleProblemFirst.js:691`).
- The response includes `evidence: passages.map(...)` with **every** retrieved
  passage, regardless of whether the model cited it
  (`handleProblemFirst.js:912–921`).
- No code parses inline `[n]` references. Nothing validates that `n` is in
  range of the passages the model actually saw.
- Risk: the UI can show `[7]` citing a passage the model never used, or `[11]`
  that doesn't exist at all, and no signal flags the hallucination.

**Fix:** Parse citations from the answer text, attach `citedRefs`, and emit
per-response citation-coverage telemetry. (Implemented:
`functions/pipeline/citations.js`.)

### 3.3 Tutor is explicitly allowed to answer beyond context  **[S2]**

`handleProblemFirst.js:690`:

> "Prefer the 'Context Block' for specific claims; **you may use well-known UE5
> editor paths/menus when context is thin**, but flag anything uncertain in
> whyThisResult instead of inventing."

Combined with §3.4 (no refusal path) and §3.2 (no citation checking), this
actively encourages ungrounded answers on weak retrieval. The "flag anything
uncertain" hedge is unenforced.

**Fix:** Replace the clause with an explicit grounding contract and a
refusal requirement when the evidence block is empty or low-confidence.

### 3.4 No refusal path when retrieval returns zero passages  **[S2]**

When `passages.length === 0` the flow proceeds to diagnosis / answer_data as
normal. The backfill at `handleProblemFirst.js:763–805` then *hides* the empty
answer by padding `fastChecks`, `fixSteps`, and `whyThisResult` with
semi-generic strings ("Re-read the error or symptom carefully…"). A user
can't distinguish "no retrieval" from "retrieval ran and model failed."

**Fix:** Short-circuit to `NEEDS_MORE_CONTEXT` when `passages.length === 0`
and we have already exhausted one agentic round (or have no way to escalate).
(Implemented: new branch in the patched handler.)

### 3.5 Chunk / document IDs are stripped before reaching the model  **[S3]**

`services/searchPipeline.js:118–125` and `:133–141` map each retrieved passage
to `{ text, courseCode, videoTitle, timestamp, similarity, source }` — **no
`id`**. So the context the LLM sees has no stable identifier to carry through
the prompt, and the server-side `evidence` echoes only what the client sent.
If the Cloud Function wanted to log "chunk `seg_0451` was used in answer,"
it can't.

**Fix:** Preserve `id` (and `url`/`title` where present) through the client
pipeline, send to the CF, and pass through into the response/logs.
(Implemented.)

### 3.6 Query-expansion variants never get their own embedding  **[S3]**

`services/searchPipeline.js:150` calls
`searchSegmentsHybrid(eq, null, [], 4)` — the second argument is the query
embedding and is hard-coded to `null`. Inside `searchSegmentsHybrid` that
causes semantic search to be skipped; expansions only contribute keyword
results. Result: the `expandQuery` CF generates clever paraphrases that the
semantic retriever never sees, wasting a round-trip.

**Fix (low-cost):** either drop expansions from the semantic path and relabel
as "keyword expansion" so the intent is clear, or embed each variant in a
batch call. Documented in §4 fix list.

### 3.7 Observability gaps  **[S2]**

- Per-stage LLM timings are traced (`pipeline/telemetry.js`) but retrieval is
  not: there is no structured log that says "for request_id X we retrieved 10
  passages with similarities [...] from sources [transcript×6, epic_docs×2,
  epic_learning×2]."
- `devLog`/`devWarn` in the client are stripped in production, so the frontend
  retrieval trail is invisible after deploy.
- No log correlates user question → passage ids → citation ids → final answer.

**Fix:** Add `functions/pipeline/retrievalLog.js` with a single structured log
entry per query that captures the tuple; emit it once per handler invocation.
(Implemented.)

### 3.8 Schema field `cited_sources` declared but not consumed  **[S4]**

Diagnosis prompt schema in `handleProblemFirst.js:560` defines
`"cited_sources":[{"ref":"int","detail":"str"}]`. The handler never reads
`diagnosis.cited_sources` and the response doesn't pass it through. Dead weight
in the prompt — adds tokens, adds confusion.

**Fix:** drop the field from the schema (non-blocking, not implemented here to
keep patch small).

### 3.9 Sparse-answer backfill masks broken pipelines  **[S3]**

`handleProblemFirst.js:763–805` silently replaces empty arrays with generic
filler so the page never looks blank. The warning log
(`answer_data_sparse_backfilling`) is the only breadcrumb. In an incident,
you'd see user complaints of "generic answers" with no trace of which
retrieval stage failed.

**Fix:** leave the backfill but *also* attach
`response._meta.answer_sparse_backfill = true` and emit it in the structured
retrieval log so telemetry can count occurrences.

### 3.10 Redundant retrieval surfaces — no deduplication across them  **[S4]**

`vectorSearchEpic` returns `epic_learning` source; `vectorSearchDocs` returns
`epic_docs` source; Vertex AI Search also returns UE5 docs. The three can
return overlapping content with different text fragments — there's no
cross-source dedup (`wordJaccard` in `searchPipeline.js` catches some, but
only within the rank+dedup list, not between `epicResults`, `vertexAIDocs`,
and passages).

Low impact today (different UI surfaces), but if you merge them into a single
evidence panel it becomes confusing.

### 3.11 Stale / orphan pipelines  **[S4]**

- `ingestion/*.py` — earlier tag-based generator, not on the live RAG path.
- `ARCHITECTURE.md` (29KB) and `CHANGES.md` (52KB) drift from the actual
  functions export list.
- The `tags.*` matching pipeline (`eval/run_eval.js`) only measures tag
  extraction — it is **not** a RAG eval and should not be mistaken for one.

No action needed beyond calling them out; `EVAL_PLAN.md` adds a proper RAG
eval alongside them.

---

## 4. Top 5 causes of poor reliability (ranked)

| # | Cause | Why it hurts end-to-end quality |
|---|---|---|
| 1 | **No grounding contract / no refusal** (§3.3, §3.4) | Model invents UE5 menu paths when retrieval returns junk; user can't tell "the tutor is guessing" from "the tutor is right." Highest direct quality hit. |
| 2 | **Citations unchecked** (§3.2) | Users see `[1]` references that may not match shown evidence; erodes trust even when the answer is correct. |
| 3 | **Observability gap on retrieval** (§3.7) | You can't debug "bad answer" — you don't know whether retrieval returned nothing, returned 10 irrelevant, or returned good passages that the model ignored. |
| 4 | **Embedding-model split** (§3.1) | Two embeds per query, two vector spaces. Wasteful and an obvious footgun if anyone tries to reuse the cached embedding for downstream retrieval. |
| 5 | **Chunk IDs stripped + sparse backfill hides failures** (§3.5, §3.9) | You can't trace "which chunk was responsible for this claim," and backfill lies about whether the pipeline worked. |

---

## 5. Prioritized fix list

Severity = impact on reliability; Effort = relative size.

| # | Fix | Severity | Effort | Status |
|---|---|---|---|---|
| 1 | Unify diagnosis-cache embedding on `gemini-embedding-001` via shared helper | S2 | S | **Patched** — `functions/pipeline/queryEmbedding.js`, handler updated |
| 2 | Tighten answer_data prompt: grounding contract + no-UE5-editor fallback | S2 | S | **Patched** — `handleProblemFirst.js` |
| 3 | Empty-passages refusal path (short-circuit `NEEDS_MORE_CONTEXT`) | S2 | S | **Patched** |
| 4 | Citation parsing + validation + coverage telemetry | S2 | M | **Patched** — `functions/pipeline/citations.js` |
| 5 | Structured retrieval log per request (query, passage ids, similarities, sources) | S2 | S | **Patched** — `functions/pipeline/retrievalLog.js` |
| 6 | Preserve `id` field on passages through the client pipeline | S3 | S | **Patched** — `services/searchPipeline.js` |
| 7 | RAG eval harness + starter golden set + metrics | S2 | M | **Added** — `eval/rag_eval.js`, `eval/rag_golden.jsonl`; see `EVAL_PLAN.md` |
| 8 | Attach `_meta.answer_sparse_backfill` when backfill fires | S3 | S | **Patched** |
| 9 | Drop dead `cited_sources` field from diagnosis schema | S4 | S | Deferred — requires schema/test alignment |
| 10 | Thread embedding into expansion-query semantic search | S3 | M | Deferred — low ROI; documented in this file |
| 11 | Cross-source evidence dedup across Vertex AI / docs / epic | S4 | M | Deferred — cosmetic today |

Items 1–8 are the patched set of this audit. Items 9–11 are explicitly
deferred with a written reason, not forgotten.

---

## 6. How the patches survive the existing flow

The patched code changes do **not** break existing callers:

- `handleProblemFirst.js` keeps the same function signature and response shape.
  New fields (`citedRefs`, `_meta`) are additive.
- `searchPipeline.js` still returns `{ queryEmbedding, semanticResults,
  retrievedPassages, expandedQueries, vertexAIDocs }` — each passage simply
  carries extra fields (`id`, `url`, `title`).
- `queryEmbedding.js` is new and internal; no CF export changes.
- `citations.js` / `retrievalLog.js` are pure helpers.
- The eval harness is a standalone Node script; it does not modify runtime code.

See `EVAL_PLAN.md` for how to measure the patched pipeline.
